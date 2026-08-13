import { MannerTabs } from "./tabs.js";
import { MannerForm } from "./form.js";

declare global {
  interface HTMLElementTagNameMap {
    "manner-tabs": MannerTabs;
    "manner-form": MannerForm;
  }
}

export function register(): void {
  if (typeof customElements !== "undefined" && !customElements.get("manner-tabs")) {
    customElements.define("manner-tabs", MannerTabs);
  }
  if (typeof customElements !== "undefined" && !customElements.get("manner-form")) {
    customElements.define("manner-form", MannerForm);
  }
}

register();
