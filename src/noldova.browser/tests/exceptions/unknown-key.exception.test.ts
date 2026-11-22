/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ToolFailure, ToolFailureCode } from "@noldova/desktop.runtime";
import { describe, expect, it } from "vitest";

import { BrowserRuntimeException } from "../../src/exceptions/browser-runtime.exception.ts";
import { InvalidInputException } from "../../src/exceptions/invalid-input.exception.ts";
import { UnknownKeyException } from "../../src/exceptions/unknown-key.exception.ts";

describe("UnknownKeyException", () => {
  it("keeps its facts and its message", () => {
    const exception: UnknownKeyException = new UnknownKeyException("Escape");

    expect(exception).toBeInstanceOf(InvalidInputException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("UnknownKeyException");
    expect(exception.message).toBe("The key \"Escape\" is neither a named key nor one character other than a control character.");
    expect(exception.key).toEqual("Escape");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Refused, "The key \"Escape\" is neither a named key nor one character other than a control character.", null));
  });
});
