/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

// The one function the wait tool runs, in the page changes' isolated world of the main frame, for a page whose accessibility tree is too
// large for one reply: it takes only the text, reads only the text the page shows, never a field's value, and returns only whether it holds
// the text. `webViews.json` pins it word for word.
export class PageTextScript {
  public static readonly functionDeclaration: string = `function (text) {
  if (typeof text !== "string")
    return false;
  const body = document.body;
  return body !== null && body.innerText.includes(text);
}`;
}
