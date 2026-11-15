/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ToolFailureCode } from "@noldova/desktop.runtime";
import { describe, expect, it } from "vitest";

import { CallFailureException } from "../../src/exceptions/call-failure.exception.ts";
import { InvalidInputException } from "../../src/exceptions/invalid-input.exception.ts";
import { UrlInvalidException } from "../../src/exceptions/url-invalid.exception.ts";

describe("InvalidInputException", () => {
  it("gives its subclasses the refused reason and no module code", () => {
    const exception: UrlInvalidException = new UrlInvalidException();

    expect(exception).toBeInstanceOf(InvalidInputException);
    expect(exception).toBeInstanceOf(CallFailureException);
    expect([exception.reason, exception.moduleCode]).toEqual([ToolFailureCode.Refused, null]);
  });
});
