/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { CallFailureException } from "../../src/exceptions/call-failure.exception.ts";
import { CallInterruptedException } from "../../src/exceptions/call-interrupted.exception.ts";
import { CallStoppedException } from "../../src/exceptions/call-stopped.exception.ts";

const cause: Error = new Error("inner");

describe("CallInterruptedException", () => {
  it("gives its subclasses no module code", () => {
    const exception: CallStoppedException = new CallStoppedException();

    expect(exception).toBeInstanceOf(CallInterruptedException);
    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception.moduleCode).toBeNull();
  });

  it("keeps the cause its subclass gives", () => {
    expect(new CallStoppedException(cause).cause).toBe(cause);
  });
});
