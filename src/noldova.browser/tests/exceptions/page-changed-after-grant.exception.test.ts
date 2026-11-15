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
import { CallFailureException } from "../../src/exceptions/call-failure.exception.ts";
import { PageChangedAfterGrantException } from "../../src/exceptions/page-changed-after-grant.exception.ts";

const cause: Error = new Error("inner");

describe("PageChangedAfterGrantException", () => {
  it("keeps its facts and its message", () => {
    const exception: PageChangedAfterGrantException = new PageChangedAfterGrantException(cause);

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("PageChangedAfterGrantException");
    expect(exception.message).toBe("The page changed after the action was allowed, so nothing ran; take a new snapshot.");
    expect(exception.cause).toBe(cause);
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Stale, "The page changed after the action was allowed, so nothing ran; take a new snapshot.", null));
  });

  it("has no cause when given none", () => {
    expect(new PageChangedAfterGrantException().cause).toBeUndefined();
  });
});
