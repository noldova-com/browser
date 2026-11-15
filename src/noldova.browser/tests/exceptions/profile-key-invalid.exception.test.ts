/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { BrowserRuntimeException } from "../../src/exceptions/browser-runtime.exception.ts";
import { ProfileKeyInvalidException } from "../../src/exceptions/profile-key-invalid.exception.ts";
import { WindowRequestMalformedException } from "../../src/exceptions/window-request-malformed.exception.ts";

describe("ProfileKeyInvalidException", () => {
  it("keeps its facts and its message", () => {
    const exception: ProfileKeyInvalidException = new ProfileKeyInvalidException();

    expect(exception).toBeInstanceOf(WindowRequestMalformedException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("ProfileKeyInvalidException");
    expect(exception.message).toBe("The request needs a profile key of lower-case letters, digits and hyphens, at most 64 characters, starting with a letter or a digit.");
  });
});
