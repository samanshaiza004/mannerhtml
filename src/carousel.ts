import {
  BootstrapController,
  addIdReferences,
  describe,
  discoverOwned,
  duplicateIdError,
  missingIdError,
  reportError,
} from "./shared.js";

type ChangeSource = "programmatic" | "next" | "previous";

export interface CarouselChangeDetail {
  index: number;
  slide: HTMLElement;
  source: ChangeSource;
}

interface CarouselModel {
  slidesContainer: HTMLElement;
  slides: HTMLElement[];
  previous: HTMLButtonElement;
  next: HTMLButtonElement;
  loop: boolean;
  selectedIndex: number;
}

type ModelResult =
  | { state: "pending" }
  | { state: "invalid" }
  | { state: "valid"; model: CarouselModel };

const HTMLElementBase: typeof HTMLElement =
  (globalThis as { HTMLElement?: typeof HTMLElement }).HTMLElement ??
  (class {} as typeof HTMLElement);

function hasAuthoredName(element: Element): boolean {
  return Boolean(
    element.getAttribute("aria-label")?.trim() || element.getAttribute("aria-labelledby")?.trim(),
  );
}

function hasControlName(element: Element): boolean {
  return Boolean(
    element.getAttribute("aria-label")?.trim() ||
      element.getAttribute("aria-labelledby")?.trim() ||
      element.textContent?.trim(),
  );
}

function isVisibleSlide(slide: HTMLElement): boolean {
  return !slide.hasAttribute("hidden");
}

export class MannerCarousel extends HTMLElementBase {
  #initialized = false;
  #bootstrap = new BootstrapController();
  #abortController: AbortController | null = null;
  #slidesContainer!: HTMLElement;
  #slides: HTMLElement[] = [];
  #previous!: HTMLButtonElement;
  #next!: HTMLButtonElement;
  #loop = false;
  #selectedIndex = 0;

  connectedCallback(): void {
    if (this.#initialized) {
      this.#bindRuntime();
      return;
    }
    const result = this.#tryUpgrade();
    if (result.state !== "pending") return;
    this.#bootstrap.start(this, (finalize) => this.#tryUpgrade(finalize));
  }

  disconnectedCallback(): void {
    this.#bootstrap.stop();
    this.#abortController?.abort();
    this.#abortController = null;
  }

  get selectedIndex(): number {
    return this.#selectedIndex;
  }

  set selectedIndex(index: number) {
    this.select(index);
  }

