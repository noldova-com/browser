/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewFailure, WebViewFailureKind, WebViewNavigation, WebViewNavigationKind } from "@noldova/desktop.protocol";
import { type IToolDescriptor, PermissionDecision, type ToolCall, type ToolFailure, ToolRisk } from "@noldova/desktop.runtime";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { IBrowserTool } from "../../src/interfaces/i-browser-tool.ts";
import { ActionProgress } from "../../src/models/action-progress.ts";
import { SnapshotReference } from "../../src/models/snapshot-reference.ts";
import { ToolDescriptors } from "../../src/models/tool-descriptors.ts";
import type { ToolKit } from "../../src/models/tool-kit.ts";
import { ToolFailures } from "../../src/services/tool-failures.ts";
import { BrowserTools } from "../../src/tools/browser-tools.ts";
import { ClickTool } from "../../src/tools/click.tool.ts";
import { ConsoleTool } from "../../src/tools/console.tool.ts";
import { NavigateTool } from "../../src/tools/navigate.tool.ts";
import { PressKeyTool } from "../../src/tools/press-key.tool.ts";
import { ScreenshotTool } from "../../src/tools/screenshot.tool.ts";
import { SnapshotTool } from "../../src/tools/snapshot.tool.ts";
import { TypeTool } from "../../src/tools/type.tool.ts";
import { WaitForTool } from "../../src/tools/wait-for.tool.ts";
import type { JsonObject } from "../../src/types/json-value.ts";
import type { CorePermissionRequests } from "../fixtures/core-permission-requests.fixture.ts";
import { ShopPage } from "../fixtures/shop-page.fixture.ts";
import { ToolBench } from "../fixtures/tool-bench.fixture.ts";

interface IScenario {
  readonly name: string;
  readonly descriptor: IToolDescriptor;
  readonly create: (kit: ToolKit) => IBrowserTool;
  readonly input: (reference: string) => JsonObject;
  readonly breakAfterPoint: ((bench: ToolBench) => void) | null;
}

const CRASHED: WebViewFailure = new WebViewFailure(WebViewFailureKind.Crashed);

const SCENARIOS: readonly IScenario[] = [
  { name: "browser_navigate", descriptor: ToolDescriptors.navigate, create: t => new NavigateTool(t), input: () => ({ url: "https://shop.test/next" }),
    breakAfterPoint: t => t.surface.navigationOutcome = new WebViewNavigation(WebViewNavigationKind.Refused, ShopPage.ORIGIN) },
  { name: "browser_snapshot", descriptor: ToolDescriptors.snapshot, create: t => new SnapshotTool(t), input: () => ({}), breakAfterPoint: null },
  { name: "browser_click", descriptor: ToolDescriptors.click, create: t => new ClickTool(t), input: t => ({ reference: t }),
    breakAfterPoint: t => t.surface.fail("Input.dispatchMouseEvent", CRASHED) },
  { name: "browser_type", descriptor: ToolDescriptors.type, create: t => new TypeTool(t), input: t => ({ reference: t, text: "red" }),
    breakAfterPoint: t => t.surface.fail("DOM.focus", CRASHED) },
  { name: "browser_press_key", descriptor: ToolDescriptors.pressKey, create: t => new PressKeyTool(t), input: () => ({ key: "a" }),
    breakAfterPoint: t => t.surface.fail("Input.dispatchKeyEvent", CRASHED) },
  { name: "browser_screenshot", descriptor: ToolDescriptors.screenshot, create: t => new ScreenshotTool(t), input: () => ({}), breakAfterPoint: null },
  { name: "browser_console", descriptor: ToolDescriptors.console, create: t => new ConsoleTool(t), input: () => ({}), breakAfterPoint: null },
  { name: "browser_wait_for", descriptor: ToolDescriptors.waitFor, create: t => new WaitForTool(t), input: () => ({ text: "Cart", timeoutMilliseconds: 1_000 }),
    breakAfterPoint: null }
];

