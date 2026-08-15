import { MannerTabs } from "./tabs.js";
import { MannerForm } from "./form.js";
import { MannerCarousel } from "./carousel.js";

declare global {
  interface HTMLElementTagNameMap {
    "manner-tabs": MannerTabs;
    "manner-form": MannerForm;
    "manner-carousel": MannerCarousel;
  }
}

export function register(): void {
  if (typeof customElements !== "undefined" && !customElements.get("manner-tabs")) {
    customElements.define("manner-tabs", MannerTabs);
  }
  if (typeof customElements !== "undefined" && !customElements.get("manner-form")) {
    customElements.define("manner-form", MannerForm);
  }
  if (typeof customElements !== "undefined" && !customElements.get("manner-carousel")) {
    customElements.define("manner-carousel", MannerCarousel);
  }
}

register();