  select(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.#slides.length) {
      throw new RangeError(`${describe(this, "manner-carousel")}: selectedIndex is out of range`);
    }
    this.#select(index, "programmatic");
  }

  next(): void {
    if (!this.#slides.length) return;
    if (!this.#loop && this.#selectedIndex === this.#slides.length - 1) return;
    const index = (this.#selectedIndex + 1) % this.#slides.length;
    this.#select(index, "next");
  }

  previous(): void {
    if (!this.#slides.length) return;
    if (!this.#loop && this.#selectedIndex === 0) return;
    const index = (this.#selectedIndex - 1 + this.#slides.length) % this.#slides.length;
    this.#select(index, "previous");
  }

  refresh(): void {
    const selectedSlide = this.#slides[this.#selectedIndex];
    const result = this.#buildModel(selectedSlide);
    if (result.state === "valid") this.#commit(result.model);
  }

  #tryUpgrade(finalize = false): ModelResult {
    const result = this.#buildModel(undefined, finalize);
    if (result.state === "valid") this.#commit(result.model);
    else if (result.state === "invalid") this.#bootstrap.stop();
    return result;
  }

  #buildModel(previousSlide?: HTMLElement, finalize = false): ModelResult {
    const containers = discoverOwned<HTMLElement>(this, "[data-slides]", MannerCarousel);
    const slides = discoverOwned<HTMLElement>(this, "[data-slide]", MannerCarousel);
    const previous = discoverOwned<HTMLButtonElement>(this, "[data-previous]", MannerCarousel);
    const next = discoverOwned<HTMLButtonElement>(this, "[data-next]", MannerCarousel);

    const invalid = (message: string): ModelResult => {
      reportError(this, "manner-carousel", message);
      return { state: "invalid" };
    };

    if (
      !finalize &&
      (this.ownerDocument?.readyState === "loading" ||
        containers.length === 0 || slides.length === 0 || previous.length === 0 || next.length === 0)
    ) return { state: "pending" };

    if (containers.length !== 1) return invalid(`Expected exactly one owned [data-slides]; found ${containers.length}.`);
    if (slides.length === 0) return invalid("Expected at least one owned [data-slide].");
    if (previous.length !== 1 || next.length !== 1) {
      return invalid(`Expected exactly one owned [data-previous] and [data-next]; found ${previous.length} and ${next.length}.`);
    }

    const hostName = this.getAttribute("aria-label")?.trim() || this.getAttribute("aria-labelledby")?.trim();
    if (!hostName) return invalid("The carousel requires aria-label or aria-labelledby.");
    if (this.hasAttribute("role") && this.getAttribute("role") !== "group") {
      return invalid("The carousel has a conflicting authored role.");
    }
    if (this.hasAttribute("aria-roledescription") && this.getAttribute("aria-roledescription") !== "carousel") {
      return invalid("The carousel has a conflicting authored aria-roledescription.");
    }

    const slidesContainer = containers[0];
    if (slides.some((slide) => !slidesContainer.contains(slide))) {
      return invalid("Every owned [data-slide] must be inside [data-slides].");
    }
    const authoredLive = slidesContainer.getAttribute("aria-live");
    if (authoredLive && authoredLive !== "polite") {
      return invalid("[data-slides] requires aria-live=\"polite\".");
    }
    for (const control of [previous[0], next[0]]) {
      if (control.localName !== "button" || control.getAttribute("type")?.toLowerCase() !== "button") {
        return invalid("Carousel controls must be native <button type=\"button\"> elements.");
      }
      if (control.hasAttribute("disabled") || control.matches(":disabled")) {
        return invalid("Carousel controls must not use the native disabled attribute.");
      }
      if (!hasControlName(control)) return invalid("Carousel controls require an accessible name.");
    }

    const references = new Set<string>();
    addIdReferences(references, this, ["aria-labelledby"]);
    addIdReferences(references, slidesContainer, ["aria-labelledby"]);
    for (const slide of slides) {
      if (slide.getAttribute("role") && slide.getAttribute("role") !== "group") {
        return invalid("A slide has a conflicting authored role.");
      }
      if (slide.hasAttribute("aria-roledescription") && slide.getAttribute("aria-roledescription") !== "slide") {
        return invalid("A slide has a conflicting authored aria-roledescription.");
      }
      if (!hasAuthoredName(slide)) return invalid("Every slide requires aria-label or aria-labelledby.");
      addIdReferences(references, slide, ["aria-labelledby"]);
    }
    addIdReferences(references, previous[0], ["aria-labelledby"]);
    addIdReferences(references, next[0], ["aria-labelledby"]);
    const duplicateError = duplicateIdError(this.ownerDocument, references);
    if (duplicateError) return invalid(duplicateError);
    const missingError = missingIdError(this.ownerDocument, references);
    if (missingError) return invalid(missingError);

    const visible = slides.map((slide, index) => (isVisibleSlide(slide) ? index : -1)).filter((index) => index >= 0);
    let selectedIndex = -1;
    if (previousSlide && slides.includes(previousSlide)) selectedIndex = slides.indexOf(previousSlide);
    else if (visible.length === 1) selectedIndex = visible[0];
    else if (visible.length === 0) selectedIndex = 0;
    else return invalid("Only one slide may be visible at a time.");

    return {
      state: "valid",
      model: {
        slidesContainer,
        slides,
        previous: previous[0],
        next: next[0],
        loop: this.hasAttribute("data-loop"),
        selectedIndex,
      },
    };
  }

  #commit(model: CarouselModel): void {
    this.#bootstrap.stop();
    this.#slidesContainer = model.slidesContainer;
    this.#slides = model.slides;
    this.#previous = model.previous;
    this.#next = model.next;
    this.#loop = model.loop;
    this.setAttribute("role", "group");
    this.setAttribute("aria-roledescription", "carousel");
    this.#slidesContainer.setAttribute("aria-live", "polite");
    for (const slide of this.#slides) {
      slide.setAttribute("role", "group");
      slide.setAttribute("aria-roledescription", "slide");
    }
    this.#selectedIndex = model.selectedIndex;
    this.#render();
    this.#initialized = true;
    this.#bindRuntime();
  }

  #bindRuntime(): void {
    if (this.#abortController) return;
    const controller = new AbortController();
    this.#abortController = controller;
    this.addEventListener("click", this.#onClick, { signal: controller.signal });
  }

  #onClick = (event: MouseEvent): void => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target instanceof Element ? event.target : null;
    const previous = target?.closest("[data-previous]");
    const next = target?.closest("[data-next]");
    if (previous === this.#previous) this.previous();
    else if (next === this.#next) this.next();
  };

  #select(index: number, source: ChangeSource): void {
    if (index < 0 || index >= this.#slides.length || index === this.#selectedIndex) return;
    this.#selectedIndex = index;
    this.#render();
    this.dispatchEvent(new CustomEvent<CarouselChangeDetail>("manner-carousel-change", {
      bubbles: true,
      detail: { index, slide: this.#slides[index], source },
    }));
  }

  #render(): void {
    this.#slides.forEach((slide, index) => {
      if (index === this.#selectedIndex) slide.removeAttribute("hidden");
      else slide.setAttribute("hidden", "");
    });
    const previousDisabled = !this.#loop && this.#selectedIndex === 0;
    const nextDisabled = !this.#loop && this.#selectedIndex === this.#slides.length - 1;
    this.#setAriaDisabled(this.#previous, previousDisabled);
    this.#setAriaDisabled(this.#next, nextDisabled);
  }

  #setAriaDisabled(control: HTMLButtonElement, disabled: boolean): void {
    if (disabled) control.setAttribute("aria-disabled", "true");
    else control.removeAttribute("aria-disabled");
  }
}
