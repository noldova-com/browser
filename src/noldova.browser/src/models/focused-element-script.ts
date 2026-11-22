/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

// The one function the type tool runs on its field, in the page changes' isolated world of the main frame, once it focused the field and
// before it types: it returns the element that holds the focus, as an object, through open shadow roots, or null. A closed shadow root's
// element shows as its host. It reads nothing else and changes nothing. `webViews.json` pins it word for word.
export class FocusedElementScript {
  public static readonly functionDeclaration: string = `function () {
  let focused = this.ownerDocument.activeElement;
  while (focused !== null && focused.shadowRoot !== null && focused.shadowRoot.activeElement !== null)
    focused = focused.shadowRoot.activeElement;
  return focused;
}`;
}
