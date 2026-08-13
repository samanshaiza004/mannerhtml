import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const progressive = `
  <manner-tabs id="tabs">
    <nav data-tablist aria-label="Sections">
      <a data-tab href="#one">One</a>
      <a data-tab href="#two">Two</a>
      <a data-tab href="#three">Three</a>
    </nav>
    <section id="one" data-panel>One panel</section>
    <section id="two" data-panel>Two panel</section>
    <section id="three" data-panel>Three panel</section>
  </manner-tabs>`;

const application = `
  <manner-tabs id="tabs">
    <div data-tablist aria-label="Settings">
      <button type="button" data-tab>General</button>
      <button type="button" data-tab>Privacy</button>
      <button type="button" data-tab>Notifications</button>
    </div>
    <section data-panel>General panel</section>
    <section data-panel>Privacy panel</section>
    <section data-panel>Notifications panel</section>
  </manner-tabs>`;

async function loadFixture(page, markup, hash = "") {
  await page.goto(`/tests/browser/fixture.html${hash}`);
  await page.locator("#app").evaluate((app, html) => { app.innerHTML = html; }, markup);
  await page.locator("manner-tabs").waitFor();
  await expect.poll(() => page.locator("[data-tablist]").getAttribute("role"), { timeout: 15_000 }).toBe("tablist");
}

test.describe("profiles and selection", () => {
  test("progressive and application profiles normalize author-owned markup", async ({ page }) => {
    await loadFixture(page, progressive);
    await expect(page.locator("[data-tab]" ).first()).toHaveAttribute("role", "tab");
    await expect(page.locator("[data-panel]" ).nth(1)).toHaveAttribute("hidden", "");
    await expect(page.locator("[data-panel]" ).first()).not.toHaveAttribute("hidden");

    await loadFixture(page, application);
    await expect(page.locator("[data-tablist]")).toHaveAttribute("role", "tablist");
    await expect(page.locator("[data-tab]")).toHaveCount(3);
    await expect(page.locator("[data-panel][hidden]")).toHaveCount(2);
  });

  test("hash selects the matching progressive tab without rewriting the URL", async ({ page }) => {
    await loadFixture(page, progressive, "#two");
    await expect(page.locator("#tabs")).toHaveJSProperty("selectedIndex", 1);
    await expect(page).toHaveURL(/#two$/);
  });

  test("ARIA snapshot exposes the tablist and selected tab", async ({ page }) => {
    await loadFixture(page, progressive);
    await expect(page.locator("[data-tablist]")).toMatchAriaSnapshot(`
- tablist "Sections":
  - tab "One" [selected]
  - tab "Two"
  - tab "Three"
`);
  });

  test("generated IDs are stable and authored IDs are preserved through refresh", async ({ page }) => {
    await loadFixture(page, application);
    const before = await page.locator("[data-tab], [data-panel]").evaluateAll((nodes) => nodes.map((node) => node.id));
    expect(before.every(Boolean)).toBe(true);
    await page.locator("#tabs").evaluate((tabs) => tabs.refresh());
    const after = await page.locator("[data-tab], [data-panel]").evaluateAll((nodes) => nodes.map((node) => node.id));
    expect(after).toEqual(before);

    await loadFixture(page, progressive);
    await expect(page.locator("#one")).toHaveAttribute("id", "one");
    await expect(page.locator("[data-tab]").first()).toHaveAttribute("aria-controls", "one");
  });

  test("only panels without focusable content receive a tab stop", async ({ page }) => {
    await loadFixture(page, progressive.replace(
      '<section id="one" data-panel>One panel</section>',
      '<section id="one" data-panel><a href="/events">Event</a></section>',
    ));
    await expect(page.locator("#one")).not.toHaveAttribute("tabindex");
    await expect(page.locator("#two")).toHaveAttribute("tabindex", "0");
  });

  test("refresh removes only library-owned tab stops", async ({ page }) => {
    await loadFixture(page, application);
    await page.locator("#tabs").evaluate((tabs) => {
      const panel = tabs.querySelector("[data-panel]");
      panel.innerHTML = '<a href="/settings">Settings</a>';
      tabs.refresh();
    });
    await expect(page.locator("[data-panel]").first()).not.toHaveAttribute("tabindex");
  });

  test("refresh preserves authored tabindex changes", async ({ page }) => {
    await loadFixture(page, application);
    await page.locator("#tabs").evaluate((tabs) => {
      const panel = tabs.querySelector("[data-panel]");
      panel.setAttribute("tabindex", "-1");
      panel.innerHTML = '<a href="/settings">Settings</a>';
      tabs.refresh();
    });
    await expect(page.locator("[data-panel]").first()).toHaveAttribute("tabindex", "-1");
  });

  test("disabled controls do not suppress a panel tab stop", async ({ page }) => {
    await loadFixture(page, progressive.replace(
      '<section id="one" data-panel>One panel</section>',
      '<section id="one" data-panel><button disabled>Unavailable</button></section>',
    ));
    await expect(page.locator("#one")).toHaveAttribute("tabindex", "0");
  });
});

test.describe("keyboard and pointer behavior", () => {
  test("horizontal auto activation moves real focus, wraps, and handles Home/End", async ({ page }) => {
    await loadFixture(page, progressive);
    const tabs = page.locator("[data-tab]");
    await tabs.nth(0).focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(1)).toBeFocused();
    await expect(page.locator("#tabs")).toHaveJSProperty("selectedIndex", 1);
    await page.keyboard.press("End");
    await expect(tabs.nth(2)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(0)).toBeFocused();
    await page.keyboard.press("Home");
    await expect(tabs.nth(0)).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(tabs.nth(2)).toBeFocused();
  });

  test("vertical navigation uses Up/Down and leaves horizontal arrows alone", async ({ page }) => {
    await loadFixture(page, application);
    await page.locator("#tabs").evaluate((tabs) => tabs.setAttribute("data-orientation", "vertical"));
    await page.locator("#tabs").evaluate((tabs) => tabs.refresh());
    const tabs = page.locator("[data-tab]");
    await tabs.nth(0).focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(0)).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(tabs.nth(1)).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(tabs.nth(0)).toBeFocused();
  });

  test("manual activation separates focus from selection and restores Tab entry", async ({ page }) => {
    await loadFixture(page, application.replace('<manner-tabs id="tabs">', '<manner-tabs id="tabs" data-activation="manual">'));
    const tabs = page.locator("[data-tab]");
    await tabs.nth(0).focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(1)).toBeFocused();
    await expect(page.locator("#tabs")).toHaveJSProperty("selectedIndex", 0);
    await page.keyboard.press("Enter");
    await expect(page.locator("#tabs")).toHaveJSProperty("selectedIndex", 1);
    await page.locator("#before").focus();
    await page.keyboard.press("Tab");
    await expect(tabs.nth(1)).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.locator("[data-panel]").nth(1)).toBeFocused();
    await page.locator("#before").focus();
    await page.keyboard.press("Tab");
    await expect(tabs.nth(1)).toBeFocused();
  });

  test("primary clicks activate tabs but preserve modified anchor navigation", async ({ page }) => {
    await loadFixture(page, progressive);
    const second = page.locator("[data-tab]").nth(1);
    await second.click();
    await expect(page.locator("#tabs")).toHaveJSProperty("selectedIndex", 1);
    await expect(page).toHaveURL(/fixture\.html$/);
  });
});

