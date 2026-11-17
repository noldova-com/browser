/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";

import { ElementFactsScript, PageChangeScript } from "@noldova/browser.protocol";
import { describe, expect, it } from "vitest";

import { PageTextScript } from "../src/models/page-text-script.ts";

async function readDeclarationAsync(file: string): Promise<unknown> {
  const declaration: unknown = JSON.parse(await readFile(new URL(file, import.meta.url), "utf8"));
  return declaration;
}

describe("module.json", () => {
  it("declares its dependencies as an object of module ids and exact versions, with none", async () => {
    expect(await readDeclarationAsync("../module.json")).toEqual(expect.objectContaining({ dependencies: {} }));
  });

  it("declares the tools the runtime part registers, in the protocol's order", async () => {
    expect(await readDeclarationAsync("../module.json")).toMatchObject({ contributes: { tools: ["browser_navigate", "browser_snapshot", "browser_click", "browser_type",
      "browser_press_key", "browser_screenshot", "browser_console", "browser_wait_for"] } });
  });

  it("declares the methods the runtime part registers, and no other", async () => {
    expect(await readDeclarationAsync("../module.json")).toMatchObject({ contributes: { methods: ["browser.allowTypedAddress", "browser.passTypedRedirect",
      "browser.endTypedRedirects", "browser.readyPage", "browser.rememberPage", "browser.readPage", "browser.forgetPage", "browser.clearBrowsingData", "browser.readAppName",
      "browser.stopPage", "browser.readActivities", "browser.claimPage", "browser.holdPages", "browser.letGoPage"] } });
  });

  it("declares the page activity event the runtime part publishes, and no other", async () => {
    expect(await readDeclarationAsync("../module.json")).toMatchObject({ contributes: { events: ["browser.pageActivity"] } });
  });
});

describe("settings.json", () => {
  it("declares the settings that module.json lists, the links' on the Browser page's Links group with the values the window part reads and the list it checks, and the agents' switch on its Agents group, on by default", async () => {
    expect(await readDeclarationAsync("../module.json")).toMatchObject({ contributes: { settings: ["browser.linkClick", "browser.linkMiddleClick", "browser.systemSites",
      "browser.agentTools", "browser.localSites"] } });
    expect(await readDeclarationAsync("../settings.json")).toMatchObject({ settings: [
      expect.objectContaining({ name: "browser.linkClick", default: "InApp", page: "Browser", group: "Links",
        type: { kind: "Choice", options: [{ value: "InApp", title: "In the app's browser" }, { value: "System", title: "In your browser" }] } }),
      expect.objectContaining({ name: "browser.linkMiddleClick", default: "Modified", page: "Browser", group: "Links",
        type: { kind: "Choice", options: [{ value: "Modified", title: "Like Ctrl+click" }, { value: "Plain", title: "Like a click" }] } }),
      expect.objectContaining({ name: "browser.systemSites", type: { kind: "Text", maxLength: 4000, checked: true }, default: "", page: "Browser", group: "Links" }),
      expect.objectContaining({ name: "browser.agentTools", type: { kind: "Boolean" }, default: true, page: "Browser", group: "Agents" }),
      expect.objectContaining({ name: "browser.localSites", type: { kind: "Text", maxLength: 4000, checked: true }, default: "", page: "Browser", group: "Sites" })
    ] });
  });
});

describe("module.json's window contributions", () => {
  it("declares the page document and the commands that open one, which the window part registers", async () => {
    expect(await readDeclarationAsync("../module.json")).toMatchObject({ contributes: { documents: ["browser.page"], commands: ["browser.openPage", "browser.newPage"] } });
  });

  it("declares the page document's tab row place, a plain one that shows only the new page command, and no other place", async () => {
    expect(await readDeclarationAsync("../module.json")).toMatchObject({ contributes: { menus: ["browser.pageTabRow"] } });
    expect(await readDeclarationAsync("../menus.json")).toEqual({
      places: [{ name: "browser.pageTabRow", title: "Page tab row" }],
      groups: [{ name: "browser.pageTabRowNew", place: "browser.pageTabRow", items: [{ command: "browser.newPage" }] }]
    });
  });

  it("declares the status bar item of each agent's open pages, which the window part registers", async () => {
    expect(await readDeclarationAsync("../module.json")).toMatchObject({ contributes: { statusBarItems: ["browser.agentPages"] } });
  });
});

