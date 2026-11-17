/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PageChangeScript } from "@noldova/browser.protocol";
import { type WebViewEvent, WebViewAction, WebViewEventKind, WebViewFailure, WebViewFailureKind, WebViewNavigation, WebViewNavigationKind } from "@noldova/desktop.protocol";
import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
import type { WebViewProtocolEvent } from "@noldova/desktop.runtime";
import { describe, expect, it } from "vitest";

import type { JsonObject, JsonValue } from "../../src/types/json-value.ts";
import { ScriptedViews } from "./scripted-views.fixture.ts";

const SHOT: JsonObject = { format: "png", clip: { x: 0, y: 0, width: 1, height: 1, scale: 1 } };

describe("ScriptedViews", () => {
  it("refuses a view that isn't open, another module's view and a method off the module's list, and records each call, while Noldova Desktop's relay refuses focus emulation before the call reaches it", async () => {
    const views: ScriptedViews = new ScriptedViews(["view"], ["foreign"]);
    const { relay } = views;

    await expect(relay.sendAsync("stranger", "Page.enable", {}, 100)).rejects.toMatchObject({ failure: { kind: WebViewFailureKind.ViewClosed } });
    await expect(relay.sendAsync("foreign", "Page.enable", {}, 100)).rejects.toMatchObject({ failure: { kind: WebViewFailureKind.NotOwned } });
    await expect(relay.sendAsync("view", "Runtime.evaluate", { expression: "1" }, 100)).rejects.toMatchObject({ failure: { kind: WebViewFailureKind.NotAllowed } });
    await expect(relay.sendAsync("view", "Emulation.setFocusEmulationEnabled", { enabled: true }, 100)).rejects.toMatchObject({ failure: { kind: WebViewFailureKind.NotAllowed } });
    await expect(views.webViews.navigateAsync("stranger", "https://public.test/")).rejects.toMatchObject({ failure: { kind: WebViewFailureKind.ViewClosed } });
    expect(views.calls.map(t => [t.viewId, t.method])).toEqual([["stranger", "Page.enable"], ["foreign", "Page.enable"], ["view", "Runtime.evaluate"]]);
  });

  it("refuses, as Noldova Desktop does, a declared method sent with a parameter it doesn't declare, a value its rule refuses or without a required one, and a method webViews.json doesn't declare", async () => {
    const views: ScriptedViews = new ScriptedViews(["view"]);
    views.acknowledge("Page.enable", "Input.dispatchKeyEvent", "Page.setLifecycleEventsEnabled", "Page.handleJavaScriptDialog", "Accessibility.getAXNodeAndAncestors", "Accessibility.queryAXTree");
    views.answer("Page.captureScreenshot", { data: "" });
    const refusedCalls: readonly (readonly [string, JsonObject])[] = [
      ["Page.enable", { extra: true }],
      ["Input.dispatchKeyEvent", { type: "keyDown" }],
      ["Input.dispatchKeyEvent", { type: "char", key: "a" }],
      ["Page.captureScreenshot", {}],
      ["Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 4097, height: 1, scale: 1 } }],
      ["Page.setLifecycleEventsEnabled", { enabled: true }],
      ["Page.handleJavaScriptDialog", { accept: false }],
      ["Accessibility.getAXNodeAndAncestors", {}],
      ["Accessibility.queryAXTree", { backendNodeId: 1 }]
    ];

    for (const [method, params] of refusedCalls)
      await expect(views.relay.sendAsync("view", method, params, 100), method).rejects.toMatchObject({ failure: { kind: WebViewFailureKind.NotAllowed } });
    expect(await views.relay.sendAsync("view", "Input.dispatchKeyEvent", { type: "keyDown", key: "a" }, 100)).toEqual({});
    expect(await views.relay.sendAsync("view", "Page.captureScreenshot", SHOT, 100)).toEqual({ data: "" });
  });

  it("answers, fails or hangs as scripted, and throws for a method the test hasn't scripted, as Noldova Desktop's fakes do", async () => {
    const views: ScriptedViews = new ScriptedViews(["view"]);
    const { relay } = views;
    views.answer("DOM.describeNode", { node: { nodeName: "A" } });
    views.acknowledge("Page.enable");
    views.fail("DOM.focus", new WebViewFailure(WebViewFailureKind.Protocol, -32000, "No node"));
    views.hang("Page.captureScreenshot");

    expect(await relay.sendAsync("view", "DOM.describeNode", { backendNodeId: 1 }, 100)).toEqual({ node: { nodeName: "A" } });
    expect(await relay.sendAsync("view", "Page.enable", {}, 100)).toEqual({});
    await expect(relay.sendAsync("view", "DOM.scrollIntoViewIfNeeded", { backendNodeId: 1 }, 100)).rejects.toBeInstanceOf(UnansweredCallException);
    await expect(relay.sendAsync("view", "DOM.scrollIntoViewIfNeeded", { backendNodeId: 1 }, 100)).rejects.toMatchObject({ member: "sendAsync", method: "DOM.scrollIntoViewIfNeeded" });
    await expect(relay.sendAsync("view", "DOM.focus", { backendNodeId: 1 }, 100)).rejects.toMatchObject({ failure: { kind: WebViewFailureKind.Protocol } });
    const hanging: Promise<void> = expect(relay.sendAsync("view", "Page.captureScreenshot", SHOT, 100)).rejects.toMatchObject({ failure: { kind: WebViewFailureKind.Crashed } });
    expect(views.pendingCount).toBe(1);

    views.crash("view");

    await hanging;
    await expect(relay.sendAsync("view", "Page.enable", {}, 100)).rejects.toMatchObject({ failure: { kind: WebViewFailureKind.Crashed } });
  });

  it("keeps a crashed view open, as Noldova Desktop does: it takes allowed origins, has no reload, and a navigation recovers it", async () => {
    const views: ScriptedViews = new ScriptedViews(["view"]);
    views.acknowledge("Page.enable");
    views.crash("view");

    await views.webViews.setAllowedOriginsAsync("view", ["https://public.test"]);
    const reload: WebViewNavigation = await views.webViews.actAsync("view", WebViewAction.Reload);
    await expect(views.relay.sendAsync("view", "Page.enable", {}, 100)).rejects.toMatchObject({ failure: { kind: WebViewFailureKind.Crashed } });
    const navigation: WebViewNavigation = await views.webViews.navigateAsync("view", "https://public.test/");

    expect([views.allowedOrigins.get("view"), reload, navigation]).toEqual([["https://public.test"], new WebViewNavigation(WebViewNavigationKind.NoHistory),
      new WebViewNavigation(WebViewNavigationKind.Started)]);
    expect(await views.relay.sendAsync("view", "Page.enable", {}, 100)).toEqual({});
  });

  it("keeps a crashed view crashed through a navigation Noldova Desktop refuses, as its check comes first", async () => {
    const views: ScriptedViews = new ScriptedViews(["view"]);
    views.acknowledge("Page.enable");
    views.crash("view");
    views.navigationOutcome = new WebViewNavigation(WebViewNavigationKind.Refused, "https://private.test");

    const navigation: WebViewNavigation = await views.webViews.navigateAsync("view", "https://private.test/");

    expect(navigation).toEqual(new WebViewNavigation(WebViewNavigationKind.Refused, "https://private.test"));
    await expect(views.relay.sendAsync("view", "Page.enable", {}, 100)).rejects.toMatchObject({ failure: { kind: WebViewFailureKind.Crashed } });
  });

  it("fails a closed view's pending and later calls, as Noldova Desktop's main process does, and reports its closing", async () => {
    const views: ScriptedViews = new ScriptedViews(["view"]);
    const events: WebViewEvent[] = [];
    views.webViews.onViewEvent(t => events.push(t));
    views.hang("Page.captureScreenshot");
    const pending: Promise<void> = expect(views.relay.sendAsync("view", "Page.captureScreenshot", SHOT, 100)).rejects.toMatchObject({ failure: { kind: WebViewFailureKind.ViewClosed } });

    views.close("view");

    await pending;
    await expect(views.webViews.navigateAsync("view", "https://public.test/")).rejects.toMatchObject({ failure: { kind: WebViewFailureKind.ViewClosed } });
    await expect(views.webViews.actAsync("view", WebViewAction.Reload)).rejects.toMatchObject({ failure: { kind: WebViewFailureKind.ViewClosed } });
    await expect(views.webViews.setAllowedOriginsAsync("view", [])).rejects.toMatchObject({ failure: { kind: WebViewFailureKind.ViewClosed } });
    expect(events.map(t => [t.view, t.kind, t.details])).toEqual([["view", WebViewEventKind.Closed, {}]]);
  });

  it("ends the pending calls of a cleared profile's views alone, crashed ones too, reports the clearing on each, and keeps them open, as Noldova Desktop's main process does", async () => {
    const views: ScriptedViews = new ScriptedViews(["view", "crashed", "other"]);
    views.profileKeys.set("other", "workspace-2");
    views.crash("crashed");
    const events: WebViewEvent[] = [];
    views.webViews.onViewEvent(t => events.push(t));
    views.hang("Page.captureScreenshot");
    const cleared: Promise<void> = expect(views.relay.sendAsync("view", "Page.captureScreenshot", SHOT, 100)).rejects.toMatchObject({ failure: { kind: WebViewFailureKind.ProfileCleared } });
    void views.relay.sendAsync("other", "Page.captureScreenshot", SHOT, 100);

    await views.webViews.clearProfileAsync("workspace-1");

    await cleared;
    views.acknowledge("Page.enable");
    expect([views.pendingCount, await views.relay.sendAsync("view", "Page.enable", {}, 100), views.clearedProfiles]).toEqual([1, {}, ["workspace-1"]]);
    expect(events.map(t => [t.view, t.kind, t.details])).toEqual([["view", WebViewEventKind.ProfileCleared, { profileKey: "workspace-1" }],
      ["crashed", WebViewEventKind.ProfileCleared, { profileKey: "workspace-1" }]]);
  });

  it("delivers protocol and view events to the view's listeners until they stop, and counts the listeners still on", () => {
    const views: ScriptedViews = new ScriptedViews(["view"]);
    const seen: string[] = [];
    const stop: () => void = views.relay.onProtocolEvent("view", (t: WebViewProtocolEvent) => seen.push(`${t.view} ${t.method}`));
    views.relay.onProtocolEvent("other", (t: WebViewProtocolEvent) => seen.push(`${t.view} ${t.method}`));

    views.emitProtocolEvent("view", "Page.loadEventFired", {});
    stop();
    views.emitProtocolEvent("view", "Page.loadEventFired", {});

    expect([seen, views.protocolListenerCount]).toEqual([["view Page.loadEventFired"], 1]);
    const states: WebViewEvent[] = [];
    const stopStates: () => void = views.webViews.onViewEvent(t => states.push(t));
    views.emitViewEvent("view", WebViewEventKind.State, { address: "https://public.test/", title: "Home", isLoading: false, canGoBack: false, canGoForward: false });
    stopStates();
    views.emitViewEvent("view", WebViewEventKind.Crashed);
    expect([states.map(t => [t.view, t.kind]), views.viewListenerCount]).toEqual([[["view", WebViewEventKind.State]], 0]);
  });

  it("makes one world for each view, frame and name, reports each as it is first made, runs functions in it as true, and reports a page's change", async () => {
    const views: ScriptedViews = new ScriptedViews(["view", "other"]);
    const seen: string[] = [];
    views.relay.onProtocolEvent("view", (t: WebViewProtocolEvent) => seen.push(`${t.method} ${JSON.stringify(t.params)}`));
    views.serveWorlds();

    const ids: JsonValue[] = [];
    for (const [viewId, frameId] of [["view", "F1"], ["view", "F1"], ["view", "F2"], ["other", "F1"]] as const)
      ids.push(await views.relay.sendAsync(viewId, "Page.createIsolatedWorld", { frameId, worldName: "noldova-browser-changes", grantUniveralAccess: false }, 1_000));
    const result: JsonValue = await views.relay.sendAsync("view", "Runtime.callFunctionOn", { functionDeclaration: PageChangeScript.functionDeclaration, uniqueContextId: "view.1",
      arguments: [{ value: true }], returnByValue: true, silent: true }, 1_000);
    views.reportChange("view");

    expect([ids, result]).toEqual([[1, 1, 2, 3].map(t => ({ executionContextId: t })), { result: { type: "boolean", value: true } }]);
    expect(seen).toEqual([
      'Runtime.executionContextCreated {"context":{"id":1,"uniqueId":"view.1","name":"noldova-browser-changes","origin":"https://shop.test","auxData":{"frameId":"F1"}}}',
      'Runtime.executionContextCreated {"context":{"id":2,"uniqueId":"view.2","name":"noldova-browser-changes","origin":"https://shop.test","auxData":{"frameId":"F2"}}}',
      'Runtime.bindingCalled {"name":"noldovaBrowserChanged","payload":"","executionContextId":1}'
    ]);
  });

  it("reports a view's worlds again, and only that view's, when its runtime is enabled, as the engine does", async () => {
    const views: ScriptedViews = new ScriptedViews(["view", "other"]);
    const seen: string[] = [];
    views.relay.onProtocolEvent("view", (t: WebViewProtocolEvent) => seen.push(`${t.method} ${JSON.stringify(t.params)}`));
    views.relay.onProtocolEvent("other", (t: WebViewProtocolEvent) => seen.push(`other ${t.method}`));
    views.serveWorlds();

    await views.relay.sendAsync("view", "Runtime.enable", {}, 1_000);
    await views.relay.sendAsync("view", "Page.createIsolatedWorld", { frameId: "F1", worldName: "noldova-browser-changes", grantUniveralAccess: false }, 1_000);
    seen.length = 0;
    const answered: JsonValue = await views.relay.sendAsync("view", "Runtime.enable", {}, 1_000);
    await views.relay.sendAsync("other", "Runtime.enable", {}, 1_000);

    expect([answered, seen]).toEqual([{}, [
      'Runtime.executionContextCreated {"context":{"id":1,"uniqueId":"view.1","name":"noldova-browser-changes","origin":"https://shop.test","auxData":{"frameId":"F1"}}}'
    ]]);
  });

  it("records navigations and allowed origins and returns the scripted outcome", async () => {
    const views: ScriptedViews = new ScriptedViews(["view"]);

    expect(await views.webViews.navigateAsync("view", "https://public.test/")).toEqual(new WebViewNavigation(WebViewNavigationKind.Started));
    views.navigationOutcome = new WebViewNavigation(WebViewNavigationKind.NoHistory);
    expect(await views.webViews.actAsync("view", WebViewAction.Back)).toEqual(new WebViewNavigation(WebViewNavigationKind.NoHistory));
    await views.webViews.setAllowedOriginsAsync("view", ["https://public.test"]);

    expect(views.navigations).toEqual([{ viewId: "view", target: "https://public.test/" }, { viewId: "view", target: WebViewAction.Back }]);
    expect(views.allowedOrigins.get("view")).toEqual(["https://public.test"]);
  });

  it("answers each wait for a view's origins with the next ones that view is given, once", async () => {
    const views: ScriptedViews = new ScriptedViews(["view", "other"]);
    const first: Promise<readonly string[]> = views.allowedAsync("view");
    const second: Promise<readonly string[]> = views.allowedAsync("view");

    await views.webViews.setAllowedOriginsAsync("other", ["https://other.test"]);
    await views.webViews.setAllowedOriginsAsync("view", ["https://public.test"]);
    const later: Promise<readonly string[]> = views.allowedAsync("view");
    await views.webViews.setAllowedOriginsAsync("view", []);

    expect([await first, await second, await later]).toEqual([["https://public.test"], ["https://public.test"], []]);
  });

  it("lists its open views with their profile keys, as Noldova Desktop does, and drops one once it closes", () => {
    const views: ScriptedViews = new ScriptedViews(["one", "two", "three"]);
    views.profileKeys.set("two", "workspace-2");
    views.crash("three");
    views.close("one");

    expect(views.webViews.list().map(t => [t.id, t.module, t.pane.name.text, t.profileKey])).toEqual([["two", "browser", "browser.pane", "workspace-2"], ["three", "browser", "browser.pane", "workspace-1"]]);
  });
});
