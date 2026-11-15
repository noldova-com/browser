/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const ConsoleLevel = {
  Debug: "Debug",
  Info: "Info",
  Warning: "Warning",
  Error: "Error"
} as const;

export type ConsoleLevel = (typeof ConsoleLevel)[keyof typeof ConsoleLevel];
