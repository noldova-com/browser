/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { BrowserRuntimeException } from "../../src/exceptions/browser-runtime.exception.ts";
import { TypedRedirectPageNotOpenException } from "../../src/exceptions/typed-redirect-page-not-open.exception.ts";

describe("TypedRedirectPageNotOpenException", () => {
  it("keeps its facts and its message", () => {
    const exception: TypedRedirectPageNotOpenException = new TypedRedirectPageNotOpenException("5f0c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f", "workspace-1");

    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("TypedRedirectPageNotOpenException");
    expect(exception.message).toBe("The typed address's redirect is for a page that isn't open in its workspace.");
    expect(exception.instance).toEqual("5f0c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f");
    expect(exception.profileKey).toEqual("workspace-1");
  });
});