const ACTIONS: readonly IScenario[] = SCENARIOS.filter(t => t.breakAfterPoint !== null);

function isReading(descriptor: IToolDescriptor): boolean {
  return descriptor.hints?.isReadOnly === true && descriptor.risk.maximum === ToolRisk.Low;
}

const TREE: JsonObject = { nodes: [
  { nodeId: "1", role: { value: "RootWebArea" }, name: { value: "Cart" }, childIds: ["2"], backendDOMNodeId: 1 },
  { nodeId: "2", role: { value: "textbox" }, name: { value: "Search" }, backendDOMNodeId: ShopPage.SEARCH,
    properties: [{ name: "focused", value: { value: true } }] }
] };

describe.each(SCENARIOS)("$name", (scenario: IScenario) => {
  let bench: ToolBench;
  let tool: IBrowserTool;

  function callOf(controller: AbortController = new AbortController(), milliseconds: number = 5_000): ToolCall {
    const reference: string = bench.sessions.issueReference(ToolBench.SESSION, new SnapshotReference(ToolBench.VIEW, "L1", ShopPage.SEARCH));
    return bench.call(scenario.input(reference), controller, ToolBench.SESSION, milliseconds);
  }

  async function outcomeAsync(call: ToolCall): Promise<readonly (string | null)[]> {
    const progress: ActionProgress = new ActionProgress(() => call.markSending());
    try {
      await tool.callAsync(call, progress);
      return ["Done"];
    }
    catch (error) {
      const failure: ToolFailure = ToolFailures.forCall(error, progress, tool.descriptor.isResumable !== true);
      return [failure.code, failure.moduleCode];
    }
  }

  afterEach(() => {
    bench[Symbol.dispose]();
  });

  beforeEach(() => {
    bench = new ToolBench();
    bench.keep("workspace-1", [ShopPage.ORIGIN]);
    ShopPage.serve(bench, ShopPage.SEARCH);
    bench.surface.answer("Accessibility.getFullAXTree", TREE);
    bench.surface.answer("Page.getLayoutMetrics", { cssVisualViewport: { pageX: 0, pageY: 0, clientWidth: 800, clientHeight: 600 }, cssContentSize: { width: 800, height: 1200 },
      visualViewport: { clientWidth: 800 } });
    bench.surface.answer("Page.captureScreenshot", { data: "iVBORw0KGgo=" });
    bench.surface.answer("Page.getNavigationHistory", { currentIndex: 1, entries: [{ url: "https://shop.test/cart/" }, { url: "https://shop.test/next" }] });
    bench.surface.afterNavigation = (viewId: string): void => {
      bench.surface.emitProtocolEvent(viewId, "Page.frameNavigated", { frame: { id: "F1", loaderId: "L2" } });
      bench.surface.emitProtocolEvent(viewId, "Page.loadEventFired", {});
    };
    tool = scenario.create(bench.kit);
    bench.checkAs(tool.descriptor);
  });

  it("is the tool its descriptor names", () => {
    expect([tool.descriptor, tool.descriptor.name]).toEqual([scenario.descriptor, scenario.name]);
  });

  if (isReading(scenario.descriptor)) {
    it.each([PermissionDecision.Denied, PermissionDecision.DeniedAlways, PermissionDecision.Expired])(
      "raises no request, which Noldova Desktop's checker would refuse, and answers from the page even if a request would be answered %s",
      async (decision: PermissionDecision) => {
        const core: CorePermissionRequests = bench.checkAs(tool.descriptor);
        bench.permissions.automaticDecision = decision;
        const call: ToolCall = callOf();

        expect([await outcomeAsync(call), bench.permissions.requests, core.messages, call.hasMarkedSending]).toEqual([["Done"], [], [], false]);
      });
  }
  else {
    it("raises a request that Noldova Desktop's checker passes to the person, as its declaration allows, and allowed once ends as done", async () => {
      expect([await outcomeAsync(callOf()), bench.permissions.requests.length]).toEqual([["Done"], 1]);
    });

    it.each<[PermissionDecision, readonly (string | null)[]]>([
      [PermissionDecision.AllowedOnce, ["Done"]],
      [PermissionDecision.AllowedAlways, ["Done"]],
      [PermissionDecision.Denied, ["Denied", null]],
      [PermissionDecision.DeniedAlways, ["Denied", null]],
      [PermissionDecision.Expired, ["Expired", null]],
      [PermissionDecision.Withdrawn, ["Denied", null]]
    ])("raises one request and, answered %s, ends as %j, having sent input only when allowed", async (decision: PermissionDecision, expected: readonly (string | null)[]) => {
      bench.permissions.automaticDecision = decision;
      const call: ToolCall = callOf();

      expect(await outcomeAsync(call)).toEqual(expected);
      expect(bench.permissions.requests.length).toBe(1);
      expect(call.hasMarkedSending).toBe(expected[0] === "Done" && tool.descriptor.marksSending === true);
    });

    it("ends as withdrawn when the person stops its call while the request waits, having sent nothing", async () => {
      bench.permissions.automaticDecision = null;
      const controller: AbortController = new AbortController();
      const call: ToolCall = callOf(controller);
      const outcome: Promise<readonly (string | null)[]> = outcomeAsync(call);
      await bench.permissions.raised;
      controller.abort("Stopped");

      expect(await outcome).toEqual(["Withdrawn", null]);
      expect(call.hasMarkedSending).toBe(false);
    });
  }

  it.each<[string, WebViewFailureKind, string]>([
    ["crashed", WebViewFailureKind.Crashed, "browser.pageCrashed"],
    ["lost its profile", WebViewFailureKind.ProfileCleared, "browser.profileCleared"],
    ["closed", WebViewFailureKind.ViewClosed, "browser.viewClosed"]
  ])("ends as unavailable, before anything asks, when the view has %s", async (_case: string, kind: WebViewFailureKind, code: string) => {
    bench.surface.fail("Page.getFrameTree", new WebViewFailure(kind));

    expect(await outcomeAsync(callOf())).toEqual(["Unavailable", code]);
    expect(bench.permissions.requests).toEqual([]);
  });

  it("ends as timed out when its time is over before its first call", async () => {
    expect(await outcomeAsync(callOf(new AbortController(), 0))).toEqual(["TimedOut", null]);
  });

  it("fails as unbound when the session's page is open in another workspace", async () => {
    bench.surface.profileKeys.set(ToolBench.VIEW, "workspace-2");

    expect(await outcomeAsync(callOf())).toEqual(["Unavailable", "browser.unbound"]);
  });
});

