import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const carouselMarkup = `
  <manner-carousel id="carousel" aria-label="Event photographs">
    <div data-slides>
      <figure data-slide aria-label="Christmas service, 2025"><figcaption>Christmas service</figcaption></figure>
      <figure data-slide aria-label="Church picnic, 2025" hidden><figcaption>Church picnic</figcaption></figure>
      <figure data-slide aria-label="Community meal, 2025" hidden><figcaption>Community meal</figcaption></figure>
    </div>
    <button type="button" data-previous>Previous</button>
    <button type="button" data-next>Next</button>
  </manner-carousel>`;

async function loadCarousel(page, markup = carouselMarkup) {
  await page.goto("/tests/browser/fixture.html");
  await page.locator("#app").evaluate((app, html) => { app.innerHTML = html; }, markup);
  await expect(page.locator("#carousel")).toHaveAttribute("aria-roledescription", "carousel");
}

test.describe("selection and semantics", () => {
  test("normalizes the carousel and exposes the manual sequence", async ({ page }) => {
    await loadCarousel(page);
    await expect(page.locator("#carousel")).toHaveAttribute("role", "group");
    await expect(page.locator("[data-slides]")).toHaveAttribute("aria-live", "polite");
    await expect(page.locator("[data-slides]")).not.toHaveAttribute("aria-atomic");
    await expect(page.locator("[data-slide]")).toHaveCount(3);
    await expect(page.locator("[data-slide]").first()).toHaveAttribute("role", "group");
    await expect(page.locator("[data-slide]").first()).toHaveAttribute("aria-roledescription", "slide");
    await expect(page.locator("[data-slide][hidden]")).toHaveCount(2);
    await expect(page.locator("[data-previous]")).toHaveAttribute("aria-disabled", "true");
    await expect(page.locator("[data-next]")).not.toHaveAttribute("aria-disabled");
  });

  test("adopts one authored visible slide and defaults to the first when all are hidden", async ({ page }) => {
    await loadCarousel(page, carouselMarkup.replace(
      '<figure data-slide aria-label="Christmas service, 2025">',
      '<figure data-slide aria-label="Christmas service, 2025" hidden>',
    ).replace(
      '<figure data-slide aria-label="Church picnic, 2025">',
      '<figure data-slide aria-label="Church picnic, 2025" hidden>',
    ).replace(
      '<figure data-slide aria-label="Community meal, 2025">',
      '<figure data-slide aria-label="Community meal, 2025" hidden>',
    ));
    await expect(page.locator("#carousel")).toHaveJSProperty("selectedIndex", 0);
    await expect(page.locator("[data-slide]").first()).not.toHaveAttribute("hidden");

    await loadCarousel(page, carouselMarkup
      .replace(
        '<figure data-slide aria-label="Christmas service, 2025">',
        '<figure data-slide aria-label="Christmas service, 2025" hidden>',
      )
      .replace(
        '<figure data-slide aria-label="Church picnic, 2025" hidden>',
        '<figure data-slide aria-label="Church picnic, 2025">',
      ));
    await expect(page.locator("#carousel")).toHaveJSProperty("selectedIndex", 1);
  });

  test("ARIA snapshot exposes the named current slide and controls", async ({ page }) => {
    await loadCarousel(page);
    await expect(page.locator("#carousel")).toMatchAriaSnapshot(`
- group "Event photographs":
  - group "Christmas service, 2025":
    - text: Christmas service
  - button "Previous"
  - button "Next"
`);
  });
});

