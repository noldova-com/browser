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
import { CallTooLargeException } from "../../src/exceptions/call-too-large.exception.ts";
import { ReplyTooLargeException } from "../../src/exceptions/reply-too-large.exception.ts";
import { ResultTooLargeException } from "../../src/exceptions/result-too-large.exception.ts";

const cause: Error = new Error("inner");

describe("CallTooLargeException", () => {
  it("gives its subclasses the too-large reason and no module code", () => {
    const exception: ResultTooLargeException = new ResultTooLargeException();

    expect(exception).toBeInstanceOf(CallTooLargeException);
    expect(exception).toBeInstanceOf(CallFailureException);
    expect([exception.reason, exception.moduleCode]).toEqual([ToolFailureCode.TooLarge, null]);
  });

  it("keeps the cause its subclass gives", () => {
    expect(new ReplyTooLargeException(cause).cause).toBe(cause);
  });
});