describe.each(ACTIONS)("$name after its point of no return", (scenario: IScenario) => {
  it("ends as an uncertain outcome when its first input fails, having marked the point once", async () => {
    using bench: ToolBench = new ToolBench();
    bench.keep("workspace-1", [ShopPage.ORIGIN]);
    ShopPage.serve(bench, ShopPage.SEARCH);
    bench.surface.answer("Accessibility.getFullAXTree", TREE);
    scenario.breakAfterPoint?.(bench);
    const tool: IBrowserTool = scenario.create(bench.kit);
    bench.checkAs(tool.descriptor);
    const call: ToolCall = bench.call(scenario.input(bench.sessions.issueReference(ToolBench.SESSION, new SnapshotReference(ToolBench.VIEW, "L1", ShopPage.SEARCH))));
    const progress: ActionProgress = new ActionProgress(() => call.markSending());

    const failure: unknown = await tool.callAsync(call, progress).then(() => null, (error: unknown) => error);

    expect(ToolFailures.forCall(failure, progress, true).code).toBe("OutcomeUncertain");
    expect(call.hasMarkedSending).toBe(true);
  });
});

describe("BrowserTools", () => {
  it("covers every tool the module builds, so each one's calls meet Noldova Desktop's permission checker", () => {
    using bench: ToolBench = new ToolBench();

    expect(BrowserTools.create(bench.kit).map(t => t.descriptor.name)).toEqual(SCENARIOS.map(t => t.name));
  });
});
