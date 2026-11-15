/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { BrowserRuntimeException } from "../../src/exceptions/browser-runtime.exception.ts";
import { PageChangesContextMissingException } from "../../src/exceptions/page-changes-context-missing.exception.ts";

describe("PageChangesContextMissingException", () => {
  it("keeps its facts and its message", () => {
    const exception: PageChangesContextMissingException = new PageChangesContextMissingException("view-1", "frame-1");

    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("PageChangesContextMissingException");
    expect(exception.message).toBe("The page's isolated world came back without a context the view reported for it.");
    expect(exception.viewId).toEqual("view-1");
    expect(exception.frameId).toEqual("frame-1");
  });
});
