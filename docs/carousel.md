# Carousel contract

`<manner-carousel>` enhances author-owned HTML with a manual, one-visible-item sequence. It does not rotate, animate, swipe, virtualize, or move focus.

## Canonical markup

```html
<manner-carousel aria-label="Event photographs">
  <div data-slides>
    <figure data-slide aria-label="Christmas service, 2025">
      …
    </figure>
    <figure data-slide aria-label="Church picnic, 2025" hidden>
      …
    </figure>
  </div>

  <button type="button" data-previous>Previous</button>
  <button type="button" data-next>Next</button>
</manner-carousel>
```

The carousel and every slide require an accessible name from `aria-label` or `aria-labelledby`. Referenced IDs must exist and be unique. Previous and next controls must be native `<button type="button">` elements with accessible names.

Before JavaScript loads, the markup remains ordinary figures and buttons. After upgrade, MannerHTML applies:

- `role="group"` and `aria-roledescription="carousel"` to the host;
- `role="group"` and `aria-roledescription="slide"` to each slide;
- `aria-live="polite"` to `[data-slides]`;
- `hidden` to every slide except the selected slide;
- `aria-disabled="true"` at finite boundaries.

The polite live region is MannerHTML’s tested manual-carousel policy. APG describes a live region for carousel slides as optional and does not mandate `aria-live="polite"`; this is an intentional MannerHTML contract. MannerHTML does not add `aria-atomic`.

## Selection and focus

The initial selection follows the authored visibility state:

1. One visible slide is adopted.
2. If none are visible, the first slide is selected.
3. Multiple visible slides are invalid.

Previous and next keep focus on the activated button. They do not focus the new slide, its contents, or another control. This makes repeated browsing predictable and avoids hiding the user’s focused navigation control.

The default sequence is finite. At the first slide, Previous has `aria-disabled="true"`; at the last slide, Next has it. The native `disabled` attribute is not used, so the controls remain focusable. MannerHTML suppresses boundary activation.

Add `data-loop` when a cyclic sequence is genuinely appropriate:

```html
<manner-carousel aria-label="Product images" data-loop>…</manner-carousel>
```

Looping removes the boundary `aria-disabled` states and wraps previous/next navigation.

There is no arrow-key contract. Native button keyboard behavior remains available, while applications that need lightbox arrow shortcuts can add them around this primitive after testing their content.

## API

```js
const carousel = document.querySelector("manner-carousel");

carousel.selectedIndex;      // current zero-based index
carousel.selectedIndex = 1;  // programmatic selection
carousel.select(0);
carousel.next();
carousel.previous();
carousel.refresh();

carousel.addEventListener("manner-carousel-change", (event) => {
  const { index, slide, source } = event.detail;
  // source: "programmatic" | "next" | "previous"
});
```

`select()` throws `RangeError` for a non-integer or out-of-range index. Selecting the current slide or activating a finite boundary is a no-op and dispatches no event.

The event source describes the action, not the input modality: `select(2)` reports `programmatic`, `next()` reports `next`, and `previous()` reports `previous`, regardless of whether a method was called by a click handler or application code.

## Refresh and lifecycle

MannerHTML does not observe structural mutations after initialization. Call `refresh()` after deliberately inserting, removing, or reordering slides or controls.

Refresh resolves selection in this order:

1. Preserve the selected slide if that element is still owned.
2. Otherwise adopt exactly one visible slide.
3. If none are visible, select the first slide.
4. If multiple are visible, leave the current enhancement untouched and report an invalid model.

Nested `<manner-carousel>` instances and subclasses registered under custom names are isolated from one another.

## Deliberate non-features

The first Carousel release has no autoplay, timers, pause button, animation engine, swipe handling, dot navigation, multi-item viewport, or virtualized slides. These features introduce different accessibility and focus contracts and do not belong in this manual primitive.

## Dialog composition

Use native `<dialog>` for modality and focus restoration. Carousel owns only item selection and announcements:

```html
<dialog id="gallery-dialog">
  <manner-carousel aria-label="Event photographs">…</manner-carousel>
  <button commandfor="gallery-dialog" command="close">Close</button>
</dialog>
```

MannerHTML does not call `focus()` when selection changes and does not implement dialog behavior.
