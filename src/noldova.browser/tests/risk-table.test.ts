/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";

import { WebViewFailure, WebViewFailureKind, WebViewNavigation, WebViewNavigationKind } from "@noldova/desktop.protocol";
import { type IPermissionRequest, PermissionDecision, PermissionDetailKind, PermissionOption, type ToolCall, ToolFailureCode, ToolRisk,
  WebViewFailureException } from "@noldova/desktop.runtime";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CallFailureException } from "../src/exceptions/call-failure.exception.ts";
import { NavigationRefusedException } from "../src/exceptions/navigation-refused.exception.ts";
import type { IBrowserTool } from "../src/interfaces/i-browser-tool.ts";
import { SnapshotReference } from "../src/models/snapshot-reference.ts";
import { BrowserTools } from "../src/tools/browser-tools.ts";
import { ClickTool } from "../src/tools/click.tool.ts";
import { ConsoleTool } from "../src/tools/console.tool.ts";
import { NavigateTool } from "../src/tools/navigate.tool.ts";
import { PressKeyTool } from "../src/tools/press-key.tool.ts";
import { ScreenshotTool } from "../src/tools/screenshot.tool.ts";
import { SnapshotTool } from "../src/tools/snapshot.tool.ts";
import { TypeTool } from "../src/tools/type.tool.ts";
import { WaitForTool } from "../src/tools/wait-for.tool.ts";
import type { JsonObject } from "../src/types/json-value.ts";
import { ShopPage } from "./fixtures/shop-page.fixture.ts";
import { ToolBench } from "./fixtures/tool-bench.fixture.ts";

interface IRiskRow {
  readonly action: string;
  readonly checkAsync: () => Promise<void>;
}

const TABLE_HEADING: string = "| Action | Risk | Asks the person | \"Always\" remembers |";
const ACTING: readonly PermissionOption[] = [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny];
const HIGH: readonly PermissionOption[] = [PermissionOption.AllowOnce, PermissionOption.Deny];
const TAKING_OVER: readonly PermissionOption[] = [PermissionOption.AllowOnce, PermissionOption.TakeOver, PermissionOption.Deny];
const REFUSED_METHODS: readonly string[] = ["Browser.setDownloadBehavior", "Page.setDownloadBehavior", "DOM.setFileInputFiles", "Page.setInterceptFileChooserDialog",
  "Target.createTarget", "Browser.grantPermissions", "Browser.setPermission", "Fetch.enable", "Fetch.continueWithAuth", "Security.handleCertificateError",
  "Security.setIgnoreCertificateErrors"];

async function readActionsAsync(): Promise<readonly string[]> {
  const text: string = await readFile(new URL("../../../documents/SECURITY-MODEL.md", import.meta.url), "utf8");
  const lines: readonly string[] = text.split(/\r?\n/u);
  const start: number = lines.indexOf(TABLE_HEADING);
  const end: number = lines.findIndex((t, index) => index > start && !t.startsWith("|"));
  return lines.slice(start + 2, end).map(t => t.split("|")[1]?.trim() ?? "");
}

function focusedTree(backendNodeId: number): JsonObject {
  const focused: JsonObject = { name: "focused", value: { type: "booleanOrUndefined", value: true } };
  return { nodes: [
    { nodeId: "1", role: { value: "RootWebArea" }, name: { value: "Cart" }, childIds: ["2"], backendDOMNodeId: 1 },
    { nodeId: "2", role: { value: "textbox" }, properties: [focused], backendDOMNodeId: backendNodeId }
  ] };
}

