type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement;

interface FormModel {
  form: HTMLFormElement;
  controls: FormControl[];
  summaries: HTMLElement[];
  errors: HTMLElement[];
  summaryItems: HTMLElement[];
}

type ModelResult =
  | { state: "pending" }
  | { state: "invalid" }
  | { state: "valid"; model: FormModel };

const HTMLElementBase: typeof HTMLElement =
  (globalThis as { HTMLElement?: typeof HTMLElement }).HTMLElement ??
  (class {} as typeof HTMLElement);

function describe(host: HTMLElement): string {
  return `<${host.localName || "manner-form"}>`;
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
      current instanceof MannerForm ||
      registered === MannerForm ||
      (registered && registered.prototype instanceof MannerForm)
    ) return false;
    current = current.parentElement;
  }
  return false;
}

function isFormControl(element: Element): element is FormControl {
  return (
    (element.localName === "input" ||
      element.localName === "select" ||
      element.localName === "textarea" ||
      element.localName === "button") &&
    "willValidate" in element &&
    "validity" in element
  );
}

export class MannerForm extends HTMLElementBase {
  #initialized = false;
  #bootObserver: MutationObserver | null = null;
  #bootTimer: ReturnType<typeof setTimeout> | null = null;
  #bootController: AbortController | null = null;
  #abortController: AbortController | null = null;
  #form!: HTMLFormElement;
  #controls: FormControl[] = [];
  #summaries: HTMLElement[] = [];
  #errors: HTMLElement[] = [];
  #summaryItems: HTMLElement[] = [];
  #activeInvalid = new Set<FormControl>();
  #originalNoValidate = false;
  #originalDescribedBy = new WeakMap<HTMLElement, { present: boolean; value: string }>();
  #originalAriaInvalid = new WeakMap<HTMLElement, { present: boolean; value: string }>();

  connectedCallback(): void {
    if (this.#initialized) {
      this.#form.noValidate = true;
      this.#bindRuntime();
      return;
    }
    const result = this.#tryUpgrade();
    if (result.state !== "pending") return;
    this.#bootObserver?.disconnect();
    this.#bootController?.abort();
    const controller = new AbortController();
    this.#bootController = controller;
    this.#bootObserver = new MutationObserver(() => this.#tryUpgrade());
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
    this.#stopBootstrap();
    this.#abortController?.abort();
    this.#abortController = null;
    if (this.#form) this.#form.noValidate = this.#originalNoValidate;
  }

  refresh(): void {
    const result = this.#buildModel(true);
    if (result.state === "valid") this.#commit(result.model);
  }

  validate(): boolean {
    if (!this.#form) throw new Error(`${describe(this)} is not upgraded`);
    const valid = this.#form.checkValidity();
    this.#syncAll();
    return valid;
  }

  #onDOMContentLoaded = (): void => {
    this.#tryUpgrade(true);
  };

  #tryUpgrade(finalize = false): ModelResult {
    const result = this.#buildModel(finalize);
    if (result.state === "valid") this.#commit(result.model);
    else if (result.state === "invalid") this.#stopBootstrap();
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
    return [...this.querySelectorAll<T>(selector)].filter((element) => ownedBy(this, element));
  }

