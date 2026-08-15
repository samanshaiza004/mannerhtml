# Changelog

## Unreleased

### Added

- Manual `<manner-carousel>` with one-visible-slide selection, polite announcements, stable focus, finite boundaries, optional `data-loop`, `refresh()`, and `manner-carousel-change`.
- Shared private ownership, parser-bootstrap, and IDREF validation machinery used by Tabs, Forms, and Carousel.

### Fixed

- The panel tab-stop heuristic now recognizes `<summary>` and `<iframe>` as sequential focus targets, treats every negative `tabindex` as excluded rather than only `-1`, and no longer counts hidden inputs or controls disabled by an ancestor `<fieldset disabled>`.

### Improved

- Runtime diagnostics no longer name a library version; the disabled-tab error reads `Disabled tabs are not supported.`

## 0.2.0 — 2026-08-13

### Added

- `manner-form-invalid`, a bubbling event exposing invalid controls after presentation is synchronized.
- Opt-in `data-hidden="until-found"` tabs for find-in-page and fragment discovery in supporting browsers.
- `HTMLElementTagNameMap` declarations for the registered custom elements.
- Embedded TypeScript sources in published source maps.
- npm and Git installation guidance.

### Improved

- Form resets restore pristine authored error state; canceled resets preserve current state.
- Invalid submission focuses the first visibly rendered invalid control.
- Tab panels receive `tabindex="0"` only when they lack focusable content, while authored `tabindex` values remain intact.
- Error-summary documentation now explains the limits of revealing a hidden live-region root.

### Verification

- Chromium, Firefox, and WebKit Playwright projects with axe and ARIA snapshots.
- Carousel requires manual Safari + VoiceOver, Firefox + NVDA, and Chrome + NVDA verification before completion; see `TESTING.md`.

## 0.1.0 — 2026-08-11

- Initial tabs and form-validation release.
