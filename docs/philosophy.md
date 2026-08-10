# Philosophy

Manner occupies the narrow gap between what authors can express in semantic HTML and what users need for correct interaction.

- Authors own the HTML, content, IDs, and presentation.
- The browser owns native behavior whenever the platform provides it.
- Custom Elements own lifecycle, so no global scanner or initialization call is required.
- Progressive enhancement is a requirement: meaningful HTML remains meaningful before JavaScript.
- Accessibility claims require interaction tests and assistive-technology evidence, not only ARIA attributes.

The project deliberately has one primitive in v0.1. A small, auditable behavior surface is more valuable than a large component catalog.
