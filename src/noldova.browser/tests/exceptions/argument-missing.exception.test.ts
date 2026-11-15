/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ToolFailure, ToolFailureCode } from "@noldova/desktop.runtime";
import { describe, expect, it } from "vitest";

import { ArgumentMissingException } from "../../src/exceptions/argument-missing.exception.ts";
import { BrowserRuntimeException } from "../../src/exceptions/browser-runtime.exception.ts";
import { InvalidInputException } from "../../src/exceptions/invalid-input.exception.ts";

describe("ArgumentMissingException", () => {
  it("keeps its facts and its message", () => {
    const exception: ArgumentMissingException = new ArgumentMissingException("reference");

    expect(exception).toBeInstanceOf(InvalidInputException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("ArgumentMissingException");
    expect(exception.message).toBe("The argument \"reference\" is missing.");
    expect(exception.argument).toEqual("reference");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Refused, "The argument \"reference\" is missing.", null));
  });
});
