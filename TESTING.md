# Testing

The fast test suite runs TypeScript checking, compilation, and dependency-free pure navigation assertions:

```sh
npm run typecheck
npm test
```

The current automated environment does not include a browser runner, so DOM focus, pointer, and accessibility-tree behavior still require browser integration coverage before a production release. The implementation is designed for the current evergreen browsers.

## v0.1 evidence matrix

| Platform | Browser | Assistive technology | Version | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| macOS | Safari | VoiceOver | Not run in this environment | Unverified | Manual pass required |
| Windows | Firefox | NVDA | Not run in this environment | Unverified | Manual pass required |
| Windows | Chrome | NVDA | Not run in this environment | Unverified | Manual pass required |
| iOS | Safari | VoiceOver | Not run in this environment | Unverified | Mobile AT is unverified |
| Android | Chrome | TalkBack | Not run in this environment | Unverified | Mobile AT is unverified |

Dynamic structural changes are deliberately not observed after initialization. Call `refresh()` after inserting, removing, or reordering tabs/panels.
