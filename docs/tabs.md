# Tabs contract

`<manner-tabs>` requires one `[data-tablist]`, at least one `[data-tab]`, at least one `[data-panel]`, and an author-supplied tablist name via `aria-label` or `aria-labelledby`.

Progressive tabs are all anchors with fragment-only `href` values. Their targets must be owned panels. Application tabs are all buttons and pair with panels by source order. Mixed profiles and malformed relationships fail without partial enhancement.

After upgrade, MannerHTML applies `tablist`, `tab`, and `tabpanel` semantics; selected state; `aria-controls`; `aria-labelledby`; roving `tabindex`; and `hidden` to inactive panels. Add `data-hidden="until-found"` to opt into the browser's `hidden="until-found"` behavior for inactive panels. This keeps panel text discoverable through find-in-page and fragment navigation in supporting browsers; the default remains `hidden` for compatibility. Do not use a blanket `[hidden] { display: none !important }` rule, which defeats `until-found`; use `[hidden]:where(:not([hidden="until-found"])) { display: none !important }` instead. MannerHTML selects the owning tab when `beforematch` reveals a panel. It does not add CSS or create content.

Horizontal tabs use Left/Right/Home/End. Vertical tabs use Up/Down/Home/End. Arrow navigation wraps. Automatic activation selects while focus moves; manual activation selects with Enter or Space. Primary pointer activation always selects.

Selection is available through `selectedIndex`, `select(index)`, and `refresh()`. A user/programmatic transition dispatches `manner-tabs-change`; initial normalization does not.
