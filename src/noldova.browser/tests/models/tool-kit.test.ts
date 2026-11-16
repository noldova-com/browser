/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PermissionDecision, PermissionDetailKind, PermissionOption, ToolFailureCode, ToolRisk } from "@noldova/desktop.runtime";
import { PageAction, TypedRedirectRequest } from "@noldova/browser.protocol";
import { describe, expect, it, vi } from "vitest";

import { CallStoppedException } from "../../src/exceptions/call-stopped.exception.ts";
import { HandedOverException } from "../../src/exceptions/handed-over.exception.ts";
import { PageChangedAfterGrantException } from "../../src/exceptions/page-changed-after-grant.exception.ts";
import { TypedRedirectAfterAgentException } from "../../src/exceptions/typed-redirect-after-agent.exception.ts";
import { ActionProgress } from "../../src/models/action-progress.ts";
import { CallOptions } from "../../src/models/call-options.ts";
import { ElementReference } from "../../src/models/element-reference.ts";
import { SessionPage } from "../../src/models/session-page.ts";
import { ToolDescriptors } from "../../src/models/tool-descriptors.ts";
import { ToolKit } from "../../src/models/tool-kit.ts";
import { Resources } from "../../src/resources.ts";
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

  it("gives a page whose view follows the person's typed redirects back its workspace's origins before an agent acts on it, and follows no more", async () => {
    using bench: ToolBench = new ToolBench();
    const page: SessionPage = new SessionPage(ToolBench.VIEW, "page-1", "workspace-1", "Builder");
    await bench.kit.origins.passTypedAsync(new TypedRedirectRequest("page-1", "workspace-1", "https://www.example.com/"));
    expect(bench.surface.allowedOrigins.get(ToolBench.VIEW)).toEqual(["https://www.example.com"]);

    const seen: unknown = await bench.kit.actAsync(bench.call({}), page, PageAction.Reading, async () => [bench.surface.allowedOrigins.get(ToolBench.VIEW), bench.kit.origins.isPassing(ToolBench.VIEW)]);

    expect(seen).toEqual([[], false]);
    await expect(bench.kit.origins.passTypedAsync(new TypedRedirectRequest("page-1", "workspace-1", "https://www.example.com/"))).rejects.toBeInstanceOf(TypedRedirectAfterAgentException);
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

  it("cuts a title past Noldova Desktop's 200 characters, and marks the cut", () => {
    const title: (length: number) => string = (length: number): string => ToolKit.request("browser.click", "x".repeat(length), "https://shop.test", [], ToolRisk.Low, ToolKit.lowRiskOptions).title;

    expect(title(200)).toBe("x".repeat(200));
    expect(title(201)).toBe(`${"x".repeat(199)}…`);
  });
});
