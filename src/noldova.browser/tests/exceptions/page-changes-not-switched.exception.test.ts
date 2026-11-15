/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { BrowserRuntimeException } from "../../src/exceptions/browser-runtime.exception.ts";
import { PageChangesNotSwitchedException } from "../../src/exceptions/page-changes-not-switched.exception.ts";

describe("PageChangesNotSwitchedException", () => {
  it("keeps its facts and its message", () => {
    const exception: PageChangesNotSwitchedException = new PageChangesNotSwitchedException("view-1", "frame-1");

    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("PageChangesNotSwitchedException");
    expect(exception.message).toBe("The page's isolated world came back without the binding that reports its changes switched on.");
    expect(exception.viewId).toEqual("view-1");
    expect(exception.frameId).toEqual("frame-1");
  });
});
