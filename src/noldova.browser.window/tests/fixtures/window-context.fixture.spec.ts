/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
import { CommandContribution, DocumentContribution, StatusBarItemContribution, StatusBarItemState, StatusBarSide } from "@noldova/desktop.window";
import { describe, expect, it } from "vitest";

import { OpenedDocument, TitleUpdate, WindowContext, WindowRequest } from "./window-context.fixture.ts";

describe("WindowContext", () => {
  it("registers each document, command and status-bar item module.json declares once, and refuses an undeclared or repeated one, or a tab row place menus.json doesn't declare", () => {
    const context: WindowContext = new WindowContext();
    const document = (name: string): DocumentContribution => new DocumentContribution(name, () => Promise.resolve(Object));
    const command = (name: string): CommandContribution => new CommandContribution(name, "Open page", null, null, () => Promise.resolve(null));
    const item = (name: string): StatusBarItemContribution => new StatusBarItemContribution(name, StatusBarSide.Right, new StatusBarItemState("Scout · 1 page open"));

    context.registerDocument(document("browser.page"));
    context.registerCommand(command("browser.openPage"));
    context.registerStatusBarItem(item("browser.agentPages"));

    expect(() => context.registerDocument(document("browser.other"))).toThrow(UnansweredCallException);
    expect(() => new WindowContext().registerDocument(new DocumentContribution("browser.page", () => Promise.resolve(Object), undefined, { tabRowPlace: "browser.otherRow" })))
      .toThrow(UnansweredCallException);
    expect(() => context.registerDocument(document("browser.page"))).toThrow(UnansweredCallException);
    expect(() => context.registerCommand(command("browser.other"))).toThrow(UnansweredCallException);
    expect(() => context.registerCommand(command("browser.openPage"))).toThrow(UnansweredCallException);
    expect(() => context.registerStatusBarItem(item("browser.other"))).toThrow(UnansweredCallException);
    expect(() => context.registerStatusBarItem(item("browser.agentPages"))).toThrow(UnansweredCallException);
    expect([context.documents.length, context.commands.length, context.statusBarItems.length]).toEqual([1, 1, 1]);
  });

  it("refuses a status-bar item's command module.json doesn't declare, and takes a declared one", () => {
    const context: WindowContext = new WindowContext();
    const item = context.registerStatusBarItem(new StatusBarItemContribution("browser.agentPages", StatusBarSide.Right, new StatusBarItemState("Scout · 1 page open")));

    item.update(new StatusBarItemState("Scout · 1 page open", { command: "browser.openPage" }));

    expect(() => item.update(new StatusBarItemState("Scout · 1 page open", { command: "browser.other" }))).toThrow(UnansweredCallException);
    expect(item.state().command).toBe("browser.openPage");
  });

  it("stores a declared setting's written value, which a read gives back, and rejects an undeclared setting or a write it is told to fail", async () => {
    const context: WindowContext = new WindowContext();
    const failure: Error = new Error("The runtime refused the value.");

    await context.writeSettingAsync("browser.popupSites", "example.com");
    await expect(context.writeSettingAsync("browser.other", "example.com")).rejects.toThrow(UnansweredCallException);
    context.settingFailure = failure;
    await expect(context.writeSettingAsync("browser.popupSites", "other.example")).rejects.toBe(failure);

    expect(context.readSetting("browser.popupSites")).toBe("example.com");
  });

  it("records each opened document, document update and request as its named class", async () => {
    const context: WindowContext = new WindowContext();

    context.openDocument("browser.page", "tab-2", "New tab", { after: "tab-1", activate: false });
    context.updateDocument("browser.page", "tab-2", { title: "Plans and pricing" });
    await context.requestAsync("browser.readAppName", null);

    expect([context.opened, context.titles, context.requests]).toStrictEqual([
      [new OpenedDocument("browser.page", "tab-2", "New tab", "tab-1", null, false, undefined)],
      [new TitleUpdate("tab-2", { title: "Plans and pricing" })],
      [new WindowRequest("browser.readAppName", null)]
    ]);
  });
});
