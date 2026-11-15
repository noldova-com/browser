/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ToolFailure, ToolFailureCode } from "@noldova/desktop.runtime";
import { describe, expect, it } from "vitest";

import { ArgumentTooLongException } from "../../src/exceptions/argument-too-long.exception.ts";
import { BrowserRuntimeException } from "../../src/exceptions/browser-runtime.exception.ts";
import { InvalidInputException } from "../../src/exceptions/invalid-input.exception.ts";

describe("ArgumentTooLongException", () => {
  it("keeps its facts and its message", () => {
    const exception: ArgumentTooLongException = new ArgumentTooLongException("reference", 32);

    expect(exception).toBeInstanceOf(InvalidInputException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("ArgumentTooLongException");
    expect(exception.message).toBe("The argument \"reference\" is longer than 32 characters.");
    expect(exception.argument).toEqual("reference");
    expect(exception.maximumLength).toEqual(32);
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Refused, "The argument \"reference\" is longer than 32 characters.", null));
  });
});
