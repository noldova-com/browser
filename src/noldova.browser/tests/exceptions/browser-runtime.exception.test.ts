/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";
import { describe, expect, it } from "vitest";

import { BrowserRuntimeException } from "../../src/exceptions/browser-runtime.exception.ts";
import { PageChangesNotSwitchedException } from "../../src/exceptions/page-changes-not-switched.exception.ts";
import { PermissionWithdrawnException } from "../../src/exceptions/permission-withdrawn.exception.ts";

const cause: Error = new Error("inner");

describe("BrowserRuntimeException", () => {
  it("is an Exception that takes the name and the message its subclass gives", () => {
    const exception: PageChangesNotSwitchedException = new PageChangesNotSwitchedException("view-1", "frame-1");

    expect(exception).toBeInstanceOf(Exception);
    expect(exception).toBeInstanceOf(Error);
    expect([exception.name, exception.message]).toEqual(["PageChangesNotSwitchedException", "The page's isolated world came back without the binding that reports its changes switched on."]);
  });

  it("keeps the cause its subclass gives", () => {
    const exception: PermissionWithdrawnException = new PermissionWithdrawnException(cause);

    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.cause).toBe(cause);
  });

  it("has no cause when its subclass gives none", () => {
    expect(new PageChangesNotSwitchedException("view-1", "frame-1").cause).toBeUndefined();
  });
});
