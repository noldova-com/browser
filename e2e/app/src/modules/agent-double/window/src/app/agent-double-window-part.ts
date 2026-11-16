/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import type { IWindowPart, IWindowPartContext } from "@noldova/desktop.window";

export class AgentDoubleWindowPart implements IWindowPart {
  private static readonly PAGE_OPENING_EVENT: string = "agent-double.pageOpening";
  private static readonly OPEN_PAGE_COMMAND: string = "browser.openPage";

  public readonly moduleId: string = "agent-double";
  private stopListening: (() => void) | null = null;

  public async activateAsync(context: IWindowPartContext): Promise<void> {
    this.stopListening = context.onEvent(AgentDoubleWindowPart.PAGE_OPENING_EVENT, t => void AgentDoubleWindowPart.openAsync(context, t));
  }

  public async reconnectAsync(): Promise<boolean> {
    return false;
  }

  public async deactivateAsync(): Promise<void> {
    this.stopListening?.();
    this.stopListening = null;
  }

  private static async openAsync(context: IWindowPartContext, opening: JsonValue): Promise<void> {
    try {
      await context.runCommandAsync(AgentDoubleWindowPart.OPEN_PAGE_COMMAND, opening);
    }
    catch (error: unknown) {
      console.error(`The agent double couldn't open the page ${JSON.stringify(opening)}: ${String(error)}`);
    }
  }
}
