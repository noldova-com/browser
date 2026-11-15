/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { describe, expect, it } from "vitest";

import { BrowserRuntimeException } from "../../src/exceptions/browser-runtime.exception.ts";
import { WindowRequestMalformedException } from "../../src/exceptions/window-request-malformed.exception.ts";
import { WindowRequestUnreadException } from "../../src/exceptions/window-request-unread.exception.ts";

describe("WindowRequestUnreadException", () => {
  it("keeps the field's path, its message and its cause", () => {
    const cause: JsonException = new JsonException("The field is required.", "$.instance");
    const exception: WindowRequestUnreadException = new WindowRequestUnreadException("$.instance", new ExceptionOptions(cause));

    expect(exception).toBeInstanceOf(WindowRequestMalformedException);
    expect(exception).toBeInstanceOf(BrowserRuntimeException);
    expect([exception.name, exception.path, exception.message, exception.cause])
      .toEqual(["WindowRequestUnreadException", "$.instance", "The window's request doesn't have the shape this version reads, at $.instance.", cause]);
  });

  it("has no cause unless given one", () => {
    expect(new WindowRequestUnreadException("$").cause).toBeUndefined();
  });
});
