/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TypedAddressRefusal } from "@noldova/browser.protocol";
import { describe, expect, it } from "vitest";

import { BrowserWindowException } from "../../../src/app/exceptions/browser-window.exception.ts";
import { LinkRefusedException } from "../../../src/app/exceptions/link-refused.exception.ts";

describe("LinkRefusedException", () => {
  it("names why the runtime part refused the link, and no address, as a window exception", () => {
    const error: LinkRefusedException = new LinkRefusedException(TypedAddressRefusal.Local);

    expect(error).toBeInstanceOf(BrowserWindowException);
    expect([error.name, error.message, error.reason]).toEqual(["LinkRefusedException",
      "The runtime part refused the link's address (Local), so it opens in the system's browser.", TypedAddressRefusal.Local]);
  });
});
