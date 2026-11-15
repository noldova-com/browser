/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IToolDescriptor, ToolCall, ToolResult } from "@noldova/desktop.runtime";

import type { ActionProgress } from "../models/action-progress.ts";

export interface IBrowserTool {
  readonly descriptor: IToolDescriptor;
  callAsync(call: ToolCall, progress: ActionProgress): Promise<ToolResult>;
}
