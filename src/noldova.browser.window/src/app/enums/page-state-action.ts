/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const PageStateAction = {
  TryAgain: "TryAgain",
  CopyAddress: "CopyAddress",
  Back: "Back",
  Reload: "Reload",
  Close: "Close",
  AllowSite: "AllowSite",
  NotNow: "NotNow"
} as const;

export type PageStateAction = (typeof PageStateAction)[keyof typeof PageStateAction];