test.describe("manual navigation", () => {
  test("next and previous keep focus on the activated control and report actions", async ({ page }) => {
    await loadCarousel(page);
    await page.locator("#carousel").evaluate((carousel) => {
      carousel.__events = [];
      carousel.addEventListener("manner-carousel-change", (event) => carousel.__events.push({
        index: event.detail.index,
        source: event.detail.source,
      }));
    });
    await page.locator("[data-next]").focus();
    await page.locator("[data-next]").dispatchEvent("click");
    await expect(page.locator("[data-next]")).toBeFocused();
    await expect(page.locator("#carousel")).toHaveJSProperty("selectedIndex", 1);
    await page.locator("#carousel").evaluate((carousel) => carousel.previous());
    await expect(page.locator("#carousel")).toHaveJSProperty("selectedIndex", 0);
    expect(await page.locator("#carousel").evaluate((carousel) => carousel.__events)).toEqual([
      { index: 1, source: "next" },
      { index: 0, source: "previous" },
    ]);
  });

  test("programmatic selection reports programmatic and finite boundaries are no-ops", async ({ page }) => {
    await loadCarousel(page);
    await page.locator("#carousel").evaluate((carousel) => {
      carousel.__events = [];
      carousel.addEventListener("manner-carousel-change", (event) => carousel.__events.push(event.detail.source));
      carousel.select(2);
    });
    await expect(page.locator("#carousel")).toHaveJSProperty("selectedIndex", 2);
    await expect(page.locator("[data-next]")).toHaveAttribute("aria-disabled", "true");
    expect(await page.locator("#carousel").evaluate((carousel) => carousel.__events)).toEqual(["programmatic"]);
    await page.locator("[data-next]").focus();
    await page.locator("[data-next]").dispatchEvent("click");
    expect(await page.locator("#carousel").evaluate((carousel) => carousel.__events)).toEqual(["programmatic"]);
    await expect(page.locator("[data-next]")).toBeFocused();
  });

  test("data-loop wraps without boundary disabled states", async ({ page }) => {
    await loadCarousel(page, carouselMarkup.replace("<manner-carousel id=\"carousel\"", "<manner-carousel data-loop id=\"carousel\""));
    await expect(page.locator("[data-previous]")).not.toHaveAttribute("aria-disabled");
    await page.locator("[data-previous]").click();
    await expect(page.locator("#carousel")).toHaveJSProperty("selectedIndex", 2);
    await page.locator("[data-next]").focus();
    await page.locator("[data-next]").click();
    await expect(page.locator("#carousel")).toHaveJSProperty("selectedIndex", 0);
  });

  test("does not add arrow-key behavior beyond native button behavior", async ({ page }) => {
    await loadCarousel(page);
    await page.locator("[data-next]").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#carousel")).toHaveJSProperty("selectedIndex", 0);
    await expect(page.locator("[data-next]")).toBeFocused();
  });
});

test.describe("refresh and lifecycle", () => {
  test("refresh preserves the selected element, then applies authored visibility rules", async ({ page }) => {
    await loadCarousel(page);
    await page.locator("#carousel").evaluate((carousel) => carousel.select(1));
    await page.locator("#carousel").evaluate((carousel) => {
      carousel.querySelectorAll("[data-slide]")[1].remove();
      carousel.querySelectorAll("[data-slide]")[0].setAttribute("hidden", "");
      carousel.querySelectorAll("[data-slide]")[1].removeAttribute("hidden");
      carousel.refresh();
    });
    await expect(page.locator("#carousel")).toHaveJSProperty("selectedIndex", 1);
    await expect(page.locator("[data-slide][hidden]")).toHaveCount(1);

    await page.locator("#carousel").evaluate((carousel) => {
      carousel.querySelectorAll("[data-slide]").forEach((slide) => slide.setAttribute("hidden", ""));
      carousel.refresh();
    });
    await expect(page.locator("#carousel")).toHaveJSProperty("selectedIndex", 1);

    await page.locator("#carousel").evaluate((carousel) => {
      carousel.querySelectorAll("[data-slide]")[1].remove();
      carousel.refresh();
    });
    await expect(page.locator("#carousel")).toHaveJSProperty("selectedIndex", 0);
  });

  test("refresh rejects multiple visible slides without partial re-enhancement", async ({ page }) => {
    await loadCarousel(page);
    await page.locator("#carousel").evaluate((carousel) => {
      carousel.select(1);
      carousel.querySelectorAll("[data-slide]")[1].remove();
      carousel.querySelectorAll("[data-slide]").forEach((slide) => slide.removeAttribute("hidden"));
      carousel.refresh();
    });
    await expect(page.locator("#carousel")).toHaveJSProperty("selectedIndex", 1);
    await expect(page.locator("[data-slide][hidden]")).toHaveCount(0);
  });

  test("disconnect and reconnect rebinds navigation", async ({ page }) => {
    await loadCarousel(page);
    await page.locator("#carousel").evaluate((carousel) => {
      carousel.remove();
      document.querySelector("#app").append(carousel);
    });
    await page.locator("[data-next]").focus();
    await page.locator("[data-next]").dispatchEvent("click");
    await expect(page.locator("#carousel")).toHaveJSProperty("selectedIndex", 1);
  });
});

