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
import { UrlInvalidException } from "../../src/exceptions/url-invalid.exception.ts";

describe("UrlInvalidException", () => {
  it("keeps its facts and its message", () => {
    const exception: UrlInvalidException = new UrlInvalidException();

    expect(exception).toBeInstanceOf(InvalidInputException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("UrlInvalidException");
    expect(exception.message).toBe("The URL isn't valid.");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Refused, "The URL isn't valid.", null));
  });
});
