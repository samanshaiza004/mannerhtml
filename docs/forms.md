# Form validation

`<manner-form>` coordinates native constraint validation with error markup that you author. It does not create messages, move controls, inject CSS, or replace the form.

```html
<manner-form>
  <form>
    <div data-error-summary hidden tabindex="-1">
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

Before JavaScript loads, the form uses the browser's native constraint validation. After upgrade, Manner sets `noValidate` on the form and calls `checkValidity()` during submission. The browser's `ValidityState` remains the source of truth.

When a control is invalid, Manner:

- sets `aria-invalid="true"`;
- reveals matching `[data-error-for="control-id"]` nodes;
- appends the authored error IDs to `aria-describedby`;
- reveals matching `[data-summary-for="control-id"]` nodes; and
- reveals the summary when it has at least one matching item.

When the control becomes valid, Manner hides the authored nodes and restores the original `aria-describedby` and `aria-invalid` values. It focuses the first invalid control after a failed submit. `data-error-focus="first"` is the only supported focus policy in this release.

The public API is intentionally small:

```js
formElement.validate(); // returns the current validity and synchronizes errors
formElement.refresh();  // after deliberate DOM changes
```

Every error node needs an authored `id`, and every `data-error-for` or `data-summary-for` value must match a form control ID owned by the same instance. Manner rejects ambiguous or malformed relationships without partially enhancing the form.

Importing the package registers `<manner-form>`. For a custom name:

```js
import { MannerForm } from "manner/form";

class AccountForm extends MannerForm {}
customElements.define("account-form", AccountForm);
```

Do not make the summary an alert or expect Manner to generate announcements. If assistive-technology testing shows that a separate author-owned live message is needed, add it to the page deliberately.
