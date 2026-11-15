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
import { ExactlyOneArgumentException } from "../../src/exceptions/exactly-one-argument.exception.ts";
import { InvalidInputException } from "../../src/exceptions/invalid-input.exception.ts";

describe("ExactlyOneArgumentException", () => {
  it("keeps its facts and its message", () => {
    const exception: ExactlyOneArgumentException = new ExactlyOneArgumentException(["url", "action"]);

    expect(exception).toBeInstanceOf(InvalidInputException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("ExactlyOneArgumentException");
    expect(exception.message).toBe("Give exactly one of the arguments \"url\", \"action\".");
    expect(exception.names).toEqual(["url", "action"]);
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Refused, "Give exactly one of the arguments \"url\", \"action\".", null));
  });
});
