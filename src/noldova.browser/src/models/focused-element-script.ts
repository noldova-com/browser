/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

// The one function the type tool runs on its field, in the page changes' isolated world of the main frame, once it focused the field and
// before it types: it returns the element that holds the focus, as an object, or null. It starts at the field's own root, the document or
// the shadow root, open or closed, that holds the field, whose host and each host above it must hold the focus in their own roots, and goes
// down through open shadow roots; an element in another closed shadow root shows as its host. It reads nothing else and changes nothing.
// `webViews.json` pins it word for word.
export class FocusedElementScript {
  public static readonly functionDeclaration: string = `function () {
  const own = this.getRootNode();
  for (let root = own; root.nodeType === 11 && root.host !== undefined; root = root.host.getRootNode())
    if (root.host.getRootNode().activeElement !== root.host)
      return null;
  let focused = own.activeElement ?? null;
  while (focused !== null && focused.shadowRoot !== null && focused.shadowRoot.activeElement !== null)
    focused = focused.shadowRoot.activeElement;
  return focused;
}`;
}
