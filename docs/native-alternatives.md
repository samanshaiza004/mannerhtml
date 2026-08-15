# Native alternatives

Before installing another component, check whether HTML already solves the problem.

- Modal: start with `<dialog>` and Invoker Commands where supported.
- Disclosure and accordion: use `<details><summary>…</summary></details>`. Grouped `<details name="faq">` provides exclusive behavior in current browsers.
- Floating content: start with the Popover API and CSS Anchor Positioning.
- Selection: use `<select>`.
- Sequential content: use linked sections for ordinary navigation; use `<manner-carousel>` only when a manual, one-visible-item sequence needs announcements and stable focus.

Popover positioning alone does not make an accessible tooltip. Tooltip behavior still needs a careful semantic and trigger contract, so it is not included here.
