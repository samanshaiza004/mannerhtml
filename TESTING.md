# Testing

The fast test suite runs TypeScript checking, compilation, and dependency-free pure navigation assertions:

```sh
npm run typecheck
npm test
```

Automated browser coverage runs through Playwright; manual assistive-technology verification remains a separate release gate. The implementation is designed for current evergreen browsers.

The repository now includes a Playwright suite with axe-core checks, ARIA snapshots, and Chromium/Firefox/WebKit projects. Run it with:

```sh
npm run test:browser
```

The suite covers both tab authoring profiles, keyboard focus and activation, URL fragments, nested/custom element names, lifecycle, refresh, malformed markup, duplicate IDs, conditional panel tab stops, authored `tabindex` preservation, `hidden="until-found"`, and canonical axe fixtures. It also covers `<manner-form>` native fallback, constraint validation, first-visible-invalid focus with normal scrolling, authored error and summary coordination, reset and canceled-reset behavior, the `manner-form-invalid` event, ARIA restoration, fieldset radio groups, refresh/reconnect, custom ownership, malformed relationships, and a canonical axe fixture. `<manner-carousel>` coverage includes parser-safe bootstrap initialization, authored initial visibility, manual action events, stable focus, finite and looping boundaries, refresh precedence, nested/custom ownership, dialog composition, live-region semantics, named slides, malformed controls, IDREF validation, ARIA snapshots, and axe. CI installs all three browser engines before running it.

Automated evidence recorded 2026-08-14 for unreleased `main` (v0.2.0 plus the Carousel implementation): 165 tests passed across Chromium, Firefox, and WebKit with Playwright and axe-core.

## Manual AT evidence matrix

| Platform | Browser | Assistive technology | Version | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| macOS | Safari | VoiceOver | Not run in this environment | Unverified | Carousel completion gate; verify announcement and stable focus |
| Windows | Firefox | NVDA | Not run in this environment | Unverified | Carousel completion gate; verify announcement and stable focus |
| Windows | Chrome | NVDA | Not run in this environment | Unverified | Carousel completion gate; verify announcement and stable focus |
| iOS | Safari | VoiceOver | Not run in this environment | Unverified | Mobile AT is unverified |
| Android | Chrome | TalkBack | Not run in this environment | Unverified | Mobile AT is unverified |

For the three required Carousel combinations, record a pass only when a named slide change is announced after activating Previous or Next, focus remains on that navigation button, finite boundaries are understandable, and `data-loop` wrapping does not produce duplicate or stale announcements. Until those checks are recorded, Carousel is not a completed release feature.

Dynamic structural changes are deliberately not observed after initialization. Call `refresh()` after inserting, removing, or reordering tabs/panels.
