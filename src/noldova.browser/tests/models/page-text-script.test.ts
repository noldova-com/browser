/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { PageTextScript } from "../../src/models/page-text-script.ts";

describe("PageTextScript", () => {
  it("is the one pinned function: it takes only the text, reads only the text the page's body shows, and returns only a boolean", () => {
    expect(PageTextScript.functionDeclaration).toBe([
      "function (text) {",
      "  if (typeof text !== \"string\")",
      "    return false;",
      "  const body = document.body;",
      "  return body !== null && body.innerText.includes(text);",
      "}"
    ].join("\n"));
  });
});
