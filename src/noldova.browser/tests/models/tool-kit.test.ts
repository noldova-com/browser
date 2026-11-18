/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewFailure, WebViewFailureKind } from "@noldova/desktop.protocol";
import { PermissionDecision, PermissionDetailKind, PermissionOption, ToolFailureCode, ToolRisk, WebViewFailureException } from "@noldova/desktop.runtime";
import { PageAction, TypedRedirectRequest } from "@noldova/browser.protocol";
import { describe, expect, it, vi } from "vitest";

import { CallCancelledException } from "../../src/exceptions/call-cancelled.exception.ts";
import { CallStoppedException } from "../../src/exceptions/call-stopped.exception.ts";
import { HandedOverException } from "../../src/exceptions/handed-over.exception.ts";
import { MalformedReplyException } from "../../src/exceptions/malformed-reply.exception.ts";
import { PageChangedAfterGrantException } from "../../src/exceptions/page-changed-after-grant.exception.ts";
import { PageNotControlledException } from "../../src/exceptions/page-not-controlled.exception.ts";
import { StaleReferenceException } from "../../src/exceptions/stale-reference.exception.ts";
import { TypedRedirectAfterAgentException } from "../../src/exceptions/typed-redirect-after-agent.exception.ts";
import { UnknownReferenceException } from "../../src/exceptions/unknown-reference.exception.ts";
import { ActionProgress } from "../../src/models/action-progress.ts";
import { CallOptions } from "../../src/models/call-options.ts";
import { ElementReference } from "../../src/models/element-reference.ts";
import { SessionPage } from "../../src/models/session-page.ts";
import { SnapshotReference } from "../../src/models/snapshot-reference.ts";
import { ToolDescriptors } from "../../src/models/tool-descriptors.ts";
import { ToolKit } from "../../src/models/tool-kit.ts";
import { Resources } from "../../src/resources.ts";
import { writtenTo } from "../fixtures/desktop-fakes.fixture.ts";
import { ShopPage } from "../fixtures/shop-page.fixture.ts";
import { ToolBench } from "../fixtures/tool-bench.fixture.ts";

