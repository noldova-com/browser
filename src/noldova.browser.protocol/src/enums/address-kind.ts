/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const AddressKind = {
  Public: "Public",
  Loopback: "Loopback",
  Private: "Private",
  LinkLocal: "LinkLocal",
  Unspecified: "Unspecified"
} as const;

export type AddressKind = (typeof AddressKind)[keyof typeof AddressKind];
