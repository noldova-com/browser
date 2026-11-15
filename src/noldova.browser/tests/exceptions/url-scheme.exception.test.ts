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
import { UrlSchemeException } from "../../src/exceptions/url-scheme.exception.ts";

describe("UrlSchemeException", () => {
  it("keeps its facts and its message", () => {
    const exception: UrlSchemeException = new UrlSchemeException();

    expect(exception).toBeInstanceOf(InvalidInputException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("UrlSchemeException");
    expect(exception.message).toBe("Only http and https URLs can be opened.");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Refused, "Only http and https URLs can be opened.", null));
  });
});