describe("ToolKit", () => {
  function optionsOf(signal: AbortSignal): CallOptions {
    return new CallOptions(signal, 0, 0, false, new ActionProgress(() => undefined));
  }

  it("stops a call that waited for its turn while the person stopped the page, and runs none of its work nor records its agent", async () => {
    using bench: ToolBench = new ToolBench();
    const page: SessionPage = new SessionPage(ToolBench.VIEW, "page-1", "workspace-1", "Builder");
    let release: () => void = () => undefined;
    let started: () => void = () => undefined;
    const running: Promise<void> = new Promise<void>(resolve => started = resolve);
    const first: Promise<null> = bench.kit.actAsync(bench.call({}), page, PageAction.Reading, () => new Promise<null>(resolve => {
      release = () => resolve(null);
      started();
    }));
    let isRun: boolean = false;
    const queued: Promise<null> = bench.kit.actAsync(bench.call({}), page, PageAction.Reading, async () => { isRun = true; return null; });

    await running;
    bench.kit.stops.stop("page-1", false);
    release();

    await first;
    await expect(queued).rejects.toBeInstanceOf(CallStoppedException);
    await expect(queued).rejects.toMatchObject({ reason: "Stopped" });
    expect(isRun).toBe(false);
    await bench.kit.actAsync(bench.call({}), new SessionPage(ToolBench.VIEW, "page-1", "workspace-1", "Scout"), PageAction.Reading, async () => null);
    expect(bench.agents).toEqual([["page-1", "Builder"], ["page-1", "Scout"]]);
  });

  it("marks the page's view as controlled before each call's work, and as no longer controlled once the person stops the page", async () => {
    using bench: ToolBench = new ToolBench();
    const page: SessionPage = new SessionPage(ToolBench.VIEW, "page-1", "workspace-1", "Builder");
    const steps: unknown[][] = [];
    bench.surface.webViews.answer("setControlledAsync", (viewId, isControlled) => {
      steps.push([viewId, isControlled]);
      return Promise.resolve();
    });

    for (const action of [PageAction.Reading, PageAction.Clicking])
      await bench.kit.actAsync(bench.call({}), page, action, async () => steps.push(["work"]));
    bench.kit.stops.stop("page-1", false);

    expect(steps).toEqual([[ToolBench.VIEW, true], ["work"], [ToolBench.VIEW, true], ["work"], [ToolBench.VIEW, false]]);
  });

  it("lets go of the view a call marked once a later call finds the page in another view, before marking that one, and of that one at the end", async () => {
    using bench: ToolBench = new ToolBench();
    bench.surface.instances.set("view-2", "page-1");
    const steps: unknown[][] = [];
    bench.surface.webViews.answer("setControlledAsync", (viewId, isControlled) => {
      steps.push([viewId, isControlled]);
      return Promise.resolve();
    });

    for (const view of [ToolBench.VIEW, "view-2"])
      await bench.kit.actAsync(bench.call({}), new SessionPage(view, "page-1", "workspace-1", "Builder"), PageAction.Reading, async () => steps.push(["work"]));
    const held: boolean = bench.kit.stops.controlsView(ToolBench.VIEW);
    bench.kit.stops.stop("page-1", false);

    expect(held).toBe(false);
    expect(steps).toEqual([[ToolBench.VIEW, true], ["work"], [ToolBench.VIEW, false], ["view-2", true], ["work"], ["view-2", false]]);
  });

  it("does none of a call's work and fails it as unavailable, naming the view and the cause, when the view can't be marked as controlled", async () => {
    using bench: ToolBench = new ToolBench();
    const page: SessionPage = new SessionPage(ToolBench.VIEW, "page-1", "workspace-1", "Builder");
    const cause: Error = new Error("The web view call failed: Unavailable.");
    bench.surface.webViews.answer("setControlledAsync", () => Promise.reject(cause));
    let isRun: boolean = false;

    const called: Promise<null> = bench.kit.actAsync(bench.call({}), page, PageAction.Clicking, async () => {
      isRun = true;
      return null;
    });

    await expect(called).rejects.toBeInstanceOf(PageNotControlledException);
    await expect(called).rejects.toMatchObject({ reason: "Unavailable", moduleCode: "browser.notControlled", cause,
      message: `The page's view ${ToolBench.VIEW} couldn't be kept drawing for the agent, so nothing was done: The web view call failed: Unavailable.` });
    expect([isRun, bench.kit.stops.controlsView(ToolBench.VIEW)]).toEqual([false, true]);
  });

  it("logs a view it couldn't mark as no longer controlled, unless the view had closed, and a view no control holds is marked so, while a held one keeps its mark", async () => {
    using bench: ToolBench = new ToolBench();
    const page: SessionPage = new SessionPage(ToolBench.VIEW, "page-1", "workspace-1", "Builder");
    const cleared: string[] = [];
    bench.surface.webViews.answer("setControlledAsync", (viewId, isControlled) => {
      if (isControlled)
        return Promise.resolve();
      cleared.push(viewId);
      return Promise.reject(viewId === "view-3" ? new WebViewFailureException(new WebViewFailure(WebViewFailureKind.ViewClosed)) : new Error("gone"));
    });
    await bench.kit.actAsync(bench.call({}), page, PageAction.Reading, async () => null);

    bench.kit.letGoUnheld(ToolBench.VIEW);
    bench.kit.letGoUnheld("view-2");
    bench.kit.letGoUnheld("view-3");
    bench.kit.stops.stop("page-1", false);
    await ToolBench.settleAsync();

    expect(cleared).toEqual(["view-2", "view-3", ToolBench.VIEW]);
    expect(writtenTo(bench.log)).toEqual(["view-2", ToolBench.VIEW].map(t => `The page's view ${t} wasn't marked as no longer controlled, so it may keep drawing while hidden: Error: gone`));
  });

  it("gives a page whose view follows the person's typed redirects back its workspace's origins before an agent acts on it, and follows no more", async () => {
    using bench: ToolBench = new ToolBench();
    const page: SessionPage = new SessionPage(ToolBench.VIEW, "page-1", "workspace-1", "Builder");
    await bench.kit.origins.passTypedAsync(new TypedRedirectRequest("page-1", "workspace-1", "https://www.example.com/"));
    expect(bench.surface.allowedOrigins.get(ToolBench.VIEW)).toEqual(["https://www.example.com"]);

    const seen: unknown = await bench.kit.actAsync(bench.call({}), page, PageAction.Reading, async () => [bench.surface.allowedOrigins.get(ToolBench.VIEW), bench.kit.origins.isPassing(ToolBench.VIEW)]);

    expect(seen).toEqual([[], false]);
    await expect(bench.kit.origins.passTypedAsync(new TypedRedirectRequest("page-1", "workspace-1", "https://www.example.com/"))).rejects.toBeInstanceOf(TypedRedirectAfterAgentException);
  });

  it("stops a call when the person stops the page, or the call is cancelled, while the page's typed redirects stop passing, and starts no control", async () => {
    const page: SessionPage = new SessionPage(ToolBench.VIEW, "page-1", "workspace-1", "Builder");
    const controller: AbortController = new AbortController();
    const interrupts: readonly ((bench: ToolBench) => void)[] = [t => t.kit.stops.stop("page-1", false), () => controller.abort("Cancelled")];
    const failures: unknown[] = [];
    const controls: unknown[] = [];
    let isRun: boolean = false;
    for (const interrupt of interrupts) {
      using bench: ToolBench = new ToolBench();
      await bench.kit.origins.passTypedAsync(new TypedRedirectRequest("page-1", "workspace-1", "https://www.example.com/"));
      let release: () => void = () => undefined;
      let started: () => void = () => undefined;
      const allowing: Promise<void> = new Promise<void>(resolve => started = resolve);
      bench.surface.allowing = () => new Promise<void>(resolve => {
        release = resolve;
        started();
      });
      const running: Promise<null> = bench.kit.actAsync(bench.call({}, controller), page, PageAction.Reading, async () => { isRun = true; return null; });

      await allowing;
      interrupt(bench);
      release();
      failures.push(await running.catch((error: unknown) => error));
      controls.push(...bench.kit.stops.activities());
    }

    expect(failures[0]).toBeInstanceOf(CallStoppedException);
    expect(failures[1]).toBeInstanceOf(CallCancelledException);
    expect([isRun, controls]).toEqual([false, []]);
  });

  it("writes a request with the origin as its subject and the details as given, asking for any risk above low", () => {
    expect(ToolKit.request("browser.click", "Click Pay", "https://shop.test", [{ label: "Element", kind: PermissionDetailKind.Text, value: "Pay" }], ToolRisk.Medium,
      [PermissionOption.AllowOnce, PermissionOption.Deny])).toEqual({
      action: "browser.click",
      subject: "https://shop.test",
      title: "Click Pay",
      details: [{ label: "Element", kind: PermissionDetailKind.Text, value: "Pay" }],
      risk: ToolRisk.Medium,
      isAsking: true,
      options: [PermissionOption.AllowOnce, PermissionOption.Deny],
      labels: {}
    });
  });

  it("gives a high-risk request an action of its own, which no answer kept for the tool's lower risks matches", () => {
    const actionOf = (risk: ToolRisk): string => ToolKit.request("browser.type", "Type", "https://shop.test", [], risk, ToolKit.actingOptions(risk)).action;

    expect([actionOf(ToolRisk.Low), actionOf(ToolRisk.Medium), actionOf(ToolRisk.High)]).toEqual(["browser.type", "browser.type", "browser.typeSecret"]);
  });

  it("gives every Allow always and Take over it offers its words: for the chat, or what the caller names, and typing it themself", () => {
    const labelsOf = (options: readonly PermissionOption[], always?: string): unknown =>
      ToolKit.request("browser.type", "Type", "https://shop.test", [], ToolRisk.High, options, always).labels;

    expect([
      labelsOf(ToolKit.lowRiskOptions),
      labelsOf([PermissionOption.AllowAlways, PermissionOption.Deny], "Allow this site for the workspace"),
      labelsOf([PermissionOption.AllowOnce, PermissionOption.TakeOver, PermissionOption.Deny])
    ]).toEqual([
      { [PermissionOption.AllowAlways]: "Allow for this chat" },
      { [PermissionOption.AllowAlways]: "Allow this site for the workspace" },
      { [PermissionOption.TakeOver]: "I'll type it myself" }
    ]);
    expect(Math.max(...[Resources.allowForChatLabel, Resources.allowSiteLabel, Resources.typeItMyselfLabel].map(t => t.length))).toBeLessThanOrEqual(40);
  });

  it("offers an acting call's options by its risk: every one when low, once or for the chat when medium, and taking it over only when high and possible", () => {
    expect([ToolKit.actingOptions(ToolRisk.Low), ToolKit.actingOptions(ToolRisk.Medium), ToolKit.actingOptions(ToolRisk.Medium, true), ToolKit.actingOptions(ToolRisk.High),
      ToolKit.actingOptions(ToolRisk.High, true)]).toEqual([
      ToolKit.lowRiskOptions,
      [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny],
      [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny],
      [PermissionOption.AllowOnce, PermissionOption.Deny],
      [PermissionOption.AllowOnce, PermissionOption.TakeOver, PermissionOption.Deny]
    ]);
  });

  it("hands nothing over for a taken-over answer when the call has no hand-over, or for any other failure", async () => {
    using bench: ToolBench = new ToolBench();
    const page: SessionPage = new SessionPage(ToolBench.VIEW, "page-1", "workspace-1", "Builder");
    const request = ToolKit.request("browser.type", "Type", "https://shop.test", [], ToolRisk.High, ToolKit.actingOptions(ToolRisk.High, true));
    const handOver = vi.fn(() => Promise.resolve());
    bench.checkAs(ToolDescriptors.type);
    bench.permissions.automaticDecision = PermissionDecision.TakenOver;
    const taken: Promise<null> = bench.kit.actAsync(bench.call({}), page, PageAction.Typing, async activity => {
      await bench.kit.askAsync(activity, bench.call({}), request, new ActionProgress(() => undefined));
      return null;
    });
    await expect(taken).rejects.toBeInstanceOf(HandedOverException);
    await expect(taken).rejects.toMatchObject({ reason: ToolFailureCode.Denied, moduleCode: "browser.handedOver" });
    vi.spyOn(bench.kit.gate, "askAsync").mockRejectedValueOnce(new TypeError("The gate broke."));
    const broken: Promise<null> = bench.kit.actAsync(bench.call({}), page, PageAction.Typing, async activity => {
      await bench.kit.askAsync(activity, bench.call({}), request, new ActionProgress(() => undefined), handOver);
      return null;
    });

    await expect(broken).rejects.toThrow("The gate broke.");
    expect([handOver.mock.calls.length, bench.activities.filter(t => t["isHandedOver"] === true)]).toEqual([0, []]);
  });

  it("leaves the page with the person when the hand-over fails as a call on the page does, and lets any other failure of it through", async () => {
    using bench: ToolBench = new ToolBench();
    const page: SessionPage = new SessionPage(ToolBench.VIEW, "page-1", "workspace-1", "Builder");
    const request = ToolKit.request("browser.type", "Type", "https://shop.test", [], ToolRisk.High, ToolKit.actingOptions(ToolRisk.High, true));
    bench.checkAs(ToolDescriptors.type);
    bench.permissions.automaticDecision = PermissionDecision.TakenOver;
    const handOverFailing = (failure: Error): Promise<null> => bench.kit.actAsync(bench.call({}), page, PageAction.Typing, async activity => {
      await bench.kit.askAsync(activity, bench.call({}), request, new ActionProgress(() => undefined), () => Promise.reject(failure));
      return null;
    });
    const bug: TypeError = new TypeError("The focus broke.");

    await expect(handOverFailing(new PageChangedAfterGrantException())).rejects.toBeInstanceOf(HandedOverException);
    await expect(handOverFailing(bug)).rejects.toBe(bug);
    expect(bench.activities.filter(t => t["state"] === "Ended").map(t => t["isHandedOver"])).toEqual([true, true]);
  });

  it("follows the element only while a request asks the person, since one that asks nobody shows no card", async () => {
    using bench: ToolBench = new ToolBench();
    ShopPage.serve(bench, ShopPage.LINK);
    const page: SessionPage = new SessionPage(ToolBench.VIEW, "page-1", "workspace-1", "Builder");
    const element: ElementReference = new ElementReference(ToolBench.VIEW, "L1", ShopPage.LINK);
    const reads: number[] = [];
    for (const risk of [ToolRisk.Low, ToolRisk.Medium]) {
      await bench.kit.actAsync(bench.call({}), page, PageAction.Clicking, activity => bench.kit.followAsync(activity, element,
        ToolKit.request("browser.click", "Click <a>", ShopPage.ORIGIN, [], risk, [PermissionOption.AllowOnce]), optionsOf(activity.signal), async () => {
          await ToolBench.settleAsync();
          return null;
        }));
      reads.push(bench.surface.calls.filter(t => t.method === "Page.getFrameTree").length);
    }

    expect(reads[0]).toBe(0);
    expect(reads[1]).toBeGreaterThanOrEqual(1);
  });

  describe("findReferencedNodeAsync", () => {
    function readingOptions(): CallOptions {
      return new CallOptions(new AbortController().signal, Date.now() + 1_000, 100_000, true, new ActionProgress(() => undefined));
    }

    it("finds the node of the element the snapshot kept by the reference's index, and releases the element's object", async () => {
      using bench: ToolBench = new ToolBench();
      bench.surface.answer("Page.getFrameTree", ShopPage.frame());
      const id: string = bench.sessions.issueReference(ToolBench.SESSION, new SnapshotReference(ToolBench.VIEW, "L1", ShopPage.LINK));

      const element: ElementReference = await bench.kit.findReferencedNodeAsync(ToolBench.SESSION, id, ToolBench.VIEW, "L1", readingOptions());

      expect(element).toStrictEqual(new ElementReference(ToolBench.VIEW, "L1", ShopPage.LINK));
      const objects: readonly string[] = ["Runtime.callFunctionOn", "DOM.describeNode", "Runtime.releaseObject"];
      expect(bench.surface.calls.filter(t => objects.includes(t.method)).map(t => [t.method, t.params["objectId"] ?? t.params["arguments"]])).toEqual([
        ["Runtime.callFunctionOn", [{ value: { element: ShopPage.LINK } }]],
        ["DOM.describeNode", "snapshot-element-7"],
        ["Runtime.releaseObject", "snapshot-element-7"]
      ]);
    });

    it("fails a reference whose element left the page as stale, describing nothing", async () => {
      using bench: ToolBench = new ToolBench();
      bench.surface.answer("Page.getFrameTree", ShopPage.frame());
      bench.surface.goneElements.add(ShopPage.LINK);
      const id: string = bench.sessions.issueReference(ToolBench.SESSION, new SnapshotReference(ToolBench.VIEW, "L1", ShopPage.LINK));

      await expect(bench.kit.findReferencedNodeAsync(ToolBench.SESSION, id, ToolBench.VIEW, "L1", readingOptions())).rejects.toBeInstanceOf(StaleReferenceException);
      expect(bench.methods).not.toContain("DOM.describeNode");
    });

    it("gives the node of an element read inside a closed shadow root as it was issued, sending nothing", async () => {
      using bench: ToolBench = new ToolBench();
      const id: string = bench.sessions.issueReference(ToolBench.SESSION, new ElementReference(ToolBench.VIEW, "L1", 27));

      expect(await bench.kit.findReferencedNodeAsync(ToolBench.SESSION, id, ToolBench.VIEW, "L1", readingOptions())).toStrictEqual(new ElementReference(ToolBench.VIEW, "L1", 27));
      expect(bench.methods).toEqual([]);
    });

    it("fails a reference no snapshot gave as unknown, sending nothing", async () => {
      using bench: ToolBench = new ToolBench();

      await expect(bench.kit.findReferencedNodeAsync(ToolBench.SESSION, "e4", ToolBench.VIEW, "L1", readingOptions())).rejects.toBeInstanceOf(UnknownReferenceException);
      expect(bench.methods).toEqual([]);
    });

    it("fails a description without the node's id as malformed, and releases the element's object all the same", async () => {
      using bench: ToolBench = new ToolBench();
      bench.surface.answer("Page.getFrameTree", ShopPage.frame());
      bench.surface.findElement = () => ({ result: { type: "object", subtype: "node", objectId: "element-7" } });
      const id: string = bench.sessions.issueReference(ToolBench.SESSION, new SnapshotReference(ToolBench.VIEW, "L1", ShopPage.LINK));

      for (const reply of [{ node: { nodeName: "A" } }, { node: 7 }, {}]) {
        bench.surface.answer("DOM.describeNode", reply);
        await expect(bench.kit.findReferencedNodeAsync(ToolBench.SESSION, id, ToolBench.VIEW, "L1", readingOptions())).rejects.toBeInstanceOf(MalformedReplyException);
      }
      expect(bench.surface.calls.filter(t => t.method === "Runtime.releaseObject").map(t => t.params)).toEqual(Array(3).fill({ objectId: "element-7" }));
    });
  });

  it("cuts a title past Noldova Desktop's 200 characters, and marks the cut", () => {
    const title: (length: number) => string = (length: number): string => ToolKit.request("browser.click", "x".repeat(length), "https://shop.test", [], ToolRisk.Low, ToolKit.lowRiskOptions).title;

    expect(title(200)).toBe("x".repeat(200));
    expect(title(201)).toBe(`${"x".repeat(199)}…`);
  });
});
