/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { FieldSelectScript } from "../../src/models/field-select-script.ts";

describe("FieldSelectScript", () => {
  it("is the one pinned function: it selects what a text-like field, a text area or an editable element holds, reads nothing, and returns only a boolean", () => {
    expect(FieldSelectScript.functionDeclaration).toBe([
      "function () {",
      "  if (this.nodeType !== 1)",
      "    return false;",
      "  const name = this.nodeName.toUpperCase();",
      "  if (name === \"TEXTAREA\" || name === \"INPUT\" && [\"text\", \"search\", \"email\", \"url\", \"tel\", \"password\", \"number\"].includes(this.type)) {",
      "    this.select();",
      "    return true;",
      "  }",
      "  const selection = this.ownerDocument.getSelection();",
      "  if (!this.isContentEditable || selection === null)",
      "    return false;",
      "  selection.selectAllChildren(this);",
      "  return true;",
      "}"
    ].join("\n"));
  });
});
