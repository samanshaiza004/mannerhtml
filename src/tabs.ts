import { edgeIndex, nextIndex, previousIndex } from "./logic.js";

type Profile = "progressive" | "application";
type Activation = "auto" | "manual";
type Orientation = "horizontal" | "vertical";
type ChangeSource = "keyboard" | "pointer" | "programmatic";

export interface TabsChangeDetail {
  index: number;
  tab: HTMLElement;
  panel: HTMLElement;
  source: ChangeSource;
}

interface TabsModel {
  tablist: HTMLElement;
  tabs: HTMLElement[];
  panels: HTMLElement[];
  profile: Profile;
  activation: Activation;
  orientation: Orientation;
  selectedIndex: number;
  tabIds: string[];
  panelIds: string[];
}

const HTMLElementBase: typeof HTMLElement =
  (globalThis as { HTMLElement?: typeof HTMLElement }).HTMLElement ??
  (class {} as typeof HTMLElement);

function describe(host: HTMLElement): string {
  return `<${host.localName || "manner-tabs"}>`;
}

function error(host: HTMLElement, message: string): void {
  console.error(`${describe(host)}: ${message}`, host);
}

function ownedBy(host: HTMLElement, element: Element): boolean {
  return element.closest("manner-tabs") === host;
}

function isElement(value: EventTarget | null): value is Element {
  return value instanceof Element;
}

function randomToken(): string {
  const cryptoObject = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoObject?.randomUUID) return cryptoObject.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

export class MannerTabs extends HTMLElementBase {
  #initialized = false;
  #bootObserver: MutationObserver | null = null;
  #abortController: AbortController | null = null;
  #tablist!: HTMLElement;
  #tabs: HTMLElement[] = [];
  #panels: HTMLElement[] = [];
  #selectedIndex = 0;
  #profile!: Profile;
  #activation!: Activation;
  #orientation!: Orientation;
  #instanceToken = `manner-${randomToken()}`;
  #nextTabId = 0;
  #nextPanelId = 0;
  #tabIds = new WeakMap<HTMLElement, string>();
  #panelIds = new WeakMap<HTMLElement, string>();

