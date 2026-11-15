/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ToolFailure, ToolFailureCode } from "@noldova/desktop.runtime";
import { describe, expect, it } from "vitest";

import { ArgumentTooLargeException } from "../../src/exceptions/argument-too-large.exception.ts";
import { BrowserRuntimeException } from "../../src/exceptions/browser-runtime.exception.ts";
import { InvalidInputException } from "../../src/exceptions/invalid-input.exception.ts";

describe("ArgumentTooLargeException", () => {
  it("keeps its facts and its message", () => {
    const exception: ArgumentTooLargeException = new ArgumentTooLargeException("reference", 3);

    expect(exception).toBeInstanceOf(InvalidInputException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("ArgumentTooLargeException");
    expect(exception.message).toBe("The argument \"reference\" is more than 3.");
    expect(exception.argument).toEqual("reference");
    expect(exception.maximum).toEqual(3);
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Refused, "The argument \"reference\" is more than 3.", null));
  });
});
