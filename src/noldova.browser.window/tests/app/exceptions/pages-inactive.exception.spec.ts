/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { BrowserWindowException } from "../../../src/app/exceptions/browser-window.exception.ts";
import { PagesInactiveException } from "../../../src/app/exceptions/pages-inactive.exception.ts";

describe("PagesInactiveException", () => {
  it("names itself and says the window part isn't active, as a window exception", () => {
    const error: PagesInactiveException = new PagesInactiveException();

    expect(error).toBeInstanceOf(BrowserWindowException);
    expect([error.name, error.message]).toEqual(["PagesInactiveException", "A page document shows only while Browser's window part is active."]);
  });
});
