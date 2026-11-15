/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const PageAction = {
  Navigating: "Navigating",
  Reading: "Reading",
  Clicking: "Clicking",
  Typing: "Typing",
  PressingKey: "PressingKey",
  Waiting: "Waiting"
} as const;

export type PageAction = (typeof PageAction)[keyof typeof PageAction];
