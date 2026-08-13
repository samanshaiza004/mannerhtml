# Accessibility

The tabs primitive follows the WAI-ARIA tabs interaction model while preserving the author's light DOM and no-JavaScript fallback. It exposes one page-entry tab, hides inactive panels, keeps all relationships within the owning custom element, and never moves focus during initialization.

Automated accessibility checks are a floor. A release should exercise keyboard-only interaction and record results with Safari + VoiceOver, Firefox + NVDA, and Chrome + NVDA. Mobile screen-reader behavior is explicitly unverified until iOS VoiceOver and Android TalkBack are tested.

Known v0.2 limitations include no disabled tabs, no automatic structural mutation support, no history/hash synchronization after initialization, and no framework-specific adapters.
