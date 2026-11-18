/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

// The function the snapshot runs, in the page changes' isolated world of the main frame, before it reads the page's whole accessibility
// tree: it takes only the most elements, counts the document's elements and those of every open shadow root, stops once past the most, and
// returns only whether the page holds no more. `webViews.json` pins it word for word.
export class ElementCountScript {
  public static readonly functionDeclaration: string = `function (most) {
  if (typeof most !== "number")
    return true;
  const roots = [document];
  let count = 0;
  while (roots.length > 0) {
    const walker = document.createTreeWalker(roots.pop(), NodeFilter.SHOW_ELEMENT);
    while (walker.nextNode() !== null) {
      count++;
      if (count > most)
        return false;
      const shadow = walker.currentNode.shadowRoot;
      if (shadow !== null)
        roots.push(shadow);
    }
  }
  return true;
}`;
}
