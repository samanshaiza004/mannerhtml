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

The suite covers both authoring profiles, keyboard focus and activation, URL fragments, nested/custom element names, lifecycle, refresh, malformed markup, duplicate IDs, and canonical axe fixtures. CI installs all three browser engines before running it.

Automated evidence recorded 2026-08-10: 45 tests passed in Chromium 151, Firefox 153, and WebKit 26.5 with Playwright 1.62.1 and axe-core 4.12.1.

## v0.1 evidence matrix

| Platform | Browser | Assistive technology | Version | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| macOS | Safari | VoiceOver | Not run in this environment | Unverified | Manual pass required |
| Windows | Firefox | NVDA | Not run in this environment | Unverified | Manual pass required |
| Windows | Chrome | NVDA | Not run in this environment | Unverified | Manual pass required |
| iOS | Safari | VoiceOver | Not run in this environment | Unverified | Mobile AT is unverified |
| Android | Chrome | TalkBack | Not run in this environment | Unverified | Mobile AT is unverified |

Dynamic structural changes are deliberately not observed after initialization. Call `refresh()` after inserting, removing, or reordering tabs/panels.
