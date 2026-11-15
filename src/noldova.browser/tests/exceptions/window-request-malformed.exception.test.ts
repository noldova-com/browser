/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { BrowserRuntimeException } from "../../src/exceptions/browser-runtime.exception.ts";
import { CallFailureException } from "../../src/exceptions/call-failure.exception.ts";
import { PageInstanceInvalidException } from "../../src/exceptions/page-instance-invalid.exception.ts";
import { WindowRequestMalformedException } from "../../src/exceptions/window-request-malformed.exception.ts";

describe("WindowRequestMalformedException", () => {
  it("is a BrowserRuntimeException but no call failure", () => {
    const exception: PageInstanceInvalidException = new PageInstanceInvalidException();

    expect(exception).toBeInstanceOf(WindowRequestMalformedException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception).not.toBeInstanceOf(CallFailureException);
    expect([exception.name, exception.message]).toEqual(["PageInstanceInvalidException", "The page request needs the document's instance, a lowercase UUID."]);
  });

  it("has no cause", () => {
    expect(new PageInstanceInvalidException().cause).toBeUndefined();
  });
});
