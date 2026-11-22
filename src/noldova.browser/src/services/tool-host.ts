/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IModuleSettings, type IToolsContext, type Registration, type ToolCall, ToolFailureException, type ToolResult } from "@noldova/desktop.runtime";

import { ToolsOffException } from "../exceptions/tools-off.exception.ts";
import type { IBrowserTool } from "../interfaces/i-browser-tool.ts";
import { ActionProgress } from "../models/action-progress.ts";
import type { SessionStates } from "../models/session-states.ts";
import { Resources } from "../resources.ts";
import { ToolFailures } from "./tool-failures.ts";

export class ToolHost {
  private readonly tools: IToolsContext;
  private readonly sessions: SessionStates;
  private readonly settings: IModuleSettings;

  public constructor(tools: IToolsContext, sessions: SessionStates, settings: IModuleSettings) {
    this.tools = tools;
    this.sessions = sessions;
    this.settings = settings;
  }

  public start(): Registration {
    return this.tools.onSessionEnded(t => this.sessions.end(t));
  }

  public register(tool: IBrowserTool): Registration {
    return this.tools.register(tool.descriptor, {
      handleAsync: async (call: ToolCall): Promise<ToolResult> => {
        if (this.settings.read(Resources.agentToolsSetting) === false)
          throw new ToolFailureException(new ToolsOffException().toFailure());
        return ToolHost.callAsync(tool, call);
      }
    });
  }

  private static async callAsync(tool: IBrowserTool, call: ToolCall): Promise<ToolResult> {
    const progress: ActionProgress = new ActionProgress(tool.descriptor.marksSending === true ? () => call.markSending() : () => undefined);
    try {
      return await tool.callAsync(call, progress);
    }
    catch (error) {
      // Noldova Desktop ends a call that failed past its point of no return as uncertain, so it is told when none of the action's own input
      // reached the page.
      if (ToolFailures.isNothingSent(error, progress))
        call.markNothingSent();
      throw new ToolFailureException(ToolFailures.forCall(error, progress, tool.descriptor.isResumable !== true));
    }
  }
}
