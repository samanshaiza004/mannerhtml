type ElementConstructor = new (...args: any[]) => HTMLElement;

export type BootstrapState = "pending" | "valid" | "invalid";

export class BootstrapController {
  #observer: MutationObserver | null = null;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #controller: AbortController | null = null;

  start(host: HTMLElement, retry: (finalize: boolean) => void): void {
    this.stop();
    const controller = new AbortController();
    this.#controller = controller;
    this.#observer = new MutationObserver(() => retry(false));
    this.#observer.observe(host, { childList: true, subtree: true });
    this.#timer = setTimeout(() => {
      this.#timer = null;
      retry(host.ownerDocument?.readyState !== "loading");
    }, 0);
    host.ownerDocument?.addEventListener("DOMContentLoaded", () => retry(true), {
      once: true,
      signal: controller.signal,
    });
  }

  stop(): void {
    this.#observer?.disconnect();
    this.#observer = null;
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
    this.#controller?.abort();
    this.#controller = null;
  }
}

export function ownedBy(
  host: HTMLElement,
  element: Element,
  baseClass: ElementConstructor,
): boolean {
  let current: Element | null = element;
  while (current) {
    if (current === host) return true;
    const registered = globalThis.customElements?.get(current.localName);
    if (
      current instanceof baseClass ||
      registered === baseClass ||
      (registered && registered.prototype instanceof baseClass)
    ) return false;
    current = current.parentElement;
  }
  return false;
}

export function discoverOwned<T extends Element>(
  host: HTMLElement,
  selector: string,
  baseClass: ElementConstructor,
): T[] {
  return [...host.querySelectorAll<T>(selector)].filter((element) =>
    ownedBy(host, element, baseClass),
  );
}

export function idTokens(value: string | null): string[] {
  return (value || "").split(/\s+/).filter(Boolean);
}

export function addIdReferences(
  references: Set<string>,
  element: Element,
  attributes: readonly string[],
): void {
  if (element.id) references.add(element.id);
  for (const attribute of attributes) {
    for (const id of idTokens(element.getAttribute(attribute))) references.add(id);
  }
}

export function duplicateIdError(
  document: Document | undefined,
  references: Iterable<string>,
): string | null {
  if (!document) return null;
  const counts = new Map<string, number>();
  for (const element of document.querySelectorAll<HTMLElement>("[id]")) {
    counts.set(element.id, (counts.get(element.id) || 0) + 1);
  }
  for (const id of references) {
    if ((counts.get(id) || 0) > 1) {
      return `Duplicate authored id "${id}" would make an accessibility relationship ambiguous.`;
    }
  }
  return null;
}

export function missingIdError(
  document: Document | undefined,
  references: Iterable<string>,
): string | null {
  if (!document) return null;
  for (const id of references) {
    if (!document.getElementById(id)) return `An accessibility relationship references missing id "${id}".`;
  }
  return null;
}

export function describe(host: HTMLElement, fallback: string): string {
  return `<${host.localName || fallback}>`;
}

export function reportError(host: HTMLElement, fallback: string, message: string): void {
  console.error(`${describe(host, fallback)}: ${message}`, host);
}
