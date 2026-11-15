/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { BrowserToolName } from "../types/browser-tool-name.ts";

export class BrowserToolNames {
  public static readonly navigate: BrowserToolName = "browser_navigate";
  public static readonly snapshot: BrowserToolName = "browser_snapshot";
  public static readonly click: BrowserToolName = "browser_click";
  public static readonly type: BrowserToolName = "browser_type";
  public static readonly pressKey: BrowserToolName = "browser_press_key";
  public static readonly screenshot: BrowserToolName = "browser_screenshot";
  public static readonly console: BrowserToolName = "browser_console";
  public static readonly waitFor: BrowserToolName = "browser_wait_for";
  public static readonly all: readonly BrowserToolName[] = [
    BrowserToolNames.navigate,
    BrowserToolNames.snapshot,
    BrowserToolNames.click,
    BrowserToolNames.type,
    BrowserToolNames.pressKey,
    BrowserToolNames.screenshot,
    BrowserToolNames.console,
    BrowserToolNames.waitFor
  ];

  public static includes(value: string): value is BrowserToolName {
    return BrowserToolNames.all.some(t => t === value);
  }
}
