/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ToolFailure, ToolFailureCode } from "@noldova/desktop.runtime";
import { describe, expect, it } from "vitest";

import { ArgumentNotIndexException } from "../../src/exceptions/argument-not-index.exception.ts";
import { BrowserRuntimeException } from "../../src/exceptions/browser-runtime.exception.ts";
import { InvalidInputException } from "../../src/exceptions/invalid-input.exception.ts";

describe("ArgumentNotIndexException", () => {
  it("keeps its facts and its message", () => {
    const exception: ArgumentNotIndexException = new ArgumentNotIndexException("reference");

    expect(exception).toBeInstanceOf(InvalidInputException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("ArgumentNotIndexException");
    expect(exception.message).toBe("The argument \"reference\" must be a whole number of at least 0.");
    expect(exception.argument).toEqual("reference");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Refused, "The argument \"reference\" must be a whole number of at least 0.", null));
  });
});
