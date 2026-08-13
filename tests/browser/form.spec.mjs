import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const formMarkup = `
  <manner-form id="profile-form">
    <form>
      <div data-error-summary hidden tabindex="-1">
        <h2>Fix these problems</h2>
        <ul>
          <li data-summary-for="email" hidden><a href="#email">Enter a valid email address</a></li>
          <li data-summary-for="name" hidden><a href="#name">Enter your name</a></li>
        </ul>
      </div>
      <label for="email">Email</label>
      <input id="email" name="email" type="email" required aria-describedby="email-hint">
      <p id="email-hint">We will never share it.</p>
      <p id="email-error" data-error-for="email" hidden>Enter a valid email address.</p>
      <label for="name">Name</label>
      <input id="name" name="name" pattern="[A-Za-z ]+" required>
      <p id="name-error" data-error-for="name" hidden>Enter your name.</p>
      <button type="submit">Send</button>
    </form>
  </manner-form>`;

async function loadForm(page, markup = formMarkup) {
  await page.goto("/tests/browser/fixture.html");
  await page.locator("#app").evaluate((app, html) => { app.innerHTML = html; }, markup);
  await expect(page.locator("manner-form form")).toHaveJSProperty("noValidate", true);
}

test.describe("manner-form progressive validation", () => {
  test("native fallback keeps constraint validation before enhancement", async ({ page }) => {
    await page.goto("/tests/browser/form-nojs.html");
    await expect(page.locator("#native-form")).toHaveJSProperty("noValidate", false);
    await expect(page.locator("#native-email")).toHaveJSProperty("validity.valid", false);
  });

  test("invalid submission reveals authored errors, relations, summary, and first focus", async ({ page }) => {
    await loadForm(page);
    await page.locator("button[type=submit]").click();
    await expect(page.locator("#email")).toBeFocused();
    await expect(page.locator("#email")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#email")).toHaveAttribute("aria-describedby", "email-hint email-error");
    await expect(page.locator("#email-error")).toBeVisible();
    await expect(page.locator("[data-error-summary]")).toBeVisible();
    await expect(page.locator("[data-summary-for=email]")).toBeVisible();
    await expect(page.locator("[data-summary-for=name]")).toBeVisible();
  });

  test("email, required, and pattern validity recover on input", async ({ page }) => {
    await loadForm(page);
    await page.locator("button[type=submit]").click();
    await page.locator("#email").fill("valid@example.com");
    await expect(page.locator("#email-error")).toBeHidden();
    await expect(page.locator("#email")).not.toHaveAttribute("aria-invalid");
    await expect(page.locator("#email")).toHaveAttribute("aria-describedby", "email-hint");
    await page.locator("#name").fill("123");
    await page.locator("#name").dispatchEvent("change");
    await page.locator("#name").blur();
    await page.locator("button[type=submit]").click();
    await expect(page.locator("#name")).toBeFocused();
    await expect(page.locator("#name-error")).toBeVisible();
    await page.locator("#name").fill("A Name");
    await expect(page.locator("#name-error")).toBeHidden();
    await expect(page.locator("[data-error-summary]")).toBeHidden();
  });

  test("direct checkValidity synchronizes without submitting", async ({ page }) => {
    await loadForm(page);
    const valid = await page.locator("form").evaluate((form) => form.checkValidity());
    expect(valid).toBe(false);
    await expect(page.locator("#email-error")).toBeVisible();
    await expect(page.locator("#email")).toHaveAttribute("aria-invalid", "true");
  });

  test("reset clears invalid presentation after controls are restored", async ({ page }) => {
    await loadForm(page);
    await page.locator("button[type=submit]").click();
    await page.locator("form").evaluate((form) => form.reset());
    await expect(page.locator("#email")).not.toHaveAttribute("aria-invalid");
    await expect(page.locator("#email")).toHaveAttribute("aria-describedby", "email-hint");
    await expect(page.locator("#email-error")).toBeHidden();
    await expect(page.locator("[data-error-summary]")).toBeHidden();
  });

  test("a canceled reset preserves the current invalid presentation", async ({ page }) => {
    await loadForm(page);
    await page.locator("button[type=submit]").click();
    await page.locator("form").evaluate((form) => {
      form.addEventListener("reset", (event) => event.preventDefault(), { once: true });
      form.reset();
    });
    await expect(page.locator("#email")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#email-error")).toBeVisible();
    await expect(page.locator("[data-error-summary]")).toBeVisible();
  });

  test("dispatches invalid controls after a blocked submit", async ({ page }) => {
    await loadForm(page);
    const controls = await page.locator("manner-form").evaluate((host) => new Promise((resolve) => {
      host.addEventListener("manner-form-invalid", (event) => resolve(event.detail.controls.map((control) => control.id)), { once: true });
      host.querySelector("form").requestSubmit();
    }));
    expect(controls).toEqual(["email", "name"]);
  });

  test("focuses the first visible invalid control", async ({ page }) => {
    await loadForm(page, `
      <manner-form>
        <form>
          <div style="display: none"><label for="hidden-name">Hidden</label><input id="hidden-name" required></div>
          <label for="visible-name">Visible</label><input id="visible-name" required>
          <p id="visible-name-error" data-error-for="visible-name" hidden>Enter your name.</p>
          <button type="submit">Send</button>
        </form>
      </manner-form>`);
    await page.locator("button[type=submit]").click();
    await expect(page.locator("#visible-name")).toBeFocused();
    await expect(page.locator("#hidden-name")).toHaveAttribute("aria-invalid", "true");
  });

  test("fieldset radio groups use the group error relationship", async ({ page }) => {
    await loadForm(page, `
      <manner-form>
        <form>
          <div data-error-summary aria-live="polite" hidden><ul><li data-summary-for="contact-method" hidden><a href="#contact-method">Choose a contact method</a></li></ul></div>
          <fieldset id="contact-method"><legend>Preferred contact method</legend><label><input type="radio" name="contact" value="email" required>Email</label><label><input type="radio" name="contact" value="phone">Phone</label></fieldset>
          <p id="contact-method-error" data-error-for="contact-method" hidden>Choose a contact method.</p>
          <button type="submit">Send</button>
        </form>
      </manner-form>`);
    await page.locator("button[type=submit]").click();
    await expect(page.locator("#contact-method-error")).toBeVisible();
    await expect(page.locator("[data-summary-for=contact-method]")).toBeVisible();
    await expect(page.locator("input[type=radio]").first()).toHaveAttribute("aria-invalid", "true");
    await page.locator("input[type=radio]").first().check();
    await expect(page.locator("#contact-method-error")).toBeHidden();
  });

  test("validate returns validity and authored relationships are restored", async ({ page }) => {
    await loadForm(page);
    const first = await page.locator("manner-form").evaluate((host) => host.validate());
    expect(first).toBe(false);
    await page.locator("#email").fill("valid@example.com");
    await page.locator("#name").fill("A Name");
    const second = await page.locator("manner-form").evaluate((host) => host.validate());
    expect(second).toBe(true);
    await expect(page.locator("#email")).toHaveAttribute("aria-describedby", "email-hint");
    await expect(page.locator("#email")).not.toHaveAttribute("aria-invalid");
  });

  test("refresh discovers deliberate DOM changes and reconnect restores enhancement", async ({ page }) => {
    await loadForm(page);
    await page.locator("manner-form").evaluate((host) => {
      const form = host.querySelector("form");
      form.insertAdjacentHTML("beforeend", '<label for="extra">Extra</label><input id="extra" required><p id="extra-error" data-error-for="extra" hidden>Extra is required.</p>');
      host.refresh();
    });
    await page.locator("button[type=submit]").click();
    await expect(page.locator("#extra-error")).toBeVisible();
    await page.locator("#profile-form").evaluate((host) => { window.__mannerHost = host; host.remove(); });
    await expect.poll(() => page.evaluate(() => window.__mannerHost.querySelector("#extra").form.noValidate)).toBe(false);
    await page.locator("#app").evaluate((app) => app.append(window.__mannerHost));
    await expect(page.locator("#profile-form form")).toHaveJSProperty("noValidate", true);
  });
});

test.describe("manner-form ownership and failures", () => {
  test("custom names and nested instances isolate their forms", async ({ page }) => {
    await page.goto("/tests/browser/custom-fixture.html");
    await page.evaluate(async () => {
      const { MannerForm } = await import("/dist/form.js");
      customElements.define("manner-form", MannerForm);
      class MyForm extends MannerForm {}
      customElements.define("my-form", MyForm);
      document.querySelector("#app").innerHTML = `
        <manner-form id="outer"><form><label for="outer-name">Outer</label><input id="outer-name" required></form>
          <my-form id="inner"><form><label for="inner-name">Inner</label><input id="inner-name" required></form></my-form>
        </manner-form>`;
    });
    await expect(page.locator("#outer > form")).toHaveJSProperty("noValidate", true);
    await expect(page.locator("#inner > form")).toHaveJSProperty("noValidate", true);
  });

  test("malformed relationships fail once without partial enhancement", async ({ page }) => {
    const errors = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto("/tests/browser/fixture.html");
    await page.locator("#app").evaluate((app) => {
      app.innerHTML = '<manner-form data-error-focus="summary"><form><label for="email">Email</label><input id="email" required><p id="email-error" data-error-for="missing" hidden>Error</p></form></manner-form>';
    });
    await page.waitForTimeout(50);
    expect(errors.filter((message) => message.includes("Unsupported data-error-focus")).length).toBe(1);
    await expect(page.locator("manner-form form")).toHaveJSProperty("noValidate", false);
    await expect(page.locator("#email")).not.toHaveAttribute("aria-invalid");
  });
});

test("axe has no violations in the canonical form fixture", async ({ page }) => {
  await loadForm(page);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
