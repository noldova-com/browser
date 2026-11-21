/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

// What came of an address the person entered: the page went there, Noldova Desktop refused its navigation, the page stayed, as for an
// address the runtime part's check refused or a later entry that took its place, or it was left for another navigation, Escape or an agent's call.
export const EntryAnswer = {
  Gone: "Gone",
  Refused: "Refused",
  Stayed: "Stayed",
  Left: "Left"
} as const;

export type EntryAnswer = (typeof EntryAnswer)[keyof typeof EntryAnswer];
