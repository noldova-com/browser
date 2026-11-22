/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const ViewEventKind = {
  Closed: "Closed",
  State: "State",
  LoadFailed: "LoadFailed",
  NavigationRefused: "NavigationRefused",
  Crashed: "Crashed",
  ProfileCleared: "ProfileCleared",
  RequestRefused: "RequestRefused",
  NewWindowRequested: "NewWindowRequested",
  Key: "Key",
  Zoom: "Zoom",
  Favicon: "Favicon"
} as const;

export type ViewEventKind = (typeof ViewEventKind)[keyof typeof ViewEventKind];
