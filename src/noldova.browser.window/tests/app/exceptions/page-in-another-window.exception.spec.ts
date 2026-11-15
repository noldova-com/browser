/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { BrowserWindowException } from "../../../src/app/exceptions/browser-window.exception.ts";
import { PageInAnotherWindowException } from "../../../src/app/exceptions/page-in-another-window.exception.ts";

describe("PageInAnotherWindowException", () => {
  it("names the page another window has, as a window exception", () => {
    const error: PageInAnotherWindowException = new PageInAnotherWindowException("page-1");

    expect(error).toBeInstanceOf(BrowserWindowException);
    expect([error.name, error.message, error.instance]).toEqual(["PageInAnotherWindowException", "The page page-1 is open in another window.", "page-1"]);
  });
});
