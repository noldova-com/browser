/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const TypedAddressRefusal = {
  NotAnAddress: "NotAnAddress",
  NotWeb: "NotWeb",
  TooLong: "TooLong",
  Credentials: "Credentials",
  Local: "Local",
  NeverAllowed: "NeverAllowed"
} as const;

export type TypedAddressRefusal = (typeof TypedAddressRefusal)[keyof typeof TypedAddressRefusal];