describe("webViews.json", () => {
  it("declares the pane's keys the window part takes from its views: reload on Ctrl+R and F5, and Cmd+R on macOS, a new page on Ctrl+T, the address field on Ctrl+L, and find on Ctrl+F", async () => {
    expect(await readDeclarationAsync("../webViews.json")).toMatchObject({ keys: [{ name: "reload", keys: ["Mod+R", "F5"], macKeys: ["Mod+R"] }, { name: "newPage", keys: ["Mod+T"] },
      { name: "focusAddress", keys: ["Mod+L"] }, { name: "find", keys: ["Mod+F"] }] });
  });

  it("declares the debugging calls and the events the built tools send and take, and takes its views' new windows", async () => {
    const methods: readonly string[] = ["Page.enable", "Page.getFrameTree", "Page.getNavigationHistory", "Page.getLayoutMetrics", "Page.createIsolatedWorld",
      "Page.captureScreenshot", "Runtime.enable", "Runtime.disable", "Runtime.discardConsoleEntries", "Runtime.addBinding", "Runtime.callFunctionOn", "Runtime.releaseObject", "Log.enable",
      "Accessibility.getFullAXTree", "Accessibility.getPartialAXTree", "Accessibility.enable", "Accessibility.disable", "Accessibility.getRootAXNode",
      "Accessibility.getChildAXNodes", "DOM.getDocument", "DOM.querySelector", "DOM.resolveNode", "DOM.describeNode", "DOM.scrollIntoViewIfNeeded", "DOM.getContentQuads",
      "DOM.getNodeForLocation", "DOM.focus", "Emulation.setDeviceMetricsOverride", "Emulation.clearDeviceMetricsOverride", "Input.dispatchMouseEvent", "Input.dispatchKeyEvent",
      "Input.insertText"];

    expect(await readDeclarationAsync("../webViews.json")).toMatchObject({
      methods: methods.map(t => ({ name: t })),
      events: ["Page.loadEventFired", "Page.frameNavigated", "Runtime.consoleAPICalled", "Runtime.exceptionThrown", "Runtime.executionContextCreated",
        "Runtime.executionContextDestroyed", "Runtime.executionContextsCleared", "Runtime.bindingCalled", "Log.entryAdded"],
      newWindows: true
    });
  });

  it("holds the bounds that keep the tools' calls to what they send: whole documents read once, three clicks, short key texts, bounded captures, a tree read a node's children at a time, the focused element, and a node with its relatives", async () => {
    expect(await readDeclarationAsync("../webViews.json")).toMatchObject({ methods: expect.arrayContaining([
      { name: "DOM.getDocument", parameters: { depth: { required: true, values: [0] }, pierce: { required: true, values: [true] } } },
      { name: "DOM.querySelector", parameters: { nodeId: { required: true, minimum: 1 }, selector: { required: true, values: [":focus"] } } },
      { name: "Accessibility.getPartialAXTree", parameters: { backendNodeId: { minimum: 1 }, nodeId: { minimum: 1 }, fetchRelatives: { required: true, values: [false, true] } } },
      { name: "Accessibility.getRootAXNode" },
      { name: "Accessibility.getChildAXNodes", parameters: { id: { required: true, maxLength: 64 } } },
      { name: "DOM.resolveNode", parameters: { backendNodeId: { required: true, minimum: 1 }, executionContextId: { required: true, minimum: 1 } } },
      { name: "DOM.describeNode", parameters: { backendNodeId: { minimum: 1 }, objectId: { maxLength: 128 }, depth: { values: [-1] }, pierce: { values: [true] } } },
      expect.objectContaining({ name: "Input.dispatchMouseEvent", parameters: expect.objectContaining({ clickCount: expect.objectContaining({ minimum: 1, maximum: 3 }),
        button: expect.objectContaining({ values: ["left", "middle", "right"] }) }) }),
      expect.objectContaining({ name: "Input.dispatchKeyEvent", parameters: expect.objectContaining({ text: expect.objectContaining({ maxLength: 2 }),
        modifiers: expect.objectContaining({ maximum: 15 }) }) }),
      { name: "Emulation.setDeviceMetricsOverride", parameters: { width: { required: true, values: [1280] }, height: { required: true, values: [800] },
        deviceScaleFactor: { required: true, values: [0] }, mobile: { required: true, values: [false] } } },
      { name: "Input.insertText", parameters: { text: { required: true, maxLength: 10000 } } },
      expect.objectContaining({ name: "Page.captureScreenshot", parameters: expect.objectContaining({
        format: { required: true, values: ["png", "jpeg"] },
        quality: expect.objectContaining({ minimum: 20, maximum: 80 }),
        clip: expect.objectContaining({ required: true, fields: expect.objectContaining({ width: expect.objectContaining({ required: true, maximum: 4096 }),
          height: expect.objectContaining({ required: true, maximum: 4096 }), scale: expect.objectContaining({ required: true, maximum: 1 }) }) })
      }) }),
      { name: "Runtime.enable" }, { name: "Runtime.disable" }, { name: "Runtime.discardConsoleEntries" }, { name: "Log.enable" }
    ]) });
  });

  it("lets the module make only its one world, without universal access, bind only the change script's binding in its world, and run only the change script's function and the page text check, by value and silent", async () => {
    expect(await readDeclarationAsync("../webViews.json")).toMatchObject({ methods: expect.arrayContaining([
      { name: "Page.createIsolatedWorld", parameters: { frameId: { required: true, maxLength: 64 },
        worldName: { required: true, values: ["noldova-browser-changes"] }, grantUniveralAccess: { required: true, values: [false] } } },
      { name: "Runtime.addBinding", parameters: { name: { required: true, values: ["noldovaBrowserChanged"] },
        executionContextName: { required: true, values: ["noldova-browser-changes"] } } },
      { name: "Runtime.callFunctionOn", parameters: {
        functionDeclaration: { required: true, values: [PageChangeScript.functionDeclaration, PageTextScript.functionDeclaration, ElementFactsScript.functionDeclaration] },
        uniqueContextId: { maxLength: 64 }, objectId: { maxLength: 128 },
        arguments: {}, returnByValue: { required: true, values: [true, false] }, silent: { required: true, values: [true] }
      } },
      { name: "Runtime.releaseObject", parameters: { objectId: { required: true, maxLength: 128 } } }
    ]) });
  });
});
