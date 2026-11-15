/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";
import { describe, expect, it } from "vitest";

import { WindowRequestUnreadException } from "../../src/exceptions/window-request-unread.exception.ts";
import { WindowRequests } from "../../src/services/window-requests.ts";

describe("WindowRequests", () => {
  it("returns what the read returns", () => {
    expect(WindowRequests.read(() => "page")).toBe("page");
  });

  it("turns the read's JSON failure into a window request it doesn't read, at the failure's path", () => {
    const failure: JsonException = new JsonException("The field isn't part of the message.", "$.extra");

    const reading = (): never => WindowRequests.read(() => {
      throw failure;
    });

    expect(reading).toThrow(WindowRequestUnreadException);
    expect(reading).toThrow(expect.objectContaining({ path: "$.extra", cause: failure }));
  });

  it("passes on any other failure as it is", () => {
    const failure: TypeError = new TypeError("Cannot read properties of undefined");

    expect(() => WindowRequests.read(() => {
      throw failure;
    })).toThrow(failure);
  });
});
