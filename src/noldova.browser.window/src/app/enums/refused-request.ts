/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const RefusedRequest = {
  Download: "Download",
  NewWindow: "NewWindow",
  Permission: "Permission",
  FileChooser: "FileChooser",
  Authentication: "Authentication",
  Certificate: "Certificate",
  NestedView: "NestedView"
} as const;

export type RefusedRequest = (typeof RefusedRequest)[keyof typeof RefusedRequest];
