/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const ZoomStep = {
  In: "In",
  Out: "Out",
  Reset: "Reset"
} as const;

export type ZoomStep = (typeof ZoomStep)[keyof typeof ZoomStep];
