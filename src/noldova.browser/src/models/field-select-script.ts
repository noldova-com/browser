/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

// The one function the type tool runs on its field, in the page changes' isolated world of the main frame, right before it types: it selects
// what the field holds, so the typed text replaces it, and returns only whether it did, which it doesn't for an element that isn't a text
// field or an editable element. It reads nothing. `webViews.json` pins it word for word.
export class FieldSelectScript {
  public static readonly functionDeclaration: string = `function () {
  if (this.nodeType !== 1)
    return false;
  const name = this.nodeName.toUpperCase();
  if (name === "INPUT" || name === "TEXTAREA") {
    this.select();
    return true;
  }
  const selection = this.ownerDocument.getSelection();
  if (!this.isContentEditable || selection === null)
    return false;
  selection.selectAllChildren(this);
  return true;
}`;
}