  connectedCallback(): void {
    if (this.#initialized) {
      this.#bindRuntime();
      return;
    }

    if (this.#tryUpgrade()) return;

    this.#bootObserver?.disconnect();
    this.#bootObserver = new MutationObserver(() => {
      if (this.#tryUpgrade()) {
        this.#bootObserver?.disconnect();
        this.#bootObserver = null;
      }
    });
    this.#bootObserver.observe(this, { childList: true, subtree: true });
  }

  disconnectedCallback(): void {
    this.#bootObserver?.disconnect();
    this.#bootObserver = null;
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
    if (!Number.isInteger(index) || index < 0 || index >= this.#tabs.length) {
      throw new RangeError(`${describe(this)}: selectedIndex is out of range`);
    }
    this.#select(index, "programmatic");
  }

  refresh(): void {
    const selectedTab = this.#tabs[this.#selectedIndex];
    const model = this.#buildModel(selectedTab);
    if (!model) return;
    this.#commit(model, false);
  }

  #tryUpgrade(): boolean {
    const model = this.#buildModel();
    if (!model) return false;
    this.#commit(model, true);
    return true;
  }

  #discover<T extends Element>(selector: string): T[] {
    return [...this.querySelectorAll<T>(selector)].filter((element) =>
      ownedBy(this, element),
    );
  }

  #buildModel(previousTab?: HTMLElement): TabsModel | null {
    const tablists = this.#discover<HTMLElement>("[data-tablist]");
    const tabs = this.#discover<HTMLElement>("[data-tab]");
    const panels = this.#discover<HTMLElement>("[data-panel]");

    // An empty host can be observed while the parser is still constructing it.
    // Once any contract node exists, validation errors are definitive.
    if (tablists.length === 0 && tabs.length === 0 && panels.length === 0) {
      return null;
    }
    if (tablists.length !== 1) {
      error(this, `Expected exactly one owned [data-tablist]; found ${tablists.length}.`);
      return null;
    }
    if (tabs.length === 0) {
      error(this, "Expected at least one owned [data-tab].");
      return null;
    }
    if (panels.length === 0) {
      error(this, "Expected at least one owned [data-panel].");
      return null;
    }

    const tablist = tablists[0];
    if (
      (!tablist.hasAttribute("aria-label") || !tablist.getAttribute("aria-label")) &&
      (!tablist.hasAttribute("aria-labelledby") || !tablist.getAttribute("aria-labelledby"))
    ) {
      error(this, "The owned tablist requires aria-label or aria-labelledby.");
      return null;
    }
    if (tablist.hasAttribute("role") && tablist.getAttribute("role") !== "tablist") {
      error(this, "The tablist has a conflicting authored role.");
      return null;
    }

    const allAnchors = tabs.every((tab) => tab.localName === "a");
    const allButtons = tabs.every((tab) => tab.localName === "button");
    if (!allAnchors && !allButtons) {
      error(this, "Tabs must be all <a> or all <button>; mixed or other elements are invalid.");
      return null;
    }
    const profile: Profile = allAnchors ? "progressive" : "application";
    if (profile === "application" && tabs.length !== panels.length) {
      error(this, `Application tabs require equal tab/panel counts; found ${tabs.length} and ${panels.length}.`);
      return null;
    }

    const activation = this.getAttribute("data-activation") || "auto";
    if (activation !== "auto" && activation !== "manual") {
      error(this, `Unsupported data-activation value "${activation}".`);
      return null;
    }
    const dataOrientation = this.getAttribute("data-orientation");
    const configuredOrientation = dataOrientation || tablist.getAttribute("aria-orientation") || "horizontal";
    if (configuredOrientation !== "horizontal" && configuredOrientation !== "vertical") {
      error(this, `Unsupported data-orientation value "${configuredOrientation}".`);
      return null;
    }
    const authoredOrientation = tablist.getAttribute("aria-orientation");
    if (authoredOrientation && authoredOrientation !== "horizontal" && authoredOrientation !== "vertical") {
      error(this, `Unsupported authored aria-orientation value "${authoredOrientation}".`);
      return null;
    }
    if (dataOrientation && authoredOrientation && authoredOrientation !== dataOrientation) {
      error(this, "data-orientation and authored aria-orientation disagree.");
      return null;
    }
    const orientation = (authoredOrientation || configuredOrientation) as Orientation;

    for (const tab of tabs) {
      if (tab.hasAttribute("disabled") || tab.getAttribute("aria-disabled") === "true") {
        error(this, "Disabled tabs are not supported in v0.1.");
        return null;
      }
      if (tab.getAttribute("role") && tab.getAttribute("role") !== "tab") {
        error(this, "A tab has a conflicting authored role.");
        return null;
      }
      const authoredSelected = tab.getAttribute("aria-selected");
      if (authoredSelected && authoredSelected !== "true" && authoredSelected !== "false") {
        error(this, "aria-selected must be true or false when authored.");
        return null;
      }
    }
    for (const panel of panels) {
      if (panel.getAttribute("role") && panel.getAttribute("role") !== "tabpanel") {
        error(this, "A panel has a conflicting authored role.");
        return null;
      }
      if (panel.hasAttribute("aria-labelledby") && !panel.getAttribute("aria-labelledby")) {
        error(this, "A panel has an empty authored aria-labelledby.");
        return null;
      }
    }

    const tabIds: string[] = [];
    const panelIds: string[] = [];
    const panelSet = new Set(panels);
    for (let index = 0; index < tabs.length; index += 1) {
      const tab = tabs[index];
      let panel: HTMLElement | undefined;
      if (profile === "progressive") {
        const href = tab.getAttribute("href");
        if (!href || !/^#[^#/?]+$/.test(href)) {
          error(this, "Progressive tabs require fragment-only href values such as #panel-id.");
          return null;
        }
        const candidate = this.ownerDocument?.getElementById(href.slice(1));
        if (!(candidate instanceof HTMLElement) || !panelSet.has(candidate)) {
          error(this, `Tab href="${href}" targets a panel outside this tabs instance.`);
          return null;
        }
        panel = candidate;
      } else {
        panel = panels[index];
      }
      if (!panel) return null;
      const panelId = this.#stableId(panel, "panel", panel.id);
      const tabId = this.#stableId(tab, "tab", tab.id);
      if (tab.hasAttribute("aria-controls") && tab.getAttribute("aria-controls") !== panelId) {
        error(this, "An authored aria-controls does not match the associated panel.");
        return null;
      }
      if (panel.hasAttribute("aria-labelledby") && panel.getAttribute("aria-labelledby") !== tabId) {
        error(this, "An authored aria-labelledby does not match the associated tab.");
        return null;
      }
      tabIds[index] = tabId;
      panelIds[index] = panelId;
    }

    const mappedPanels = tabs.map((tab, index) => {
      if (profile === "application") return panels[index];
      const href = tab.getAttribute("href")!;
      return this.ownerDocument?.getElementById(href.slice(1)) as HTMLElement;
    });
    if (new Set(mappedPanels).size !== panels.length || mappedPanels.some((panel) => !panelSet.has(panel))) {
      error(this, "Every panel must be mapped to exactly one tab.");
      return null;
    }

    const explicit = tabs
      .map((tab, index) => (tab.hasAttribute("data-selected") || tab.getAttribute("aria-selected") === "true" ? index : -1))
      .filter((index) => index >= 0);
    if (explicit.length > 1) {
      error(this, "Only one tab may be explicitly selected.");
      return null;
    }
    let selectedIndex = explicit[0] ?? -1;
    if (selectedIndex < 0 && previousTab) selectedIndex = tabs.indexOf(previousTab);
    if (selectedIndex < 0 && profile === "progressive" && this.ownerDocument?.location.hash) {
      const hash = this.ownerDocument.location.hash;
      selectedIndex = tabs.findIndex((tab) => tab.getAttribute("href") === hash);
    }
    if (selectedIndex < 0) selectedIndex = 0;
    return { tablist, tabs, panels: mappedPanels, profile, activation: activation as Activation, orientation, selectedIndex, tabIds, panelIds };
  }

  #stableId(element: HTMLElement, kind: "tab" | "panel", authoredId: string | null): string {
    const cache = kind === "tab" ? this.#tabIds : this.#panelIds;
    const existing = cache.get(element);
    if (existing) return existing;
    if (authoredId) {
      cache.set(element, authoredId);
      return authoredId;
    }
    let candidate = `${this.#instanceToken}-${kind}-${kind === "tab" ? this.#nextTabId++ : this.#nextPanelId++}`;
    let suffix = 0;
    while (this.ownerDocument?.getElementById(candidate)) {
      candidate = `${this.#instanceToken}-${kind}-${kind === "tab" ? this.#nextTabId++ : this.#nextPanelId++}-${suffix++}`;
    }
    cache.set(element, candidate);
    return candidate;
  }

  #commit(model: TabsModel, initial: boolean): void {
    this.#bootObserver?.disconnect();
    this.#bootObserver = null;
    this.#tablist = model.tablist;
    this.#tabs = model.tabs;
    this.#panels = model.panels;
    this.#profile = model.profile;
    this.#activation = model.activation;
    this.#orientation = model.orientation;
    this.#tabs.forEach((tab, index) => tab.id = tab.id || model.tabIds[index]);
    this.#panels.forEach((panel, index) => panel.id = panel.id || model.panelIds[index]);
    this.#tablist.setAttribute("role", "tablist");
    if (this.#orientation === "vertical") this.#tablist.setAttribute("aria-orientation", "vertical");
    this.#tabs.forEach((tab, index) => {
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", this.#panels[index].id);
      tab.setAttribute("aria-selected", String(index === model.selectedIndex));
      tab.tabIndex = index === model.selectedIndex ? 0 : -1;
    });
    this.#panels.forEach((panel, index) => {
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", this.#tabs[index].id);
      if (!panel.hasAttribute("tabindex")) panel.tabIndex = 0;
      panel.hidden = index !== model.selectedIndex;
    });
    this.#selectedIndex = model.selectedIndex;
    this.#initialized = true;
    this.#bindRuntime();
    void initial;
  }

  #bindRuntime(): void {
    if (this.#abortController) return;
    const controller = new AbortController();
    this.#abortController = controller;
    this.addEventListener("click", this.#onClick, { signal: controller.signal });
    this.addEventListener("keydown", this.#onKeyDown, { signal: controller.signal });
  }

  #tabFromTarget(target: EventTarget | null): HTMLElement | null {
    if (!isElement(target)) return null;
    const tab = target.closest<HTMLElement>("[data-tab]");
    return tab && this.#tabs.includes(tab) && ownedBy(this, tab) ? tab : null;
  }

  #onClick = (event: MouseEvent): void => {
    const tab = this.#tabFromTarget(event.target);
    if (!tab || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (this.#profile === "progressive") event.preventDefault();
    this.#select(this.#tabs.indexOf(tab), "pointer");
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    const tab = this.#tabFromTarget(event.target);
    if (!tab) return;
    const index = this.#tabs.indexOf(tab);
    let next = -1;
    if (event.key === "Home") next = edgeIndex("first", this.#tabs.length);
    else if (event.key === "End") next = edgeIndex("last", this.#tabs.length);
    else if (this.#orientation === "horizontal" && event.key === "ArrowRight") next = nextIndex(index, this.#tabs.length);
    else if (this.#orientation === "horizontal" && event.key === "ArrowLeft") next = previousIndex(index, this.#tabs.length);
    else if (this.#orientation === "vertical" && event.key === "ArrowDown") next = nextIndex(index, this.#tabs.length);
    else if (this.#orientation === "vertical" && event.key === "ArrowUp") next = previousIndex(index, this.#tabs.length);
    else if (this.#activation === "manual" && (event.key === "Enter" || event.key === " " || event.key === "Spacebar")) {
      event.preventDefault();
      this.#select(index, "keyboard");
      return;
    }
    if (next < 0) return;
    event.preventDefault();
    this.#tabs[next].focus();
    if (this.#activation === "auto") this.#select(next, "keyboard");
  };

  #select(index: number, source: ChangeSource): void {
    if (index < 0 || index >= this.#tabs.length || index === this.#selectedIndex) return;
    this.#selectedIndex = index;
    this.#tabs.forEach((tab, current) => {
      tab.setAttribute("aria-selected", String(current === index));
      tab.tabIndex = current === index ? 0 : -1;
    });
    this.#panels.forEach((panel, current) => { panel.hidden = current !== index; });
    this.dispatchEvent(new CustomEvent<TabsChangeDetail>("manner-tabs-change", {
      bubbles: true,
      detail: { index, tab: this.#tabs[index], panel: this.#panels[index], source },
    }));
  }
}
