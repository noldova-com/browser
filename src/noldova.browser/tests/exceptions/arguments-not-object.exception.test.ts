/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ToolFailure, ToolFailureCode } from "@noldova/desktop.runtime";
import { describe, expect, it } from "vitest";

import { ArgumentsNotObjectException } from "../../src/exceptions/arguments-not-object.exception.ts";
import { BrowserRuntimeException } from "../../src/exceptions/browser-runtime.exception.ts";
import { InvalidInputException } from "../../src/exceptions/invalid-input.exception.ts";

describe("ArgumentsNotObjectException", () => {
  it("keeps its facts and its message", () => {
    const exception: ArgumentsNotObjectException = new ArgumentsNotObjectException();

    expect(exception).toBeInstanceOf(InvalidInputException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("ArgumentsNotObjectException");
    expect(exception.message).toBe("The arguments must be an object.");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Refused, "The arguments must be an object.", null));
  });
});
