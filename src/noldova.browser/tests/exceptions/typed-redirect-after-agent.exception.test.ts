/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { BrowserRuntimeException } from "../../src/exceptions/browser-runtime.exception.ts";
import { TypedRedirectAfterAgentException } from "../../src/exceptions/typed-redirect-after-agent.exception.ts";

describe("TypedRedirectAfterAgentException", () => {
  it("keeps its facts and its message", () => {
    const exception: TypedRedirectAfterAgentException = new TypedRedirectAfterAgentException("5f0c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f");

    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect(exception.name).toBe("TypedRedirectAfterAgentException");
    expect(exception.message).toBe("The typed address's redirect came after an agent acted on its page, so its page doesn't follow it.");
    expect(exception.instance).toEqual("5f0c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f");
  });
});
