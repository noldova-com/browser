/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { FocusedElementScript } from "../../src/models/focused-element-script.ts";

describe("FocusedElementScript", () => {
  it("is the one pinned function: it returns the element that holds the focus through open shadow roots, and reads and changes nothing else", () => {
    expect(FocusedElementScript.functionDeclaration).toBe([
      "function () {",
      "  let focused = this.ownerDocument.activeElement;",
      "  while (focused !== null && focused.shadowRoot !== null && focused.shadowRoot.activeElement !== null)",
      "    focused = focused.shadowRoot.activeElement;",
      "  return focused;",
      "}"
    ].join("\n"));
  });
});
