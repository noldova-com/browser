/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ToolFailure, ToolFailureCode } from "@noldova/desktop.runtime";
import { describe, expect, it } from "vitest";

import { ArgumentNotTextException } from "../../src/exceptions/argument-not-text.exception.ts";
import { BrowserRuntimeException } from "../../src/exceptions/browser-runtime.exception.ts";
import { InvalidInputException } from "../../src/exceptions/invalid-input.exception.ts";

describe("ArgumentNotTextException", () => {
  it("keeps its facts and its message", () => {
    const exception: ArgumentNotTextException = new ArgumentNotTextException("reference");

    expect(exception).toBeInstanceOf(InvalidInputException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("ArgumentNotTextException");
    expect(exception.message).toBe("The argument \"reference\" must be text.");
    expect(exception.argument).toEqual("reference");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Refused, "The argument \"reference\" must be text.", null));
  });
});