describe("the risk table", () => {
  let bench: ToolBench;

  function reference(backendNodeId: number): string {
    return bench.sessions.issueReference(ToolBench.SESSION, new SnapshotReference(ToolBench.VIEW, "L1", backendNodeId));
  }

  async function runAsync(tool: IBrowserTool, input: JsonObject): Promise<string> {
    const failure: unknown = await failureOfAsync(tool, input);
    return failure === null ? "Done" : failure instanceof CallFailureException ? failure.reason : "Failed";
  }

  async function failureOfAsync(tool: IBrowserTool, input: JsonObject): Promise<unknown> {
    const call: ToolCall = bench.call(input);
    return bench.runAsync(tool, call).then(() => null, (error: unknown) => error);
  }

  function asked(): readonly (readonly [string, ToolRisk, boolean, readonly PermissionOption[]])[] {
    return bench.permissions.requests.map((t: IPermissionRequest) => [t.action, t.risk, t.isAsking === true, t.options] as const);
  }

  function sent(method: string): number {
    return bench.methods.filter(t => t === method).length;
  }

  afterEach(() => {
    bench[Symbol.dispose]();
  });

  beforeEach(() => {
    bench = new ToolBench();
    bench.keep("workspace-1", [ShopPage.ORIGIN]);
    ShopPage.serve(bench, ShopPage.LINK);
    bench.surface.answer("Page.getLayoutMetrics", { cssVisualViewport: { pageX: 0, pageY: 0, clientWidth: 800, clientHeight: 600 }, cssContentSize: { width: 800, height: 1200 },
      visualViewport: { clientWidth: 800 } });
    bench.surface.answer("Page.captureScreenshot", { data: "iVBORw0KGgo=" });
    bench.surface.answer("Page.getNavigationHistory", { currentIndex: 1, entries: [{ url: "https://shop.test/" }, { url: "https://shop.test/cart/" }, { url: "https://shop.test/next" }] });
    bench.surface.afterNavigation = (viewId: string): void => {
      bench.surface.emitProtocolEvent(viewId, "Page.frameStartedNavigating", { frameId: "F1", loaderId: "L2", navigationType: "differentDocument" });
      bench.surface.emitProtocolEvent(viewId, "Page.frameNavigated", { frame: { id: "F1", loaderId: "L2" } });
      bench.surface.emitProtocolEvent(viewId, "Page.loadEventFired", {});
    };
  });

  const ROWS: readonly IRiskRow[] = [
    {
      action: "Navigate, go back or forward, or reload within the allowed origins",
      checkAsync: async () => {
        const tool: NavigateTool = new NavigateTool(bench.kit);
        bench.surface.answer("Page.getNavigationHistory", { currentIndex: 1, entries: [{ url: "https://shop.test/cart/" }, { url: "https://shop.test/cart/" }, { url: "https://shop.test/cart/" }] });
        const outcomes: readonly string[] = [await runAsync(tool, { url: "https://shop.test/next" }), await runAsync(tool, { action: "back" }),
          await runAsync(tool, { action: "forward" }), await runAsync(tool, { action: "reload" })];

        expect([outcomes, asked().map(t => [t[1], t[2]])]).toEqual([["Done", "Done", "Done", "Done"], Array(4).fill([ToolRisk.Low, false])]);
      }
    },
    {
      action: "Navigate outside the allowed origins",
      checkAsync: async () => {
        const tool: NavigateTool = new NavigateTool(bench.kit);
        bench.permissions.automaticDecision = PermissionDecision.DeniedAlways;
        const outcomes: readonly string[] = [await runAsync(tool, { url: "https://new.example/a" }), await runAsync(tool, { url: "https://new.example/b" })];
        bench.permissions.automaticDecision = PermissionDecision.Denied;
        const other: string = await runAsync(tool, { url: "https://other.example/" });

        expect([...outcomes, other]).toEqual(["Denied", "Denied", "Denied"]);
        expect([asked(), bench.permissions.requests.map(t => [t.subject, t.labels])]).toEqual([
          [["browser.navigate", ToolRisk.Medium, true, [PermissionOption.AllowAlways, PermissionOption.Deny, PermissionOption.DenyAlways]],
            ["browser.navigate", ToolRisk.Medium, true, [PermissionOption.AllowAlways, PermissionOption.Deny, PermissionOption.DenyAlways]]],
          [["https://new.example", { [PermissionOption.AllowAlways]: "Allow this site for the workspace" }],
            ["https://other.example", { [PermissionOption.AllowAlways]: "Allow this site for the workspace" }]]
        ]);
        expect(bench.surface.navigations).toEqual([]);
      }
    },
    {
      action: "Be redirected out of the allowed origins",
      checkAsync: async () => {
        bench.surface.navigationOutcome = new WebViewNavigation(WebViewNavigationKind.Refused, "https://elsewhere.example");

        const failure: unknown = await failureOfAsync(new NavigateTool(bench.kit), { url: "https://shop.test/next" });

        expect(failure).toBeInstanceOf(NavigationRefusedException);
        expect(failure).toMatchObject({ reason: ToolFailureCode.Refused, message: "Navigation to https://elsewhere.example was refused." });
        expect(asked().map(t => [t[1], t[2]])).toEqual([[ToolRisk.Low, false]]);
      }
    },
    {
      action: "Read the page: snapshot, screenshot or console",
      checkAsync: async () => {
        const outcomes: readonly string[] = [await runAsync(new SnapshotTool(bench.kit), {}), await runAsync(new ScreenshotTool(bench.kit), {}),
          await runAsync(new ConsoleTool(bench.kit), {})];

        expect([outcomes, bench.permissions.requests]).toEqual([["Done", "Done", "Done"], []]);
      }
    },
    {
      action: "Click anything but the submit control of a form that holds a secret field: a submit control of a form that holds none, a link or an area, any other "
        + "element or plain content, and a click the tool can't classify beforehand, with no element reference, at a point, or on a node it can't resolve; the click "
        + "scrolls its element into view unless the element shows at its centre, in the view and topmost there, and Browser has no scroll of its own",
      checkAsync: async () => {
        const tool: ClickTool = new ClickTool(bench.kit);
        bench.permissions.automaticDecision = PermissionDecision.AllowedAlways;
        const first: string = await runAsync(tool, { reference: reference(ShopPage.LINK) });
        ShopPage.serve(bench, ShopPage.FORM_BUTTON);
        const second: string = await runAsync(tool, { reference: reference(ShopPage.FORM_BUTTON) });

        expect([first, second, asked()]).toEqual(["Done", "Done", [["browser.click", ToolRisk.Medium, true, ACTING]]]);
        expect(bench.permissions.requests[0]?.labels).toEqual({ [PermissionOption.AllowAlways]: "Allow for this chat" });
        // Both elements are in view, so neither click scrolls.
        expect([sent("DOM.scrollIntoViewIfNeeded"), sent("Input.dispatchMouseEvent")]).toEqual([0, 6]);
      }
    },
    {
      action: "Type, or press any key, in a field that isn't a secret field, or with nothing focused but for the unseen focus two rows below, unless it submits a form "
        + "that holds a secret field; Enter in a form field and the type tool's submit option included",
      checkAsync: async () => {
        bench.surface.answer("Accessibility.getFullAXTree", focusedTree(ShopPage.SEARCH));
        bench.permissions.automaticDecision = PermissionDecision.AllowedAlways;
        const outcomes: readonly string[] = [
          await runAsync(new TypeTool(bench.kit), { reference: reference(ShopPage.SEARCH), text: "red shoes", submit: true }),
          await runAsync(new TypeTool(bench.kit), { reference: reference(ShopPage.SEARCH), text: "blue" }),
          await runAsync(new PressKeyTool(bench.kit), { key: "Enter" }),
          await runAsync(new PressKeyTool(bench.kit), { key: "a" })
        ];

        expect([outcomes, asked()]).toEqual([["Done", "Done", "Done", "Done"],
          [["browser.type", ToolRisk.Medium, true, ACTING], ["browser.pressKey", ToolRisk.Medium, true, ACTING]]]);
        expect([sent("Input.insertText"), sent("Input.dispatchKeyEvent") > 0]).toEqual([2, true]);
      }
    },
    {
      action: "Submit a form that holds a secret field: click its submit control, press Enter or Space on it, or press Enter in any of its inputs but a button or a "
        + "reset button, a checkbox or a radio button included, the type tool's submit option included",
      checkAsync: async () => {
        ShopPage.serve(bench, ShopPage.SIGN_IN);
        const outcomes: string[] = [];
        for (let count: number = 0; count < 2; count++)
          outcomes.push(await runAsync(new ClickTool(bench.kit), { reference: reference(ShopPage.SIGN_IN) }));
        bench.surface.answer("Accessibility.getFullAXTree", focusedTree(ShopPage.SIGN_IN));
        outcomes.push(await runAsync(new PressKeyTool(bench.kit), { key: "Enter" }), await runAsync(new PressKeyTool(bench.kit), { key: " " }));
        bench.surface.answer("Accessibility.getFullAXTree", focusedTree(ShopPage.EMAIL));
        outcomes.push(await runAsync(new PressKeyTool(bench.kit), { key: "Enter" }),
          await runAsync(new TypeTool(bench.kit), { reference: reference(ShopPage.EMAIL), text: "buyer@example.com", submit: true }));

        expect(outcomes).toEqual(Array(6).fill("Done"));
        expect(asked()).toEqual([
          ["browser.clickSecret", ToolRisk.High, true, HIGH], ["browser.clickSecret", ToolRisk.High, true, HIGH], ["browser.pressKeySecret", ToolRisk.High, true, HIGH],
          ["browser.pressKeySecret", ToolRisk.High, true, HIGH], ["browser.pressKeySecret", ToolRisk.High, true, HIGH], ["browser.typeSecret", ToolRisk.High, true, HIGH]
        ]);
      }
    },
    {
      action: "A key through press_key that types a character, Enter or Space, on a page whose whole accessibility tree is too large for one reply, where the document "
        + "shows no focused element, which it doesn't while the window has no focus",
      checkAsync: async () => {
        bench.surface.answerWith("Accessibility.getFullAXTree", (params: JsonObject) => {
          if (params["depth"] === undefined)
            throw new WebViewFailureException(new WebViewFailure(WebViewFailureKind.TooLarge));
          return { nodes: [{ nodeId: "1", role: { value: "RootWebArea" }, name: { value: "Cart" } }] };
        });
        bench.surface.answer("DOM.getDocument", { root: { nodeId: 1, backendNodeId: 1, nodeName: "#document" } });
        bench.surface.answer("DOM.querySelector", { nodeId: 0 });
        const outcomes: string[] = [];
        for (const key of ["a", "Enter", " ", "Escape"])
          outcomes.push(await runAsync(new PressKeyTool(bench.kit), { key }));

        expect([outcomes, asked()]).toEqual([Array(4).fill("Done"), [...Array(3).fill(["browser.pressKeySecret", ToolRisk.High, true, HIGH]),
          ["browser.pressKey", ToolRisk.Medium, true, ACTING]]]);
      }
    },
    {
      action: "Any input into a secret field: typing, any key through press_key, Enter and the type tool's submit option included",
      checkAsync: async () => {
        bench.surface.answer("Accessibility.getFullAXTree", focusedTree(ShopPage.PASSWORD));
        const outcomes: readonly string[] = [
          await runAsync(new TypeTool(bench.kit), { reference: reference(ShopPage.PASSWORD), text: "1234" }),
          await runAsync(new TypeTool(bench.kit), { reference: reference(ShopPage.PASSWORD), text: "1234", submit: true }),
          await runAsync(new PressKeyTool(bench.kit), { key: "a" }),
          await runAsync(new PressKeyTool(bench.kit), { key: "Enter" })
        ];

        expect([outcomes, asked()]).toEqual([["Done", "Done", "Done", "Done"], [
          ["browser.typeSecret", ToolRisk.High, true, TAKING_OVER], ["browser.typeSecret", ToolRisk.High, true, HIGH],
          ["browser.pressKeySecret", ToolRisk.High, true, TAKING_OVER], ["browser.pressKeySecret", ToolRisk.High, true, HIGH]
        ]]);
        expect(bench.permissions.requests.slice(0, 2).map(t => t.details.find(u => u.label === "Text"))).toEqual(Array(2).fill({ label: "Text", kind: PermissionDetailKind.Text,
          value: "4 characters, hidden" }));
        expect(JSON.stringify(bench.permissions.requests)).not.toContain("1234");
        expect(bench.permissions.requests[0]?.labels).toEqual({ [PermissionOption.TakeOver]: "I'll type it myself" });
      }
    },
    {
      action: "Wait for text, an element or a load",
      checkAsync: async () => {
        expect([await runAsync(new WaitForTool(bench.kit), { text: "Cart", timeoutMilliseconds: 1_000 }), bench.permissions.requests]).toEqual(["Done", []]);
      }
    },
    {
      action: "Download, upload, open a new window, use a site permission, answer an authentication prompt or pass a certificate error",
      checkAsync: async () => {
        const declaration: unknown = JSON.parse(await readFile(new URL("../webViews.json", import.meta.url), "utf8"));

        expect(declaration).toMatchObject({ methods: expect.arrayContaining([{ name: "Page.enable" }]) });
        for (const method of REFUSED_METHODS)
          expect(declaration).not.toMatchObject({ methods: expect.arrayContaining([expect.objectContaining({ name: method })]) });
        expect(BrowserTools.create(bench.kit).map(t => t.descriptor.name)).toEqual(["browser_navigate", "browser_snapshot", "browser_click", "browser_type",
          "browser_press_key", "browser_screenshot", "browser_console", "browser_wait_for"]);
      }
    }
  ];

  for (const row of ROWS)
    it(row.action, () => row.checkAsync());

  it("has a test for each row of the table, and each test names a row", async () => {
    expect(ROWS.map(t => t.action)).toEqual(await readActionsAsync());
  });
});
