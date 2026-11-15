/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const PaneState = {
  Empty: "Empty",
  Loading: "Loading",
  Loaded: "Loaded",
  Failed: "Failed",
  Refused: "Refused",
  Crashed: "Crashed",
  Unavailable: "Unavailable"
} as const;

export type PaneState = (typeof PaneState)[keyof typeof PaneState];
