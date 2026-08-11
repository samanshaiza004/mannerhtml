# Tabs contract

`<manner-tabs>` requires one `[data-tablist]`, at least one `[data-tab]`, at least one `[data-panel]`, and an author-supplied tablist name via `aria-label` or `aria-labelledby`.

Progressive tabs are all anchors with fragment-only `href` values. Their targets must be owned panels. Application tabs are all buttons and pair with panels by source order. Mixed profiles and malformed relationships fail without partial enhancement.

After upgrade, MannerHTML applies `tablist`, `tab`, and `tabpanel` semantics; selected state; `aria-controls`; `aria-labelledby`; roving `tabindex`; and `hidden` to inactive panels. It does not add CSS or create content.

Horizontal tabs use Left/Right/Home/End. Vertical tabs use Up/Down/Home/End. Arrow navigation wraps. Automatic activation selects while focus moves; manual activation selects with Enter or Space. Primary pointer activation always selects.

Selection is available through `selectedIndex`, `select(index)`, and `refresh()`. A user/programmatic transition dispatches `manner-tabs-change`; initial normalization does not.
