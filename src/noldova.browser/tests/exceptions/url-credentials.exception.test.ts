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
import { UrlCredentialsException } from "../../src/exceptions/url-credentials.exception.ts";

describe("UrlCredentialsException", () => {
  it("keeps its facts and its message", () => {
    const exception: UrlCredentialsException = new UrlCredentialsException();

    expect(exception).toBeInstanceOf(InvalidInputException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("UrlCredentialsException");
    expect(exception.message).toBe("A URL can't carry a user name or password.");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Refused, "A URL can't carry a user name or password.", null));
  });
});
