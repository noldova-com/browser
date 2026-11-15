/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ToolFailure, ToolFailureCode } from "@noldova/desktop.runtime";
import { describe, expect, it } from "vitest";

import { ArgumentNotOneOfException } from "../../src/exceptions/argument-not-one-of.exception.ts";
import { BrowserRuntimeException } from "../../src/exceptions/browser-runtime.exception.ts";
import { InvalidInputException } from "../../src/exceptions/invalid-input.exception.ts";

describe("ArgumentNotOneOfException", () => {
  it("keeps its facts and its message", () => {
    const exception: ArgumentNotOneOfException = new ArgumentNotOneOfException("reference", ["back", "forward"]);

    expect(exception).toBeInstanceOf(InvalidInputException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("ArgumentNotOneOfException");
    expect(exception.message).toBe("The argument \"reference\" must be one of back, forward.");
    expect(exception.argument).toEqual("reference");
    expect(exception.values).toEqual(["back", "forward"]);
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Refused, "The argument \"reference\" must be one of back, forward.", null));
  });
});
