/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TypedAddressRefusal } from "@noldova/browser.protocol";
import { describe, expect, it } from "vitest";

import { AddressReading } from "../../../src/app/models/address-reading.ts";

describe("AddressReading", () => {
  it("keeps the address and the refusal, none for an address on the web", () => {
    const allowed: AddressReading = new AddressReading("https://example.com/", null);
    const refused: AddressReading = new AddressReading("release notes", TypedAddressRefusal.NotAnAddress);

    expect([allowed.address, allowed.refusal, refused.address, refused.refusal]).toEqual(["https://example.com/", null, "release notes", "NotAnAddress"]);
  });
});
