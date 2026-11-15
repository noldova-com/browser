/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { BrowserRuntimeException } from "../../src/exceptions/browser-runtime.exception.ts";
import { PageUrlInvalidException } from "../../src/exceptions/page-url-invalid.exception.ts";
import { WindowRequestMalformedException } from "../../src/exceptions/window-request-malformed.exception.ts";

describe("PageUrlInvalidException", () => {
  it("keeps its facts and its message", () => {
    const exception: PageUrlInvalidException = new PageUrlInvalidException();

    expect(exception).toBeInstanceOf(WindowRequestMalformedException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("PageUrlInvalidException");
    expect(exception.message).toBe("The page record's address must be at most 32,768 characters.");
  });
});
