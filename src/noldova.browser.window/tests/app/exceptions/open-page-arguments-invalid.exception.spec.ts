/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { BrowserWindowException } from "../../../src/app/exceptions/browser-window.exception.ts";
import { OpenPageArgumentsInvalidException } from "../../../src/app/exceptions/open-page-arguments-invalid.exception.ts";

describe("OpenPageArgumentsInvalidException", () => {
  it("names itself and says what browser.openPage needs, as a window exception", () => {
    const error: OpenPageArgumentsInvalidException = new OpenPageArgumentsInvalidException();

    expect(error).toBeInstanceOf(BrowserWindowException);
    expect([error.name, error.message]).toEqual(["OpenPageArgumentsInvalidException", "browser.openPage needs { profileKey?, url?, instance? }: a profile key of lowercase letters, digits and hyphens other than links, or none for the person's own browsing, the address as text, and the instance as a lowercase UUID, with a profile key."]);
  });
});
