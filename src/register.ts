import { MannerTabs } from "./tabs.js";

export function register(): void {
  if (typeof customElements !== "undefined" && !customElements.get("manner-tabs")) {
    customElements.define("manner-tabs", MannerTabs);
  }
}

register();