test.describe("lifecycle, ownership, and errors", () => {
  test("custom names and nested custom elements isolate ownership", async ({ page }) => {
    await page.goto("/tests/browser/custom-fixture.html");
    await page.evaluate(async () => {
      const { MannerTabs } = await import("/dist/tabs.js");
      customElements.define("my-tabs", MannerTabs);
      document.querySelector("#app").innerHTML = `
        <my-tabs id="outer"><div data-tablist aria-label="Outer"><button data-tab>Outer</button></div><section data-panel>
          <my-tabs id="inner"><div data-tablist aria-label="Inner"><button data-tab>Inner one</button><button data-tab>Inner two</button></div><section data-panel>One</section><section data-panel>Two</section></my-tabs>
        </section></my-tabs>`;
    });
    await expect(page.locator("#outer > [data-tablist]")).toHaveAttribute("role", "tablist");
    await expect(page.locator("#inner > [data-tablist]")).toHaveAttribute("role", "tablist");
    await expect(page.locator("#outer > [data-tablist] > [data-tab]")).toHaveCount(1);
    await expect(page.locator("#inner > [data-tablist] > [data-tab]")).toHaveCount(2);
  });

  test("pending bootstrap completes without an early parser error", async ({ page }) => {
    const errors = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto("/tests/browser/fixture.html");
    await page.evaluate(() => {
      const host = document.createElement("manner-tabs");
      host.id = "tabs";
      document.querySelector("#app").append(host);
      host.innerHTML = `<div data-tablist aria-label="Late"><button data-tab>One</button></div><section data-panel>One</section>`;
    });
    await expect(page.locator("#tabs [data-tablist]")).toHaveAttribute("role", "tablist");
    expect(errors).toEqual([]);
  });

  test("disconnect/reconnect rebinds events and refresh handles deliberate DOM changes", async ({ page }) => {
    await loadFixture(page, application);
    await page.locator("#tabs").evaluate((tabs) => {
      const selected = tabs.querySelectorAll("[data-tab]")[1];
      tabs.selectedIndex = 1;
      tabs.remove();
      document.querySelector("#app").append(tabs);
      const tab = document.createElement("button");
      tab.type = "button";
      tab.dataset.tab = "";
      tab.textContent = "Extra";
      const panel = document.createElement("section");
      panel.dataset.panel = "";
      panel.textContent = "Extra panel";
      tabs.querySelector("[data-tablist]").append(tab);
      tabs.append(panel);
      tabs.refresh();
      if (tabs.querySelectorAll("[data-tab]")[1] !== selected) throw new Error("selection was not preserved");
    });
    await expect(page.locator("[data-tab]")).toHaveCount(4);
    await page.locator("[data-tab]").nth(2).click();
    await expect(page.locator("#tabs")).toHaveJSProperty("selectedIndex", 2);
  });

  test("malformed markup and duplicate IDs fail once without partial upgrade", async ({ page }) => {
    const errors = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto("/tests/browser/fixture.html");
    await page.locator("#app").evaluate((app) => {
      app.innerHTML = `<div id="duplicate"></div><manner-tabs id="tabs"><nav data-tablist aria-label="Bad"><a data-tab href="#duplicate">Bad</a></nav><section id="duplicate" data-panel>Panel</section></manner-tabs>`;
    });
    await page.waitForTimeout(50);
    expect(errors.filter((message) => message.includes("Duplicate authored id")).length).toBe(1);
    await expect(page.locator("#tabs [data-tablist]")).not.toHaveAttribute("role", "tablist");
    await expect(page.locator("#tabs [data-tab]")).not.toHaveAttribute("aria-selected");
  });
});

for (const [name, markup] of [
  ["progressive", progressive],
  ["application", application],
  ["vertical", application.replace('<manner-tabs id="tabs">', '<manner-tabs id="tabs" data-orientation="vertical">')],
]) {
  test(`axe has no violations in the ${name} fixture`, async ({ page }) => {
    await loadFixture(page, markup);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}
