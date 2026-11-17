/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export type AllowedMethod =
  | "Page.enable"
  | "Page.getFrameTree"
  | "Page.createIsolatedWorld"
  | "Page.getNavigationHistory"
  | "Page.getLayoutMetrics"
  | "Page.captureScreenshot"
  | "Accessibility.getFullAXTree"
  | "Accessibility.getPartialAXTree"
  | "Accessibility.enable"
  | "Accessibility.disable"
  | "Accessibility.getRootAXNode"
  | "Accessibility.getChildAXNodes"
  | "DOM.getDocument"
  | "DOM.querySelector"
  | "DOM.describeNode"
  | "DOM.resolveNode"
  | "DOM.scrollIntoViewIfNeeded"
  | "DOM.getContentQuads"
  | "DOM.getNodeForLocation"
  | "DOM.focus"
  | "Emulation.setDeviceMetricsOverride"
  | "Emulation.clearDeviceMetricsOverride"
  | "Input.dispatchMouseEvent"
  | "Input.dispatchKeyEvent"
  | "Input.insertText"
  | "Runtime.enable"
  | "Runtime.disable"
  | "Runtime.discardConsoleEntries"
  | "Runtime.addBinding"
  | "Runtime.callFunctionOn"
  | "Runtime.releaseObject"
  | "Log.enable";
