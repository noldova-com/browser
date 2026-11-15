/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { PopupOffer } from "../../../src/app/models/popup-offer.ts";

describe("PopupOffer", () => {
  it("keeps the address asked for, the origin that asked and whether the person's input came just before", () => {
    const offer: PopupOffer = new PopupOffer("https://ads.example/", "https://one.example", true);

    expect([offer.address, offer.origin, offer.hadRecentInput]).toEqual(["https://ads.example/", "https://one.example", true]);
  });
});
