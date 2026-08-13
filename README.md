# MannerHTML

**Accessible behavior for the HTML you already have.**

MannerHTML is a tiny, framework-independent behavior layer for server-rendered HTML. It enhances author-owned light DOM with the interaction behavior HTML does not provide by itself. It does not render, style, or use Shadow DOM.

## Install

Install the published package from npm:

```sh
npm install mannerhtml
```

Then import it from your application entry point. The package is dependency-free ESM and registers both elements:

```js
import "mannerhtml";
```

To try an unreleased branch directly from GitHub, use `npm install github:samanshaiza004/mannerhtml`. The `prepare` script builds `dist/` automatically for Git installs.

## Tabs

```html
<script type="module" src="/mannerhtml/dist/index.js"></script>

<manner-tabs>
  <nav data-tablist aria-label="Sections">
    <a data-tab href="#news">News</a>
    <a data-tab href="#events">Events</a>
  </nav>

  <section id="news" data-panel>News</section>
  <section id="events" data-panel>Events</section>
</manner-tabs>
```

The anchor example remains ordinary, deep-linkable HTML before JavaScript. After upgrade it gains tab semantics, roving focus, keyboard navigation, and panel selection. Buttons may be used for application tabs; both profiles keep all content available before enhancement.

The default activation mode is automatic. Use `data-activation="manual"` when selection should require Enter or Space. Use `data-orientation="vertical"` for vertical arrow behavior.

Use `data-hidden="until-found"` to keep inactive panel text available to find-in-page and fragment navigation in supporting browsers. Panels receive a tab stop only when they do not contain a focusable descendant.

## Forms

`<manner-form>` coordinates native constraint validation with author-owned error UI. Native validation remains the no-JavaScript fallback; after upgrade, MannerHTML adds `aria-invalid`, `aria-describedby`, error visibility, summary visibility, and first-invalid focus without generating content.

See the [form validation contract](docs/form-validation-contract.md) for the required markup, API, focus policy, announcements, and grouped-control guidance.

Invalid submissions dispatch `manner-form-invalid` after error presentation is synchronized. Completed native resets restore the pristine presentation; canceled resets preserve the current state.

## API

```js
tabs.selectedIndex = 1;
tabs.select(0);
tabs.refresh(); // after deliberate structural DOM changes
tabs.addEventListener("manner-tabs-change", (event) => {
  console.log(event.detail.index, event.detail.source);
});
```

Importing `mannerhtml` registers `<manner-tabs>`. Advanced consumers can import `{ MannerTabs }` from `mannerhtml/element` and register a different custom-element name themselves.

## What it is not

MannerHTML is not a component library, design system, CSS framework, rendering framework, or framework adapter. Before adding behavior, check whether native HTML already solves the problem; see [native alternatives](docs/native-alternatives.md).

## Status

MannerHTML v0.2 includes tabs and form validation. Disabled tabs, automatic mutation reconciliation, URL history synchronization, async panels, and additional widgets are intentionally out of scope. Browser and assistive-technology evidence is recorded in [TESTING.md](TESTING.md).
