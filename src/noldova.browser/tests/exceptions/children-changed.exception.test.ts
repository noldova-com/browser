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
import { ChildrenChangedException } from "../../src/exceptions/children-changed.exception.ts";

const MESSAGE: string = "The page changed the children of a node while the snapshot read them; take a new snapshot.";

describe("ChildrenChangedException", () => {
  it("keeps its facts and its message", () => {
    const exception: ChildrenChangedException = new ChildrenChangedException();

    expect(exception).toBeInstanceOf(CallFailureException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("ChildrenChangedException");
    expect(exception.message).toBe(MESSAGE);
    expect(exception.toFailure()).toEqual(new ToolFailure(ToolFailureCode.Stale, MESSAGE, null));
  });
});
