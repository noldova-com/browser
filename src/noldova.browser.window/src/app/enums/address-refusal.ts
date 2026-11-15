/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TypedAddressRefusal } from "@noldova/browser.protocol";

export const AddressRefusal = {
  NotAnAddress: TypedAddressRefusal.NotAnAddress,
  NotWeb: TypedAddressRefusal.NotWeb,
  TooLong: TypedAddressRefusal.TooLong,
  Credentials: TypedAddressRefusal.Credentials,
  Local: TypedAddressRefusal.Local,
  NeverAllowed: TypedAddressRefusal.NeverAllowed,
  Failed: "Failed"
} as const;

export type AddressRefusal = (typeof AddressRefusal)[keyof typeof AddressRefusal];
