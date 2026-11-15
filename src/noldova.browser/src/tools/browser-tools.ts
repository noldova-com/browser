/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IBrowserTool } from "../interfaces/i-browser-tool.ts";
import type { ToolKit } from "../models/tool-kit.ts";
import { ClickTool } from "./click.tool.ts";
import { ConsoleTool } from "./console.tool.ts";
import { NavigateTool } from "./navigate.tool.ts";
import { PressKeyTool } from "./press-key.tool.ts";
import { ScreenshotTool } from "./screenshot.tool.ts";
import { SnapshotTool } from "./snapshot.tool.ts";
import { TypeTool } from "./type.tool.ts";
import { WaitForTool } from "./wait-for.tool.ts";

export class BrowserTools {
  public static create(kit: ToolKit): readonly IBrowserTool[] {
    return [new NavigateTool(kit), new SnapshotTool(kit), new ClickTool(kit), new TypeTool(kit), new PressKeyTool(kit), new ScreenshotTool(kit), new ConsoleTool(kit),
      new WaitForTool(kit)];
  }
}
