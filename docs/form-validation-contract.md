# Form validation contract

`<manner-form>` coordinates native constraint validation with error UI that authors own. MannerHTML does not generate messages, replace controls, move content, inject CSS, or create a live region.

## Markup

```html
<manner-form>
  <form>
    <div data-error-summary aria-live="polite" hidden tabindex="-1">
      <h2>Fix these problems</h2>
      <ul>
        <li data-summary-for="email" hidden>
          <a href="#email">Enter a valid email address</a>
        </li>
      </ul>
    </div>

    <label for="email">Email</label>
    <input id="email" name="email" type="email" required>
    <p id="email-error" data-error-for="email" hidden>
      Enter a valid email address.
    </p>

    <button type="submit">Send</button>
  </form>
</manner-form>
```

Before JavaScript loads, the browser's native constraint validation remains in control. After upgrade, MannerHTML sets `form.noValidate = true` for normal submission and uses `form.checkValidity()` and each control's `ValidityState` as the source of truth.

On invalid submission, MannerHTML prevents the submit, synchronizes all invalid controls, and focuses the first visible invalid focusable control. If every invalid control is hidden, it falls back to the first invalid control. It deliberately lets focus use the browser's normal scrolling behavior. This keeps the visual viewport aligned with the focused field on long forms; authors should not add `preventScroll: true` to their own submit handlers around MannerHTML.

## Error relationships

For each invalid control, MannerHTML:

- sets `aria-invalid="true"`;
- reveals matching `[data-error-for="control-id"]` nodes;
- appends the authored error IDs to `aria-describedby` without removing authored descriptions;
- reveals matching `[data-summary-for="control-id"]` items; and
- reveals `[data-error-summary]` when it has at least one visible summary item.

When a control becomes valid after `input` or `change`, MannerHTML hides the matching author-owned nodes and restores the original `aria-describedby` and `aria-invalid` values. Every error node needs an authored `id`, and every relationship target must be an owned control ID or an owned fieldset ID.

## Summary announcements

An error summary that only becomes visible is not reliably announced to screen reader users. MannerHTML toggles `hidden` on `[data-error-summary]` based on whether it has visible items, so `aria-live` on that same root is not a guarantee: some screen readers register live regions only while they are in the accessibility tree. Add an author-owned announcement mechanism to the summary. Prefer `aria-live="polite"` when the summary contains interactive links, and focus the summary after an invalid submit when it is important that the heading and links are read:

```html
<div data-error-summary aria-live="polite" hidden tabindex="-1">
  …
</div>
```

For a short, non-interactive summary message, `role="alert"` is also an option. Do not make an interactive list of error links an assertive alert by default. For announcement behavior that must work without moving focus, keep a separate author-owned live region in the document from first paint and update its text in the submit handler. MannerHTML does not inject `aria-live`, `role="alert"`, focus changes to the summary, or announcement text because the author owns the summary's content and communication policy.

## Radio and checkbox groups

Use native grouping with `<fieldset>` and `<legend>`. Give the group an ID and target the group error and summary at that ID rather than attaching separate error relationships to every radio or checkbox:

```html
<fieldset id="contact-method">
  <legend>Preferred contact method</legend>
  <label><input type="radio" name="contact" value="email" required>Email</label>
  <label><input type="radio" name="contact" value="phone">Phone</label>
</fieldset>
<p id="contact-method-error" data-error-for="contact-method" hidden>
  Choose a contact method.
</p>
```

MannerHTML applies `aria-invalid` to the invalid native controls and coordinates the group error/summary relationship through the owning fieldset. This avoids relying on browser-specific choices about which radio in a required group is reported as invalid. Use a real `<legend>`; do not replace the fieldset's group name with a generic heading.

## API and boundaries

```js
formElement.validate(); // returns validity and synchronizes errors
formElement.refresh();  // after deliberate DOM changes
```

`data-error-focus="first"` is the only supported focus policy. MannerHTML does not automatically focus the summary, generate error text, add a live region, or use `aria-errormessage` as a fundamental relationship. Test the authored summary and focus behavior with the assistive technologies you support.

Malformed or ambiguous relationships fail without partial enhancement. Custom names are supported with a subclass:

```js
import { MannerForm } from "mannerhtml/form";

class AccountForm extends MannerForm {}
customElements.define("account-form", AccountForm);
```
