/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const TypedAddressAnswerKind = {
  Allowed: "Allowed",
  Refused: "Refused",
  Left: "Left"
} as const;

export type TypedAddressAnswerKind = (typeof TypedAddressAnswerKind)[keyof typeof TypedAddressAnswerKind];
