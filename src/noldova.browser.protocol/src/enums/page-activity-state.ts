/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const PageActivityState = {
  Acting: "Acting",
  Asking: "Asking",
  Ended: "Ended"
} as const;

export type PageActivityState = (typeof PageActivityState)[keyof typeof PageActivityState];
