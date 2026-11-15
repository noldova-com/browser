/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IWindowPartContext, type StatusBarItem, StatusBarItemContribution, StatusBarItemState, StatusBarItemTone, StatusBarSide } from "@noldova/desktop.window";

import { Resources } from "../../resources.ts";

export class AgentPages {
  private readonly item: StatusBarItem;
  private readonly tabs: Set<string> = new Set<string>();
  private readonly agents: Map<string, string> = new Map<string, string>();

  public constructor(context: IWindowPartContext) {
    this.item = context.registerStatusBarItem(new StatusBarItemContribution(Resources.agentPagesItem, StatusBarSide.Right, AgentPages.stateOf("")));
  }

  public openTabs(instances: readonly string[]): void {
    for (const instance of instances)
      this.tabs.add(instance);
    this.show();
  }

  public leaveTab(instance: string): void {
    this.tabs.delete(instance);
    this.agents.delete(instance);
    this.show();
  }

  public closeTab(instance: string): void {
    this.leaveTab(instance);
  }

  public noteAgent(instance: string, agentName: string): void {
    if (!this.tabs.has(instance))
      return;
    this.agents.set(instance, agentName);
    this.show();
  }

  private show(): void {
    const counts: Map<string, number> = new Map<string, number>();
    for (const agentName of this.agents.values()) {
      const name: string = Resources.formatAgentName(agentName);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const text: string = [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => Resources.formatAgentPages(name, count)).join(Resources.agentPagesSeparator);
    if (text !== this.item.state().text)
      this.item.update(AgentPages.stateOf(text));
  }

  private static stateOf(text: string): StatusBarItemState {
    return text === "" ? new StatusBarItemState("", { isHidden: true }) : new StatusBarItemState(text, { tone: StatusBarItemTone.Muted });
  }
}
