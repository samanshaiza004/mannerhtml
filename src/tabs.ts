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

type ModelResult =
  | { state: "pending" }
  | { state: "invalid" }
  | { state: "valid"; model: TabsModel };

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
  let current: Element | null = element;
  while (current) {
    if (current === host) return true;
    const registered = globalThis.customElements?.get(current.localName);
    if (
      current instanceof MannerTabs ||
      registered === MannerTabs ||
      (registered && registered.prototype instanceof MannerTabs)
    ) return false;
    current = current.parentElement;
  }
  return false;
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
  #bootTimer: ReturnType<typeof setTimeout> | null = null;
  #bootController: AbortController | null = null;
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

    const result = this.#tryUpgrade();
    if (result.state !== "pending") return;

    this.#bootObserver?.disconnect();
    this.#bootController?.abort();
    const controller = new AbortController();
    this.#bootController = controller;
    this.#bootObserver = new MutationObserver(() => {
      this.#tryUpgrade();
    });
    this.#bootObserver.observe(this, { childList: true, subtree: true });
    this.#bootTimer = setTimeout(() => {
      this.#bootTimer = null;
      this.#tryUpgrade(this.ownerDocument?.readyState !== "loading");
    }, 0);
    this.ownerDocument?.addEventListener("DOMContentLoaded", this.#onDOMContentLoaded, {
      once: true,
      signal: controller.signal,
    });
  }

  disconnectedCallback(): void {
    this.#bootObserver?.disconnect();
    this.#bootObserver = null;
    if (this.#bootTimer !== null) clearTimeout(this.#bootTimer);
    this.#bootTimer = null;
    this.#bootController?.abort();
    this.#bootController = null;
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
    const result = this.#buildModel(selectedTab, true);
    if (result.state !== "valid") return;
    this.#commit(result.model, false);
  }

  #onDOMContentLoaded = (): void => {
    this.#tryUpgrade(true);
  };

  #tryUpgrade(finalize = false): ModelResult {
    const result = this.#buildModel(undefined, finalize);
    if (result.state === "valid") {
      this.#commit(result.model, true);
    } else if (result.state === "invalid") {
      this.#stopBootstrap();
    }
    return result;
  }

  #stopBootstrap(): void {
    this.#bootObserver?.disconnect();
    this.#bootObserver = null;
    if (this.#bootTimer !== null) clearTimeout(this.#bootTimer);
    this.#bootTimer = null;
    this.#bootController?.abort();
    this.#bootController = null;
  }

  #discover<T extends Element>(selector: string): T[] {
    return [...this.querySelectorAll<T>(selector)].filter((element) =>
      ownedBy(this, element),
    );
  }

  #buildModel(previousTab?: HTMLElement, finalize = false): ModelResult {
    const tablists = this.#discover<HTMLElement>("[data-tablist]");
    const tabs = this.#discover<HTMLElement>("[data-tab]");
    const panels = this.#discover<HTMLElement>("[data-panel]");

    const invalid = (message: string): ModelResult => {
      error(this, message);
      return { state: "invalid" };
    };

    // A parser can call connectedCallback before all descendants exist. Keep
    // that state distinct from a malformed, fully constructed instance and
    // defer the final decision until parsing has left the loading state.
    if (
      !finalize &&
      (this.ownerDocument?.readyState === "loading" ||
        tablists.length === 0 || tabs.length === 0 || panels.length === 0)
    ) {
      return { state: "pending" };
    }
    if (tablists.length !== 1) {
      return invalid(`Expected exactly one owned [data-tablist]; found ${tablists.length}.`);
    }
    if (tabs.length === 0) {
      return invalid("Expected at least one owned [data-tab].");
    }
    if (panels.length === 0) {
      return invalid("Expected at least one owned [data-panel].");
    }

    const tablist = tablists[0];
    if (
      (!tablist.hasAttribute("aria-label") || !tablist.getAttribute("aria-label")) &&
      (!tablist.hasAttribute("aria-labelledby") || !tablist.getAttribute("aria-labelledby"))
    ) {
      return invalid("The owned tablist requires aria-label or aria-labelledby.");
    }
    if (tablist.hasAttribute("role") && tablist.getAttribute("role") !== "tablist") {
      return invalid("The tablist has a conflicting authored role.");
    }

    const allAnchors = tabs.every((tab) => tab.localName === "a");
    const allButtons = tabs.every((tab) => tab.localName === "button");
    if (!allAnchors && !allButtons) {
      return invalid("Tabs must be all <a> or all <button>; mixed or other elements are invalid.");
    }
    const profile: Profile = allAnchors ? "progressive" : "application";
    if (profile === "application" && tabs.length !== panels.length) {
      return invalid(`Application tabs require equal tab/panel counts; found ${tabs.length} and ${panels.length}.`);
    }

    const activation = this.getAttribute("data-activation") || "auto";
    if (activation !== "auto" && activation !== "manual") {
      return invalid(`Unsupported data-activation value "${activation}".`);
    }
    const dataOrientation = this.getAttribute("data-orientation");
    const configuredOrientation = dataOrientation || tablist.getAttribute("aria-orientation") || "horizontal";
    if (configuredOrientation !== "horizontal" && configuredOrientation !== "vertical") {
      return invalid(`Unsupported data-orientation value "${configuredOrientation}".`);
    }
    const authoredOrientation = tablist.getAttribute("aria-orientation");
    if (authoredOrientation && authoredOrientation !== "horizontal" && authoredOrientation !== "vertical") {
      return invalid(`Unsupported authored aria-orientation value "${authoredOrientation}".`);
    }
    if (dataOrientation && authoredOrientation && authoredOrientation !== dataOrientation) {
      return invalid("data-orientation and authored aria-orientation disagree.");
    }
    const orientation = (authoredOrientation || configuredOrientation) as Orientation;

    for (const tab of tabs) {
      if (tab.hasAttribute("disabled") || tab.getAttribute("aria-disabled") === "true") {
        return invalid("Disabled tabs are not supported in v0.1.");
      }
      if (tab.getAttribute("role") && tab.getAttribute("role") !== "tab") {
        return invalid("A tab has a conflicting authored role.");
      }
      const authoredSelected = tab.getAttribute("aria-selected");
      if (authoredSelected && authoredSelected !== "true" && authoredSelected !== "false") {
        return invalid("aria-selected must be true or false when authored.");
      }
    }
    for (const panel of panels) {
      if (panel.getAttribute("role") && panel.getAttribute("role") !== "tabpanel") {
        return invalid("A panel has a conflicting authored role.");
      }
      if (panel.hasAttribute("aria-labelledby") && !panel.getAttribute("aria-labelledby")) {
        return invalid("A panel has an empty authored aria-labelledby.");
      }
    }

    const relevantIds = new Set<string>();
    for (const element of [...tabs, ...panels]) {
      if (element.id) relevantIds.add(element.id);
      for (const attribute of ["aria-controls", "aria-labelledby"]) {
        for (const id of (element.getAttribute(attribute) || "").split(/\s+/).filter(Boolean)) {
          relevantIds.add(id);
        }
      }
    }
    for (const id of (tablist.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean)) {
      relevantIds.add(id);
    }
    const documentIds = [...(this.ownerDocument?.querySelectorAll<HTMLElement>("[id]") || [])];
    for (const id of relevantIds) {
      const matches = documentIds.filter((element) => element.id === id);
      if (matches.length > 1) {
        return invalid(`Duplicate authored id "${id}" would make an accessibility relationship ambiguous.`);
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
          return invalid("Progressive tabs require fragment-only href values such as #panel-id.");
        }
        const candidate = this.ownerDocument?.getElementById(href.slice(1));
        if (!(candidate instanceof HTMLElement) || !panelSet.has(candidate)) {
          if (!finalize) return { state: "pending" };
          return invalid(`Tab href="${href}" targets a panel outside this tabs instance.`);
        }
        panel = candidate;
      } else {
        panel = panels[index];
      }
      if (!panel) return invalid("A tab could not be paired with a panel.");
      const panelId = this.#stableId(panel, "panel", panel.id);
      const tabId = this.#stableId(tab, "tab", tab.id);
      if (tab.hasAttribute("aria-controls") && tab.getAttribute("aria-controls") !== panelId) {
        return invalid("An authored aria-controls does not match the associated panel.");
      }
      if (panel.hasAttribute("aria-labelledby") && panel.getAttribute("aria-labelledby") !== tabId) {
        return invalid("An authored aria-labelledby does not match the associated tab.");
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
      return invalid("Every panel must be mapped to exactly one tab.");
    }

    const explicit = tabs
      .map((tab, index) => (tab.hasAttribute("data-selected") || tab.getAttribute("aria-selected") === "true" ? index : -1))
      .filter((index) => index >= 0);
    if (explicit.length > 1) {
      return invalid("Only one tab may be explicitly selected.");
    }
    let selectedIndex = explicit[0] ?? -1;
    if (selectedIndex < 0 && previousTab) selectedIndex = tabs.indexOf(previousTab);
    if (selectedIndex < 0 && profile === "progressive" && this.ownerDocument?.location.hash) {
      const hash = this.ownerDocument.location.hash;
      selectedIndex = tabs.findIndex((tab) => tab.getAttribute("href") === hash);
    }
    if (selectedIndex < 0) selectedIndex = 0;
    return { state: "valid", model: { tablist, tabs, panels: mappedPanels, profile, activation: activation as Activation, orientation, selectedIndex, tabIds, panelIds } };
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
    this.#stopBootstrap();
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