test.describe("parser-safe bootstrap, ownership, and failures", () => {
  test("completes parser-safe bootstrap without early errors", async ({ page }) => {
    const errors = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto("/tests/browser/fixture.html");
    await page.evaluate(() => {
      const carousel = document.createElement("manner-carousel");
      carousel.id = "carousel";
      carousel.setAttribute("aria-label", "Late carousel");
      document.querySelector("#app").append(carousel);
      carousel.innerHTML = `<div data-slides><figure data-slide aria-label="Late slide">Late</figure></div><button type="button" data-previous>Previous</button><button type="button" data-next>Next</button>`;
    });
    await expect(page.locator("#carousel")).toHaveAttribute("aria-roledescription", "carousel");
    expect(errors).toEqual([]);
  });

  test("nested custom names isolate ownership", async ({ page }) => {
    await page.goto("/tests/browser/custom-fixture.html");
    await page.evaluate(async () => {
      const { MannerCarousel } = await import("/dist/carousel.js");
      customElements.define("manner-carousel", MannerCarousel);
      class MyCarousel extends MannerCarousel {}
      customElements.define("my-carousel", MyCarousel);
      document.querySelector("#app").innerHTML = `
        <my-carousel id="outer" aria-label="Outer">
          <div data-slides><figure data-slide aria-label="Outer slide"><manner-carousel id="inner" aria-label="Inner"><div data-slides><figure data-slide aria-label="Inner slide">Inner</figure></div><button type="button" data-previous>Previous</button><button type="button" data-next>Next</button></manner-carousel></figure></div>
          <button type="button" data-previous>Previous</button><button type="button" data-next>Next</button>
        </my-carousel>`;
    });
    await expect(page.locator("#outer")).toHaveAttribute("aria-roledescription", "carousel");
    await expect(page.locator("#inner")).toHaveAttribute("aria-roledescription", "carousel");
    await expect(page.locator("#outer > [data-slides] > [data-slide]")).toHaveCount(1);
    await expect(page.locator("#inner [data-slide]")).toHaveCount(1);
  });

  test("malformed names, IDs, visibility, and controls fail without partial upgrade", async ({ page }) => {
    const errors = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto("/tests/browser/fixture.html");
    await page.locator("#app").evaluate((app) => {
      app.innerHTML = `<span id="caption">Caption</span><span id="caption">Duplicate</span><manner-carousel id="carousel" aria-labelledby="caption"><div data-slides><figure data-slide aria-labelledby="caption">One</figure><figure data-slide aria-label="Two">Two</figure></div><button type="button" data-previous>Previous</button><button type="button" data-next>Next</button></manner-carousel>`;
    });
    await page.waitForTimeout(50);
    expect(errors.some((message) => message.includes("Duplicate authored id"))).toBe(true);
    await expect(page.locator("#carousel")).not.toHaveAttribute("role", "group");
  });

  test("rejects non-button controls and missing IDREF targets", async ({ page }) => {
    const errors = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto("/tests/browser/fixture.html");
    await page.locator("#app").evaluate((app) => {
      app.innerHTML = `<manner-carousel id="carousel" aria-label="Bad controls"><div data-slides><figure data-slide aria-labelledby="missing-slide">One</figure></div><button type="submit" data-previous>Previous</button><button type="button" data-next>Next</button></manner-carousel>`;
    });
    await page.waitForTimeout(50);
    expect(errors.some((message) => message.includes("native <button type=\"button\">"))).toBe(true);
    await expect(page.locator("#carousel")).not.toHaveAttribute("role", "group");

    await page.locator("#app").evaluate((app) => {
      app.innerHTML = `<manner-carousel id="carousel" aria-label="Bad reference"><div data-slides><figure data-slide aria-labelledby="missing-slide">One</figure></div><button type="button" data-previous>Previous</button><button type="button" data-next>Next</button></manner-carousel>`;
    });
    await page.waitForTimeout(50);
    expect(errors.some((message) => message.includes("missing id \"missing-slide\""))).toBe(true);
    await expect(page.locator("#carousel")).not.toHaveAttribute("role", "group");
  });

  test("carousel selection works inside a native dialog", async ({ page }) => {
    await page.goto("/tests/browser/fixture.html");
    await page.locator("#app").evaluate((app) => {
      app.innerHTML = `<button id="opener" type="button">Open gallery</button><dialog id="gallery"><manner-carousel id="carousel" aria-label="Gallery"><div data-slides><figure data-slide aria-label="One">One</figure><figure data-slide aria-label="Two" hidden>Two</figure></div><button type="button" data-previous>Previous</button><button type="button" data-next>Next</button></manner-carousel><button type="button" command="close">Close</button></dialog>`;
      const opener = document.querySelector("#opener");
      const dialog = document.querySelector("#gallery");
      opener.addEventListener("click", () => dialog.showModal());
      opener.click();
    });
    await page.locator("[data-next]").focus();
    await page.locator("[data-next]").dispatchEvent("click");
    await expect(page.locator("#carousel")).toHaveJSProperty("selectedIndex", 1);
    await expect(page.locator("[data-next]")).toBeFocused();
  });
});

test("axe has no violations in the canonical carousel fixture", async ({ page }) => {
  await loadCarousel(page);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
