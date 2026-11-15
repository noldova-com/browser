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
import { ChangedDuringReadException } from "../../src/exceptions/changed-during-read.exception.ts";

describe("ChangedDuringReadException", () => {
  it("keeps its facts and its message", () => {
    const exception: ChangedDuringReadException = new ChangedDuringReadException();

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("ChangedDuringReadException");
    expect(exception.message).toBe("The page went to another document while it was read, twice; take a new snapshot.");
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Stale, "The page went to another document while it was read, twice; take a new snapshot.", null));
  });
});
