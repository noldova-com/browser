/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TypedAddressRefusal } from "@noldova/browser.protocol";

// What the address field's text reads as: the web address it names, with no refusal, or the trimmed text with the reason it names none.
export class AddressReading {
  public readonly address: string;
  public readonly refusal: TypedAddressRefusal | null;

  public constructor(address: string, refusal: TypedAddressRefusal | null) {
    this.address = address;
    this.refusal = refusal;
  }
}
