/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { StatusBarItemTone, StatusBarSide } from "@noldova/desktop.window";
import { beforeEach, describe, expect, it } from "vitest";

import { AgentPages } from "../../../src/app/services/agent-pages.ts";
import { WindowContext } from "../../fixtures/window-context.fixture.ts";

describe("AgentPages", () => {
  let context: WindowContext;
  let agentPages: AgentPages;

  function shown(): readonly unknown[] {
    const [item] = context.statusBarItems;
    return [context.statusBarItems.length, item?.name, item?.side, item?.state().text, item?.state().isHidden, item?.state().tone];
  }

  beforeEach(() => {
    context = new WindowContext();
    agentPages = new AgentPages(context);
  });

  it("registers one item at the status bar's end, before the shell's own items, hidden while no agent has a page open", () => {
    expect(shown()).toEqual([1, "browser.agentPages", StatusBarSide.Right, "", true, StatusBarItemTone.Neutral]);
  });

  it("shows the agent's name, then its open pages, with one page as one, in the muted tone, as the design writes it", () => {
    agentPages.openTabs(["page-1", "page-2"]);
    agentPages.noteAgent("page-1", "Scout");
    const one: readonly unknown[] = shown();
    agentPages.noteAgent("page-2", "Scout");

    expect([one, shown()]).toEqual([[1, "browser.agentPages", StatusBarSide.Right, "Scout · 1 page open", false, StatusBarItemTone.Muted],
      [1, "browser.agentPages", StatusBarSide.Right, "Scout · 2 pages open", false, StatusBarItemTone.Muted]]);
  });

  it("counts a page for the agent whose call last acted on it, gives several agents one item in their names' order, and names an unnamed agent", () => {
    agentPages.openTabs(["page-1", "page-2", "page-3"]);
    agentPages.noteAgent("page-1", "Scout");
    agentPages.noteAgent("page-2", "Scout");
    agentPages.noteAgent("page-3", " ");
    agentPages.noteAgent("page-2", "Helper");

    expect(shown()[3]).toBe("A teammate · 1 page open, Helper · 1 page open, Scout · 1 page open");
  });

  it("counts only the pages whose tabs are open here, keeps no agent for another page, and goes when the last one closes or is another window's", () => {
    agentPages.noteAgent("page-1", "Scout");
    agentPages.openTabs(["page-1", "page-2", "page-3"]);
    const unnoted: readonly unknown[] = shown().slice(3, 5);
    agentPages.noteAgent("page-1", "Scout");
    agentPages.noteAgent("page-2", "Scout");
    agentPages.noteAgent("page-3", "Scout");
    agentPages.closeTab("page-1");
    const two: readonly unknown[] = shown().slice(3, 5);
    agentPages.leaveTab("page-2");
    agentPages.leaveTab("page-3");
    const left: readonly unknown[] = shown().slice(3, 5);
    agentPages.openTabs(["page-1", "page-2"]);

    expect([unnoted, two, left, shown().slice(3, 5)]).toEqual([["", true], ["Scout · 2 pages open", false], ["", true], ["", true]]);
  });
});
