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
  it("names itself and says the app's browser, or this browser with no name, can't show a page while its window part isn't active, as a window exception", () => {
    const named: PagesInactiveException = new PagesInactiveException("Fixture App");
    const unnamed: PagesInactiveException = new PagesInactiveException(null);

    expect(named).toBeInstanceOf(BrowserWindowException);
    expect([named.name, named.message, unnamed.message]).toEqual(["PagesInactiveException", "Fixture App's browser can't show a page here, since its window part isn't active.",
      "This browser can't show a page here, since its window part isn't active."]);
  });
});
