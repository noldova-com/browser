/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { CutText } from "../../src/models/cut-text.ts";
import { OutputLimits } from "../../src/services/output-limits.ts";

describe("OutputLimits", () => {
  it("counts UTF-8 bytes", () => {
    expect(OutputLimits.byteLength("abc")).toBe(3);
    expect(OutputLimits.byteLength("é")).toBe(2);
    expect(OutputLimits.byteLength("😀")).toBe(4);
  });

  it("keeps text within the limit whole", () => {
    expect(OutputLimits.cutText("abc", 3)).toStrictEqual(new CutText("abc", false));
  });

  it("cuts text at the limit and marks it", () => {
    expect(OutputLimits.cutText("abcdef", 4)).toStrictEqual(new CutText("abcd", true));
  });

  it("never cuts a character in half", () => {
    expect(OutputLimits.cutText("aé", 2)).toStrictEqual(new CutText("a", true));
    expect(OutputLimits.cutText("a😀b", 4)).toStrictEqual(new CutText("a", true));
    expect(OutputLimits.cutText("😀", 3)).toStrictEqual(new CutText("", true));
  });

  it("counts the bytes base64 decodes to", () => {
    expect(OutputLimits.decodedLength("")).toBe(0);
    expect(OutputLimits.decodedLength("YQ==")).toBe(1);
    expect(OutputLimits.decodedLength("YWJj")).toBe(3);
  });
});