  #buildModel(finalize: boolean): ModelResult {
    const forms = this.#discover<HTMLFormElement>("form");
    const summaries = this.#discover<HTMLElement>("[data-error-summary]");
    const errors = this.#discover<HTMLElement>("[data-error-for]");
    const summaryItems = this.#discover<HTMLElement>("[data-summary-for]");
    const invalid = (message: string): ModelResult => {
      error(this, message);
      return { state: "invalid" };
    };
    if (!finalize && (this.ownerDocument?.readyState === "loading" || forms.length === 0)) {
      return { state: "pending" };
    }
    if (forms.length !== 1) return invalid(`Expected exactly one owned <form>; found ${forms.length}.`);
    const form = forms[0];
    const controls = [...form.elements]
      .filter((element): element is FormControl => isFormControl(element))
      .filter((element) => element.form === form && ownedBy(this, element));
    const focusMode = this.getAttribute("data-error-focus") || "first";
    if (focusMode !== "first") return invalid(`Unsupported data-error-focus value "${focusMode}".`);
    for (const control of controls) {
      const authored = control.getAttribute("aria-invalid");
      if (authored && authored !== "true" && authored !== "false") {
        return invalid("A form control has an invalid authored aria-invalid value.");
      }
    }
    const controlById = new Map<string, FormControl>();
    for (const control of controls) {
      if (control.id && controlById.has(control.id)) return invalid(`Duplicate owned control id "${control.id}".`);
      if (control.id) controlById.set(control.id, control);
    }
    for (const node of errors) {
      const targetId = node.getAttribute("data-error-for") || "";
      if (!/^\S+$/.test(targetId) || !controlById.has(targetId)) {
        return invalid(`An error node references missing control "${targetId}".`);
      }
      if (!node.id) return invalid("Every [data-error-for] node requires an authored id.");
    }
    for (const node of summaryItems) {
      const targetId = node.getAttribute("data-summary-for") || "";
      if (!/^\S+$/.test(targetId) || !controlById.has(targetId)) {
        return invalid(`A summary node references missing control "${targetId}".`);
      }
    }
    const relevantIds = new Set<string>();
    for (const control of controls) {
      if (control.id) relevantIds.add(control.id);
      for (const id of (control.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean)) {
        relevantIds.add(id);
      }
    }
    for (const node of errors) relevantIds.add(node.id);
    const documentIds = [...(this.ownerDocument?.querySelectorAll<HTMLElement>("[id]") || [])];
    for (const id of relevantIds) {
      if (documentIds.filter((element) => element.id === id).length > 1) {
        return invalid(`Duplicate authored id "${id}" would make an error relationship ambiguous.`);
      }
    }
    return { state: "valid", model: { form, controls, summaries, errors, summaryItems } };
  }

  #commit(model: FormModel): void {
    this.#stopBootstrap();
    const formChanged = this.#form !== model.form;
    if (formChanged && this.#form) {
      this.#abortController?.abort();
      this.#abortController = null;
      this.#form.noValidate = this.#originalNoValidate;
    }
    this.#form = model.form;
    this.#controls = model.controls;
    this.#summaries = model.summaries;
    this.#errors = model.errors;
    this.#summaryItems = model.summaryItems;
    if (formChanged) this.#originalNoValidate = this.#form.noValidate;
    for (const control of this.#controls) {
      if (!this.#originalDescribedBy.has(control)) {
        this.#originalDescribedBy.set(control, {
          present: control.hasAttribute("aria-describedby"),
          value: control.getAttribute("aria-describedby") || "",
        });
        this.#originalAriaInvalid.set(control, {
          present: control.hasAttribute("aria-invalid"),
          value: control.getAttribute("aria-invalid") || "",
        });
      }
    }
    this.#activeInvalid = new Set(this.#controls.filter((control) => this.#activeInvalid.has(control)));
    this.#form.noValidate = true;
    this.#initialized = true;
    this.#hideInactivePresentation();
    for (const control of this.#activeInvalid) this.#syncControl(control);
    this.#updateSummary();
    this.#bindRuntime();
  }

  #bindRuntime(): void {
    if (this.#abortController) return;
    const controller = new AbortController();
    this.#abortController = controller;
    this.#form.addEventListener("submit", this.#onSubmit, { signal: controller.signal });
    this.#form.addEventListener("invalid", this.#onInvalid, { capture: true, signal: controller.signal });
    this.#form.addEventListener("input", this.#onInput, { signal: controller.signal });
    this.#form.addEventListener("change", this.#onInput, { signal: controller.signal });
  }

  #controlFromTarget(target: EventTarget | null): FormControl | null {
    if (!(target instanceof Element) || !isFormControl(target)) return null;
    return this.#controls.includes(target) && target.form === this.#form ? target : null;
  }

  #onSubmit = (event: SubmitEvent): void => {
    if (this.#form.checkValidity()) {
      this.#syncAll();
      return;
    }
    event.preventDefault();
    this.#syncAll();
    const firstInvalid = this.#controls.find((control) => control.willValidate && !control.validity.valid);
    firstInvalid?.focus({ preventScroll: true });
  };

  #onInvalid = (event: Event): void => {
    const control = this.#controlFromTarget(event.target);
    if (control) this.#syncControl(control);
  };

  #onInput = (event: Event): void => {
    const control = this.#controlFromTarget(event.target);
    if (!control) return;
    if (this.#activeInvalid.has(control) || control.validity.valid) this.#syncControl(control);
  };

  #syncAll(): void {
    for (const control of this.#controls) this.#syncControl(control);
    this.#updateSummary();
  }

  #syncControl(control: FormControl): void {
    if (!control.willValidate || control.validity.valid) {
      this.#activeInvalid.delete(control);
      this.#restoreControl(control);
      this.#setPresentation(control.id, false);
    } else {
      this.#activeInvalid.add(control);
      control.setAttribute("aria-invalid", "true");
      this.#setPresentation(control.id, true);
    }
    this.#updateSummary();
  }

  #restoreControl(control: FormControl): void {
    const describedBy = this.#originalDescribedBy.get(control);
    if (describedBy?.present) control.setAttribute("aria-describedby", describedBy.value);
    else control.removeAttribute("aria-describedby");
    const ariaInvalid = this.#originalAriaInvalid.get(control);
    if (ariaInvalid?.present) control.setAttribute("aria-invalid", ariaInvalid.value);
    else control.removeAttribute("aria-invalid");
  }

  #setPresentation(controlId: string, visible: boolean): void {
    if (!controlId) return;
    const errors = this.#errors.filter((node) => node.getAttribute("data-error-for") === controlId);
    const summaryItems = this.#summaryItems.filter((node) => node.getAttribute("data-summary-for") === controlId);
    for (const node of errors) node.hidden = !visible;
    for (const node of summaryItems) node.hidden = !visible;
    const control = this.#controls.find((candidate) => candidate.id === controlId);
    const original = control ? this.#originalDescribedBy.get(control) : undefined;
    if (!control || !original || !visible) return;
    const ids = [original.value, ...errors.map((node) => node.id)].join(" ").split(/\s+/).filter(Boolean);
    control.setAttribute("aria-describedby", [...new Set(ids)].join(" "));
  }

  #hideInactivePresentation(): void {
    for (const node of this.#errors) node.hidden = true;
    for (const node of this.#summaryItems) node.hidden = true;
    for (const control of this.#controls) {
      if (!this.#activeInvalid.has(control)) this.#restoreControl(control);
    }
  }

  #updateSummary(): void {
    const visibleIds = new Set(
      [...this.#activeInvalid]
        .filter((control) => control.id && this.#summaryItems.some((node) => node.getAttribute("data-summary-for") === control.id))
        .map((control) => control.id),
    );
    for (const summary of this.#summaries) summary.hidden = visibleIds.size === 0;
  }
}
