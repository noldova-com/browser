/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const MouseButton = {
  Left: "Left",
  Middle: "Middle",
  Right: "Right"
} as const;

export type MouseButton = (typeof MouseButton)[keyof typeof MouseButton];
