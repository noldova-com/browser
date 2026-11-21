/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { BrowserEvents, BrowserMethods } from "@noldova/browser.protocol";
import { FailureCode, ShellClients, WebViewEventKind } from "@noldova/desktop.protocol";
import { ClientClosure, type IMethodHandler, MethodFailureException, MethodRegisteredException, ProductFileException, ProductInfo, RequestContext,
  ToolRegisteredException, type ToolSession } from "@noldova/desktop.runtime";
import { afterEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { PageInstanceInvalidException } from "../src/exceptions/page-instance-invalid.exception.ts";
import { StaleReferenceException } from "../src/exceptions/stale-reference.exception.ts";
import type { WindowRequestMalformedException } from "../src/exceptions/window-request-malformed.exception.ts";
import { WindowRequestUnreadException } from "../src/exceptions/window-request-unread.exception.ts";
import type { SessionStates } from "../src/models/session-states.ts";
import { ShownPage } from "../src/models/shown-page.ts";
import { SnapshotReference } from "../src/models/snapshot-reference.ts";
import { ToolDescriptors } from "../src/models/tool-descriptors.ts";
import type { ToolKit } from "../src/models/tool-kit.ts";
import { RuntimePart } from "../src/runtime-part.ts";
import type { ConsoleBuffers } from "../src/services/console-buffers.ts";
import { DatabaseOriginStore } from "../src/services/database-origin-store.ts";
import { DatabasePageStore } from "../src/services/database-page-store.ts";
import { JsonShapes } from "../src/services/json-shapes.ts";
import type { RuntimeDomains } from "../src/services/runtime-domains.ts";
import { ToolResults } from "../src/services/tool-results.ts";
import { BrowserTools } from "../src/tools/browser-tools.ts";
import type { JsonObject, JsonValue } from "../src/types/json-value.ts";
import { BrowserContext, linesAsync, SqliteModuleDatabase, writtenTo } from "./fixtures/desktop-fakes.fixture.ts";
import { ProductFile } from "./fixtures/product-file.fixture.ts";
import { ScriptedViews } from "./fixtures/scripted-views.fixture.ts";

const REFERENCE: SnapshotReference = new SnapshotReference("view-1", "document", 7);
const PAGE: ShownPage = new ShownPage("https://shop.test/", "Shop");
const FRAME: JsonValue = { frameTree: { frame: { id: "F1", loaderId: "L1", url: "https://shop.test/", securityOrigin: "https://shop.test" } } };
const TREE: JsonValue = { nodes: [{ nodeId: "1", role: { value: "RootWebArea" }, name: { value: "Shop" } }] };

function pageViews(...instances: readonly string[]): ScriptedViews {
  const surface: ScriptedViews = new ScriptedViews(instances.map((_instance, index) => `view-${index + 1}`));
  instances.forEach((instance, index) => surface.instances.set(`view-${index + 1}`, instance));
  surface.acknowledge(...ScriptedViews.emptyReplies);
  surface.serveWorlds();
  surface.answer("Page.getFrameTree", FRAME);
  surface.answer("Accessibility.getFullAXTree", TREE);
  return surface;
}

function kitOf(create: MockInstance<typeof BrowserTools.create>): ToolKit {
  const kit: ToolKit | undefined = create.mock.calls.at(-1)?.[0];
  if (kit === undefined)
    throw new Error("The part isn't active.");
  return kit;
}

function partOf(): { readonly part: RuntimePart; readonly states: () => SessionStates } {
  const create: MockInstance<typeof BrowserTools.create> = vi.spyOn(BrowserTools, "create");
  return { part: new RuntimePart(), states: (): SessionStates => kitOf(create).sessions };
}

async function databaseWithAsync(profileKey: string, origins: readonly string[]): Promise<SqliteModuleDatabase> {
  const database: SqliteModuleDatabase = new SqliteModuleDatabase(DatabaseOriginStore.migrations);
  await new DatabaseOriginStore(database).writeAsync(profileKey, origins);
  return database;
}

function typeAsync(context: BrowserContext, payload: JsonValue, client: string = ShellClients.mainProcess, window: number | null = 1): Promise<JsonValue> {
  return requestAsync(context, BrowserMethods.allowTypedAddress, payload, client, window);
}

function requestAsync(context: BrowserContext, method: string, payload: JsonValue, client: string = ShellClients.mainProcess, window: number | null = 1,
  connection: number = 1): Promise<JsonValue> {
  const handler: IMethodHandler | undefined = context.methods.get(method);
  if (handler === undefined)
    throw new Error(`The part registered no method ${method}.`);
  return handler.handleAsync(new RequestContext(client, payload, new AbortController().signal, connection, window));
}

describe("RuntimePart", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refuses every tool's call while the setting Let agents use the browser is off, and reads the setting through its context", async () => {
    const context: BrowserContext = new BrowserContext();
    context.settingValues.set("browser.agentTools", false);
    await new RuntimePart().activateAsync(context);

    expect(await context.tools.openSession("conversation-1", {}).callAsync("browser_snapshot", {})).toMatchObject({ isFailure: true, code: "Unavailable", moduleCode: "browser.toolsOff" });
  });

  it("registers the eight built tools with Noldova Desktop's registry, and withdraws them when it deactivates", async () => {
    const context: BrowserContext = new BrowserContext();
    const part: RuntimePart = new RuntimePart();
    await part.activateAsync(context);

    expect(context.tools.openSession("conversation-1", {}).listTools().map(t => t.name))
      .toEqual(["browser_navigate", "browser_snapshot", "browser_click", "browser_type", "browser_press_key", "browser_screenshot", "browser_console",
        "browser_wait_for"]);

    await part.deactivateAsync();

    expect(context.tools.openSession("conversation-2", {}).listTools()).toEqual([]);
  });

  it("publishes an agent's control of a page to every window through its declared event, one control across its calls, and withdraws the event when it deactivates", async () => {
    const context: BrowserContext = new BrowserContext(pageViews("page-1"));
    const part: RuntimePart = new RuntimePart();
    await part.activateAsync(context);
    const session: ToolSession = context.tools.openSession("conversation-1", { page: "page-1", profileKey: "workspace-1", agentName: "Scout" });

    await session.callAsync("browser_snapshot", {});
    await session.callAsync("browser_snapshot", {});

    const events: JsonValue[] = context.events.get(BrowserEvents.pageActivity) ?? [];
    expect(events.map(t => JsonShapes.isObject(t) ? [t["instance"], t["state"]] : null))
      .toEqual([["page-1", "Acting"], ["page-1", "Idle"], ["page-1", "Acting"], ["page-1", "Idle"]]);
    expect(new Set(events.map(t => JsonShapes.isObject(t) ? t["activity"] : null)).size).toBe(1);
    expect(await requestAsync(context, BrowserMethods.readActivities, null)).toEqual([expect.objectContaining({ instance: "page-1", state: "Idle" })]);
    await part.deactivateAsync();
    expect([...context.events.keys()]).toEqual([]);
  });

  it("ends an agent's control of a page when the window forgets the page, and when the agent's session ends", async () => {
    const first: string = "0f8fad5b-d9cb-469f-a165-70867728950e";
    const second: string = "3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d";
    const context: BrowserContext = new BrowserContext(pageViews(first, second));
    await new RuntimePart().activateAsync(context);
    const firstSession: ToolSession = context.tools.openSession("conversation-1", { page: first, profileKey: "workspace-1", agentName: "Scout" });
    const secondSession: ToolSession = context.tools.openSession("conversation-2", { page: second, profileKey: "workspace-1", agentName: "Scout" });
    await firstSession.callAsync("browser_snapshot", {});
    await secondSession.callAsync("browser_snapshot", {});

    expect(await requestAsync(context, BrowserMethods.forgetPage, { instance: first })).toBeNull();
    secondSession.end();

    expect((context.events.get(BrowserEvents.pageActivity) ?? []).map(t => JsonShapes.isObject(t) ? [t["instance"], t["state"]] : null).slice(-2))
      .toEqual([[first, "Ended"], [second, "Ended"]]);
    expect(await requestAsync(context, BrowserMethods.readActivities, null)).toEqual([]);
  });

  it("stops a page's call from the window, refuses the session it was taken from until that session ends, and lets another session act", async () => {
    const instance: string = "0f8fad5b-d9cb-469f-a165-70867728950e";
    const surface: ScriptedViews = pageViews(instance);
    const reading: PromiseWithResolvers<void> = Promise.withResolvers<void>();
    surface.snapshot = () => {
      reading.resolve();
      return new Promise<JsonValue>(() => undefined);
    };
    const context: BrowserContext = new BrowserContext(surface);
    const bindings: JsonObject = { page: instance, profileKey: "workspace-1", agentName: "Scout" };
    const create: MockInstance<typeof BrowserTools.create> = vi.spyOn(BrowserTools, "create");
    await new RuntimePart().activateAsync(context);
    const taken: ToolSession = context.tools.openSession("conversation-1", bindings);
    const waiting: Promise<unknown> = taken.callAsync("browser_snapshot", {});
    await reading.promise;
    expect(await requestAsync(context, BrowserMethods.readActivities, null)).toEqual([expect.objectContaining({ instance, agentName: "Scout", action: "Reading", state: "Acting" })]);

    expect(await requestAsync(context, BrowserMethods.stopPage, { instance, isTakingOver: true })).toBeNull();

    expect(await waiting).toMatchObject({ isFailure: true, code: "Stopped" });
    expect(await requestAsync(context, BrowserMethods.readActivities, null)).toEqual([]);
    expect(await taken.callAsync("browser_snapshot", {})).toMatchObject({ isFailure: true, code: "Unavailable", moduleCode: "browser.takenOver" });
    surface.snapshot = () => ScriptedViews.snapshotOf("Shop", []);
    expect(await context.tools.openSession("conversation-2", bindings).callAsync("browser_snapshot", {})).toMatchObject({ isFailure: false });
    expect(kitOf(create).stops.isTakenOver(instance, taken.id)).toBe(true);
    taken.end();
    expect(kitOf(create).stops.isTakenOver(instance, taken.id)).toBe(false);
  });

  it("withdraws what it registered when the registry already holds one of its tools, and follows no view", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    const context: BrowserContext = new BrowserContext(surface);
    context.tools.register(ToolDescriptors.snapshot, { handleAsync: async () => ToolResults.text("tree", PAGE) });

    await expect(new RuntimePart().activateAsync(context)).rejects.toBeInstanceOf(ToolRegisteredException);

    expect([context.tools.openSession("conversation-1", {}).listTools().map(t => t.name), [...context.events.keys()]]).toEqual([["browser_snapshot"], []]);
    expect(surface.viewListenerCount).toBe(0);
  });

  it("declares the allowed origins' and the pages' migrations in the order they shipped, each new one after them", () => {
    expect(new RuntimePart().migrations.map(t => t.id)).toEqual(["create-allowed-origins", "create-pages", "add-page-agent", "drop-starred-allowed-origins"]);
  });

  it("keeps a page's record, which a later run reads, until the window forgets it", async () => {
    const context: BrowserContext = new BrowserContext(new ScriptedViews([]));
    const part: RuntimePart = new RuntimePart();
    await part.activateAsync(context);
    const instance: string = "0f8fad5b-d9cb-469f-a165-70867728950e";

    expect(await requestAsync(context, BrowserMethods.readPage, { instance })).toBeNull();
    expect(await requestAsync(context, BrowserMethods.rememberPage, { instance, profileKey: "workspace-1", url: "https://docs.example.com/pricing" })).toBeNull();
    await part.deactivateAsync();
    const later: BrowserContext = new BrowserContext(new ScriptedViews([]), context.database);
    await new RuntimePart().activateAsync(later);

    expect(await requestAsync(later, BrowserMethods.readPage, { instance })).toEqual({ instance, profileKey: "workspace-1", url: "https://docs.example.com/pricing" });
    expect(await requestAsync(later, BrowserMethods.forgetPage, { instance })).toBeNull();
    expect(await requestAsync(later, BrowserMethods.readPage, { instance })).toBeNull();
  });

  it("claims a page for one window at a time, checking and holding in one step, until that window forgets it or closes, or its connection goes, and a later run holds none", async () => {
    const context: BrowserContext = new BrowserContext(new ScriptedViews([]));
    const part: RuntimePart = new RuntimePart();
    await part.activateAsync(context);
    const instance: string = "0f8fad5b-d9cb-469f-a165-70867728950e";
    const other: string = "3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d";
    const record = { instance, profileKey: "workspace-1", url: "https://docs.example.com/" };
    const claim = (window: number, connection: number = 1, page: string = instance): Promise<JsonValue> =>
      requestAsync(context, BrowserMethods.claimPage, { instance: page }, ShellClients.mainProcess, window, connection);
    const refused = { agentName: null, isClaimed: false, isHere: false, record: null };

    await requestAsync(context, BrowserMethods.rememberPage, record, ShellClients.mainProcess, 1);
    expect([await claim(2), await claim(1, 2), await claim(1)]).toEqual([refused, refused, { agentName: null, isClaimed: true, isHere: true, record }]);
    await context.close(new ClientClosure(1, 2));
    await context.close(new ClientClosure(2, null));
    expect(await claim(2)).toEqual(refused);
    await context.close(new ClientClosure(1, 1));
    expect(await claim(2)).toEqual({ agentName: null, isClaimed: true, isHere: false, record });

    const both: readonly JsonValue[] = await Promise.all([claim(3, 1, other), claim(4, 1, other)]);
    expect(both).toEqual([{ agentName: null, isClaimed: true, isHere: false, record: null }, refused]);
    await context.close(new ClientClosure(1, null));
    expect(await claim(4, 1, other)).toEqual({ agentName: null, isClaimed: true, isHere: false, record: null });

    await part.deactivateAsync();
    const later: BrowserContext = new BrowserContext(new ScriptedViews([]), context.database);
    await new RuntimePart().activateAsync(later);
    expect(await requestAsync(later, BrowserMethods.claimPage, { instance }, ShellClients.mainProcess, 9)).toEqual({ agentName: null, isClaimed: true, isHere: false, record });
  });

  it("holds the pages a window reports open, shown or not, leaves a page another window has to it, and keeps its record from that other window", async () => {
    const context: BrowserContext = new BrowserContext(new ScriptedViews([]));
    await new RuntimePart().activateAsync(context);
    const instance: string = "0f8fad5b-d9cb-469f-a165-70867728950e";
    const other: string = "3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d";
    const from = (window: number, method: string, payload: JsonValue): Promise<JsonValue> => requestAsync(context, method, payload, ShellClients.mainProcess, window);
    const isClaimed = async (window: number, page: string = instance): Promise<JsonValue | undefined> => {
      const answer: JsonValue = await from(window, BrowserMethods.claimPage, { instance: page });
      return JsonShapes.isObject(answer) ? answer["isClaimed"] : undefined;
    };

    expect(await from(1, BrowserMethods.holdPages, { instances: [instance, other] })).toEqual({ agents: [], refused: [] });
    expect(await from(2, BrowserMethods.holdPages, { instances: [other, instance] })).toEqual({ agents: [], refused: [other, instance] });
    expect([await isClaimed(2), await isClaimed(2, other), await isClaimed(1)]).toEqual([false, false, true]);

    await from(2, BrowserMethods.rememberPage, { instance, profileKey: "workspace-2", url: "https://status.example.com/" });
    expect(await from(1, BrowserMethods.readPage, { instance })).toBeNull();
    await from(1, BrowserMethods.rememberPage, { instance, profileKey: "workspace-1", url: "https://docs.example.com/" });
    await from(2, BrowserMethods.forgetPage, { instance });
    expect([await from(1, BrowserMethods.readPage, { instance }), await isClaimed(2)])
      .toEqual([{ instance, profileKey: "workspace-1", url: "https://docs.example.com/" }, false]);

    await from(1, BrowserMethods.forgetPage, { instance });
    expect([await from(1, BrowserMethods.readPage, { instance }), await from(2, BrowserMethods.claimPage, { instance })])
      .toEqual([null, { agentName: null, isClaimed: true, isHere: false, record: null }]);
    expect(await from(1, BrowserMethods.holdPages, { instances: [] })).toEqual({ agents: [], refused: [] });
  });

  it("records on a page's record the agent whose call acts on it, and gives it with the page to a window that claims it or reports it open", async () => {
    const instance: string = "0f8fad5b-d9cb-469f-a165-70867728950e";
    const second: string = "3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d";
    const unacted: string = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
    const context: BrowserContext = new BrowserContext(pageViews(instance, second));
    await new RuntimePart().activateAsync(context);
    const record = { instance, profileKey: "workspace-1", url: "https://docs.example.com/" };
    for (const page of [instance, second, unacted])
      await requestAsync(context, BrowserMethods.rememberPage, { ...record, instance: page });

    expect(await context.tools.openSession("conversation-1", { page: instance, profileKey: "workspace-1", agentName: "Scout" }).callAsync("browser_snapshot", {}))
      .toMatchObject({ isFailure: false });
    expect(await context.tools.openSession("conversation-2", { page: second, profileKey: "workspace-1", agentName: "Helper" }).callAsync("browser_snapshot", {}))
      .toMatchObject({ isFailure: false });
    await requestAsync(context, BrowserMethods.rememberPage, { ...record, url: "https://docs.example.com/pricing" });

    expect(await requestAsync(context, BrowserMethods.claimPage, { instance }))
      .toEqual({ agentName: "Scout", isClaimed: true, isHere: true, record: { ...record, url: "https://docs.example.com/pricing" } });
    expect(await requestAsync(context, BrowserMethods.holdPages, { instances: [second, instance, unacted] }))
      .toEqual({ agents: [{ agentName: "Helper", instance: second }, { agentName: "Scout", instance }], refused: [] });
    expect(await requestAsync(context, BrowserMethods.holdPages, { instances: [instance] }, ShellClients.mainProcess, 2)).toEqual({ agents: [], refused: [instance] });
  });

  it("logs an agent it fails to record, and the call goes on", async () => {
    const instance: string = "0f8fad5b-d9cb-469f-a165-70867728950e";
    const context: BrowserContext = new BrowserContext(pageViews(instance));
    await new RuntimePart().activateAsync(context);
    context.database.failNext("run", new Error("The disk is full."));

    const result: unknown = await context.tools.openSession("conversation-1", { page: instance, profileKey: "workspace-1", agentName: "Scout" }).callAsync("browser_snapshot", {});

    expect([result, writtenTo(context.log)])
      .toEqual([expect.objectContaining({ isFailure: false }), ["The agent of a page wasn't recorded, so a window may not count it after a restart: Error: The disk is full."]]);
  });

  it("lets go of a page the asking window has, keeping its record, and leaves a page another window has to it", async () => {
    const context: BrowserContext = new BrowserContext(new ScriptedViews([]));
    await new RuntimePart().activateAsync(context);
    const instance: string = "0f8fad5b-d9cb-469f-a165-70867728950e";
    const record = { instance, profileKey: "workspace-1", url: "https://docs.example.com/" };
    const from = (window: number, method: string, payload: JsonValue): Promise<JsonValue> => requestAsync(context, method, payload, ShellClients.mainProcess, window);

    await from(1, BrowserMethods.rememberPage, record);
    expect(await from(2, BrowserMethods.letGoPage, { instance })).toBeNull();
    expect(await from(2, BrowserMethods.claimPage, { instance })).toEqual({ agentName: null, isClaimed: false, isHere: false, record: null });
    expect(await from(1, BrowserMethods.letGoPage, { instance })).toBeNull();
    expect(await from(2, BrowserMethods.claimPage, { instance })).toEqual({ agentName: null, isClaimed: true, isHere: false, record });
  });

  it("clears a workspace's browsing data", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    const context: BrowserContext = new BrowserContext(surface);
    await new RuntimePart().activateAsync(context);

    expect(await requestAsync(context, BrowserMethods.clearBrowsingData, { profileKey: "workspace-1" })).toBeNull();
    expect(surface.clearedProfiles).toEqual(["workspace-1"]);
  });

  it("refuses the page and browsing-data requests from the command line, a module's own entry or no window, and keeps or clears nothing", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    const context: BrowserContext = new BrowserContext(surface);
    await new RuntimePart().activateAsync(context);
    const instance: string = "0f8fad5b-d9cb-469f-a165-70867728950e";
    const requests: readonly (readonly [string, JsonValue])[] = [
      [BrowserMethods.rememberPage, { instance, profileKey: "workspace-1", url: "" }], [BrowserMethods.readPage, { instance }], [BrowserMethods.forgetPage, { instance }],
      [BrowserMethods.clearBrowsingData, { profileKey: "workspace-1" }], [BrowserMethods.stopPage, { instance, isTakingOver: true }], [BrowserMethods.readActivities, null],
      [BrowserMethods.claimPage, { instance }], [BrowserMethods.holdPages, { instances: [instance] }], [BrowserMethods.letGoPage, { instance }],
      [BrowserMethods.passTypedRedirect, { instance, profileKey: "workspace-1", url: "https://example.com/" }], [BrowserMethods.endTypedRedirects, { instance }],
      [BrowserMethods.readyPage, { instance }]
    ];

    for (const [method, payload] of requests) {
      for (const [client, window] of [["cli", null], ["app", 1], [ShellClients.mainProcess, null]] as const) {
        const refusal: unknown = await requestAsync(context, method, payload, client, window).catch((error: unknown) => error);
        expect(refusal, `${method} ${client}`).toBeInstanceOf(MethodFailureException);
        expect(refusal, `${method} ${client}`).toMatchObject({ failure: { code: FailureCode.Unauthorized } });
      }
    }
    expect([new DatabasePageStore(context.database).read(instance), surface.clearedProfiles]).toEqual([null, []]);
  });

  it("fails page and browsing-data requests that aren't ones", async () => {
    const context: BrowserContext = new BrowserContext(new ScriptedViews([]));
    await new RuntimePart().activateAsync(context);

    const failures: readonly (readonly [string, new (...args: never[]) => WindowRequestMalformedException])[] = [
      ...[BrowserMethods.readPage, BrowserMethods.forgetPage, BrowserMethods.claimPage, BrowserMethods.letGoPage, BrowserMethods.endTypedRedirects, BrowserMethods.readyPage]
        .map(t => [t, PageInstanceInvalidException] as const),
      ...[BrowserMethods.rememberPage, BrowserMethods.stopPage, BrowserMethods.passTypedRedirect, BrowserMethods.clearBrowsingData, BrowserMethods.holdPages]
        .map(t => [t, WindowRequestUnreadException] as const)
    ];
    for (const [method, failure] of failures)
      await expect(requestAsync(context, method, { instance: "page" }), method).rejects.toThrow(failure);
  });

  it("fails the app's name when the build has no product file", async () => {
    using product: ProductFile = new ProductFile();
    vi.spyOn(ProductInfo, "current", "get").mockImplementation(() => ProductInfo.read(product.missing));
    const context: BrowserContext = new BrowserContext(new ScriptedViews([]));
    await new RuntimePart().activateAsync(context);

    await expect(requestAsync(context, BrowserMethods.readAppName, null)).rejects.toThrow(ProductFileException);
  });

  it("gives the app's name, as its build's product file names it, to any client", async () => {
    using product: ProductFile = new ProductFile();
    vi.spyOn(ProductInfo, "current", "get").mockImplementation(() => ProductInfo.read(product.file));
    const context: BrowserContext = new BrowserContext(new ScriptedViews([]));
    await new RuntimePart().activateAsync(context);

    expect(await requestAsync(context, BrowserMethods.readAppName, null)).toBe(ProductFile.NAME);
    expect(await requestAsync(context, BrowserMethods.readAppName, null, "cli", null)).toBe(ProductFile.NAME);
  });

  it("marks as no longer controlled each view it lists as it activates or hears open, but one an agent's control holds, which it marks until the control ends", async () => {
    const surface: ScriptedViews = pageViews("page-1", "page-2");
    const marks: unknown[][] = [];
    surface.webViews.answer("setControlledAsync", (viewId, isControlled) => {
      marks.push([viewId, isControlled]);
      return Promise.resolve();
    });
    const context: BrowserContext = new BrowserContext(surface);
    await new RuntimePart().activateAsync(context);
    const session: ToolSession = context.tools.openSession("conversation-1", { page: "page-1", profileKey: "workspace-1", agentName: "Scout" });

    await session.callAsync("browser_snapshot", {});
    surface.open("view-1", "workspace-1");
    surface.open("view-3", "workspace-1");
    session.end();

    expect(marks).toEqual([["view-1", false], ["view-2", false], ["view-1", true], ["view-3", false], ["view-1", false]]);
  });

  it("gives a view that opens its workspace's origins, as the module's database keeps them", async () => {
    const surface: ScriptedViews = new ScriptedViews([]);
    await partOf().part.activateAsync(new BrowserContext(surface, await databaseWithAsync("workspace-1", ["https://kept.example"])));

    const allowed: Promise<readonly string[]> = surface.allowedAsync("view-1");
    surface.open("view-1", "workspace-1");

    expect(await allowed).toEqual(["https://kept.example"]);
  });

  it("gives the views already open when it activates their workspace's origins", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view-1", "view-2"]);
    surface.profileKeys.set("view-2", "workspace-2");
    const allowed: Promise<(readonly string[])[]> = Promise.all(["view-1", "view-2"].map(t => surface.allowedAsync(t)));
    await partOf().part.activateAsync(new BrowserContext(surface, await databaseWithAsync("workspace-2", ["https://kept.example"])));

    expect(await allowed).toEqual([[], ["https://kept.example"]]);
  });

  it("answers the window's word on a page only once the page's views have their workspace's origins, and null", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view-1", "view-2"]);
    const instance: string = "0f8fad5b-d9cb-469f-a165-70867728950e";
    surface.instances.set("view-1", instance);
    const context: BrowserContext = new BrowserContext(surface, await databaseWithAsync("workspace-1", ["https://kept.example"]));
    const given: Promise<(readonly string[])[]> = Promise.all(["view-1", "view-2"].map(t => surface.allowedAsync(t)));
    await new RuntimePart().activateAsync(context);
    await given;
    surface.allowedOrigins.clear();
    const held: (() => void)[] = [];
    const holding: PromiseWithResolvers<void> = Promise.withResolvers<void>();
    surface.allowing = () => new Promise<void>(resolve => {
      held.push(resolve);
      holding.resolve();
    });
    const answers: JsonValue[] = [];

    const answered: Promise<void> = requestAsync(context, BrowserMethods.readyPage, { instance }).then(t => void answers.push(t));
    await holding.promise;
    await new Promise<void>(resolve => setImmediate(resolve));
    const before: JsonValue[] = [...answers];
    held.forEach(t => t());
    await answered;

    expect([before, answers, Object.fromEntries(surface.allowedOrigins), writtenTo(context.log)]).toEqual([[], [null], { "view-1": ["https://kept.example"] }, []]);
  });

  it("answers null and logs the window's word on a page with no open view, giving no view origins", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    const context: BrowserContext = new BrowserContext(surface, await databaseWithAsync("workspace-1", ["https://kept.example"]));
    const given: Promise<readonly string[]> = surface.allowedAsync("view-1");
    await new RuntimePart().activateAsync(context);
    await given;
    surface.allowedOrigins.clear();

    expect(await requestAsync(context, BrowserMethods.readyPage, { instance: "7c9e6679-7425-40de-944b-e07fc1f90ae7" })).toBeNull();
    expect([Object.fromEntries(surface.allowedOrigins), writtenTo(context.log)]).toEqual([{}, [
      "The window asked for the origins of page 7c9e6679-7425-40de-944b-e07fc1f90ae7, which has no open view, so its first address may be refused."
    ]]);
  });

  it("answers Left to a typed address whose pane's page an agent's call started on while it waited, though its origin joins the workspace", async () => {
    const instance: string = "0f8fad5b-d9cb-469f-a165-70867728950e";
    const surface: ScriptedViews = pageViews(instance);
    const context: BrowserContext = new BrowserContext(surface);
    await new RuntimePart().activateAsync(context);
    const session: ToolSession = context.tools.openSession("conversation-1", { page: instance, profileKey: "workspace-1", agentName: "Scout" });
    const holding: PromiseWithResolvers<void> = Promise.withResolvers<void>();
    const held: PromiseWithResolvers<void> = Promise.withResolvers<void>();
    surface.allowing = () => {
      surface.allowing = async () => undefined;
      holding.resolve();
      return held.promise;
    };

    const answer: Promise<JsonValue> = typeAsync(context, { profileKey: "workspace-1", url: "https://one.example/", instance });
    await holding.promise;
    const called: unknown = await session.callAsync("browser_snapshot", {});
    held.resolve();

    expect([await answer, called, surface.allowedOrigins.get("view-1")]).toEqual([{ kind: "Left" }, expect.objectContaining({ isFailure: false }), ["https://one.example"]]);
  });

  it("answers a typed address as before when the agent's call starts after the answer, or on another page, or the request names no page", async () => {
    const instance: string = "0f8fad5b-d9cb-469f-a165-70867728950e";
    const other: string = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
    const surface: ScriptedViews = pageViews(instance, other);
    const context: BrowserContext = new BrowserContext(surface);
    await new RuntimePart().activateAsync(context);
    const session: ToolSession = context.tools.openSession("conversation-1", { page: other, profileKey: "workspace-1", agentName: "Scout" });
    const holding: PromiseWithResolvers<void> = Promise.withResolvers<void>();
    const held: PromiseWithResolvers<void> = Promise.withResolvers<void>();

    const first: JsonValue = await typeAsync(context, { profileKey: "workspace-1", url: "https://one.example/", instance: other });
    await session.callAsync("browser_snapshot", {});
    surface.allowing = () => {
      surface.allowing = async () => undefined;
      holding.resolve();
      return held.promise;
    };
    const answers: Promise<JsonValue[]> = Promise.all([
      typeAsync(context, { profileKey: "workspace-1", url: "https://two.example/", instance }),
      typeAsync(context, { profileKey: "workspace-1", url: "https://three.example/" })
    ]);
    await holding.promise;
    await session.callAsync("browser_snapshot", {});
    held.resolve();

    expect([first, ...await answers]).toEqual([
      { kind: "Allowed", origin: "https://one.example" }, { kind: "Allowed", origin: "https://two.example" }, { kind: "Allowed", origin: "https://three.example" }
    ]);
  });

  it("answers a typed address: its origin joins the workspace's views and the database, which a later run reads", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    const context: BrowserContext = new BrowserContext(surface);
    const part: RuntimePart = new RuntimePart();
    await part.activateAsync(context);

    expect(await typeAsync(context, { profileKey: "workspace-1", url: "https://docs.example.com/pricing" }))
      .toEqual({ kind: "Allowed", origin: "https://docs.example.com" });
    expect(surface.allowedOrigins.get("view-1")).toEqual(["https://docs.example.com"]);
    await part.deactivateAsync();

    const later: ScriptedViews = new ScriptedViews([]);
    await new RuntimePart().activateAsync(new BrowserContext(later, context.database));
    const allowed: Promise<readonly string[]> = later.allowedAsync("view-2");
    later.open("view-2", "workspace-1");

    expect(await allowed).toEqual(["https://docs.example.com"]);
  });

  it("allows the sites on this computer or network that the settings name, and once the person changes them, the new ones alone, in every open view", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    const context: BrowserContext = new BrowserContext(surface);
    context.settingValues.set("browser.localSites", "http://127.0.0.1:4173, not a site");
    await new RuntimePart().activateAsync(context);

    expect(await typeAsync(context, { profileKey: "workspace-1", url: "http://127.0.0.1:4173/form" })).toEqual({ kind: "Allowed", origin: "http://127.0.0.1:4173" });
    expect([surface.allowedOrigins.get("view-1"), await new DatabaseOriginStore(context.database).readAsync("workspace-1")]).toEqual([["http://127.0.0.1:4173"], []]);
    context.changeSetting("browser.localSites", "http://127.0.0.1:5000");

    expect(await typeAsync(context, { profileKey: "workspace-1", url: "http://127.0.0.1:5000/" })).toEqual({ kind: "Allowed", origin: "http://127.0.0.1:5000" });
    expect([surface.allowedOrigins.get("view-1"), await typeAsync(context, { profileKey: "workspace-1", url: "http://127.0.0.1:4173/form" }), writtenTo(context.log)]).toEqual([
      ["http://127.0.0.1:5000"], { kind: "Refused", reason: "Local" }, ["The sites on this computer or network ignore the entries that aren't a site's origin, at 2 in the list."]
    ]);
  });

  it("lets a page's view follow a typed address's redirect without keeping it, ends it on the window's word, and forgets it once the view closes", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view-1", "view-2"]);
    const instance: string = "0f8fad5b-d9cb-469f-a165-70867728950e";
    surface.instances.set("view-1", instance);
    const context: BrowserContext = new BrowserContext(surface);
    const create: MockInstance<typeof BrowserTools.create> = vi.spyOn(BrowserTools, "create");
    await new RuntimePart().activateAsync(context);
    const pass = (): Promise<JsonValue> => requestAsync(context, BrowserMethods.passTypedRedirect, { instance, profileKey: "workspace-1", url: "https://www.example.com/" });

    expect(await pass()).toEqual({ kind: "Allowed", origin: "https://www.example.com" });
    expect([surface.allowedOrigins.get("view-1"), surface.allowedOrigins.get("view-2"), await new DatabaseOriginStore(context.database).readAsync("workspace-1")])
      .toEqual([["https://www.example.com"], [], []]);
    expect(await requestAsync(context, BrowserMethods.endTypedRedirects, { instance })).toBeNull();
    expect(surface.allowedOrigins.get("view-1")).toEqual([]);
    await pass();
    surface.close("view-1");

    expect(kitOf(create).origins.isPassing("view-1")).toBe(false);
  });

  it("answers a typed address it refuses with the reason, and keeps nothing", async () => {
    const context: BrowserContext = new BrowserContext(new ScriptedViews(["view-1"]));
    await new RuntimePart().activateAsync(context);

    expect(await typeAsync(context, { profileKey: "workspace-1", url: "file:///etc/hosts" })).toEqual({ kind: "Refused", reason: "NotWeb" });
    expect(await new DatabaseOriginStore(context.database).readAsync("workspace-1")).toEqual([]);
  });

  it("refuses a typed address from the command line, a module's own entry or no window, and keeps nothing", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    const context: BrowserContext = new BrowserContext(surface);
    await new RuntimePart().activateAsync(context);
    const request: JsonValue = { profileKey: "workspace-1", url: "https://docs.example.com/pricing" };

    for (const [client, window] of [["cli", null], ["app", 1], [ShellClients.mainProcess, null]] as const) {
      const refusal: unknown = await typeAsync(context, request, client, window).catch((error: unknown) => error);
      expect(refusal, client).toBeInstanceOf(MethodFailureException);
      expect(refusal, client).toMatchObject({ failure: { code: FailureCode.Unauthorized } });
    }
    expect(surface.allowedOrigins.get("view-1")).toEqual([]);
    expect(await new DatabaseOriginStore(context.database).readAsync("workspace-1")).toEqual([]);
  });

  it("fails a typed-address request that isn't one", async () => {
    const context: BrowserContext = new BrowserContext(new ScriptedViews(["view-1"]));
    await new RuntimePart().activateAsync(context);

    await expect(typeAsync(context, { profileKey: "workspace-1" })).rejects.toThrow(WindowRequestUnreadException);
  });

  it("withdraws its tools when the typed-address method is already registered", async () => {
    const context: BrowserContext = new BrowserContext();
    context.registerMethod(BrowserMethods.allowTypedAddress, { handleAsync: async () => null });

    await expect(new RuntimePart().activateAsync(context)).rejects.toBeInstanceOf(MethodRegisteredException);

    expect(context.tools.openSession("conversation-1", {}).listTools()).toEqual([]);
  });

  it("ignores the view events it doesn't follow", async () => {
    const surface: ScriptedViews = new ScriptedViews([]);
    const context: BrowserContext = new BrowserContext(surface);
    await partOf().part.activateAsync(context);

    surface.emitViewEvent("view-1", WebViewEventKind.State, { address: "https://kept.example/", title: "Home", isLoading: false, canGoBack: false, canGoForward: false });
    const allowed: Promise<readonly string[]> = surface.allowedAsync("view-2");
    surface.open("view-2", "workspace-1");

    await allowed;
    expect([surface.allowedOrigins.has("view-1"), writtenTo(context.log)]).toEqual([false, []]);
  });

  it("logs the settings' new sites it couldn't give the open views", async () => {
    const context: BrowserContext = new BrowserContext(new ScriptedViews(["view-1"]));
    context.database.run("DROP TABLE allowed_origins");
    await partOf().part.activateAsync(context);

    const written: Promise<readonly string[]> = linesAsync(context.log, 2);
    context.changeSetting("browser.localSites", "http://127.0.0.1:4173");

    expect(await written).toEqual([
      "The allowed origins of view view-1 weren't applied: Error: no such table: allowed_origins", "The sites on this computer or network weren't given to every open page: Error: no such table: allowed_origins"
    ]);
  });

  it("logs origins it couldn't give a view", async () => {
    const surface: ScriptedViews = new ScriptedViews([]);
    const context: BrowserContext = new BrowserContext(surface);
    await partOf().part.activateAsync(context);
    context.database.run("DROP TABLE allowed_origins");

    const written: Promise<readonly string[]> = linesAsync(context.log, 1);
    surface.open("view-1", "workspace-1");

    expect(await written).toEqual(["The allowed origins of view view-1 weren't applied: Error: no such table: allowed_origins"]);
    expect(surface.allowedOrigins.size).toBe(0);
  });

  it("forgets a closed view's references and cursors, and only the references of a view that crashed or lost its profile", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    const { part, states } = partOf();
    await part.activateAsync(new BrowserContext(surface));
    for (const kind of [WebViewEventKind.Crashed, WebViewEventKind.ProfileCleared]) {
      const id: string = states().issueReference("one", REFERENCE);
      states().writeCursor("one", "view-1", 5);

      surface.emitViewEvent("view-1", kind, kind === WebViewEventKind.ProfileCleared ? { profileKey: "workspace-1" } : {});

      expect(() => states().resolveReference("one", id, "view-1", "document"), kind).toThrow(StaleReferenceException);
      expect(states().readCursor("one", "view-1"), kind).toBe(5);
    }
    const id: string = states().issueReference("one", REFERENCE);

    surface.emitViewEvent("view-1", WebViewEventKind.Closed);

    expect(() => states().resolveReference("one", id, "view-1", "document")).toThrow(StaleReferenceException);
    expect(states().readCursor("one", "view-1")).toBe(0);
  });

  it("drops a closed view's Runtime tracker and console ring and stops hearing the view, and keeps another view's", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view-1", "view-2"]);
    surface.acknowledge(...ScriptedViews.emptyReplies);
    const create: MockInstance<typeof BrowserTools.create> = vi.spyOn(BrowserTools, "create");
    await new RuntimePart().activateAsync(new BrowserContext(surface));
    const kept: { consoles: ConsoleBuffers | null; domains: RuntimeDomains | null } = { consoles: kitOf(create).consoles, domains: kitOf(create).domains };
    const before: number = surface.protocolListenerCount;
    await kept.domains?.startAsync("view-1", "https://shop.test", t => surface.relay.sendAsync("view-1", t, {}, 1_000));
    kept.consoles?.start("view-2", "https://shop.test");
    surface.emitProtocolEvent("view-1", "Runtime.consoleAPICalled", { type: "log", args: [{ type: "string", value: "Cart loaded" }], timestamp: 0 });

    surface.emitViewEvent("view-1", WebViewEventKind.Closed);
    const listening: number = surface.protocolListenerCount - before;
    kept.consoles?.start("view-1", "https://shop.test");

    expect([listening, kept.consoles?.read("view-1", 0).next]).toEqual([1, 0]);
  });

  it("drops the Runtime tracker of a view that crashed, keeping its ring's entries, so its next use starts the new debugging session's Runtime again", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    surface.acknowledge(...ScriptedViews.emptyReplies);
    const create: MockInstance<typeof BrowserTools.create> = vi.spyOn(BrowserTools, "create");
    await new RuntimePart().activateAsync(new BrowserContext(surface));
    const kept: { domains: RuntimeDomains | null } = { domains: kitOf(create).domains };
    await kept.domains?.startAsync("view-1", "https://shop.test", t => surface.relay.sendAsync("view-1", t, {}, 1_000));
    surface.emitProtocolEvent("view-1", "Runtime.consoleAPICalled", { type: "log", args: [{ type: "string", value: "Cart loaded" }], timestamp: 0 });

    surface.emitViewEvent("view-1", WebViewEventKind.Crashed);
    await kept.domains?.startAsync("view-1", "https://shop.test", t => surface.relay.sendAsync("view-1", t, {}, 1_000));

    expect([kept.domains?.consoles.read("view-1", 0).entries.map(t => t.text), surface.calls.filter(t => t.method === "Runtime.enable").length])
      .toEqual([["Cart loaded"], 2]);
  });

  it("stops following the views when it deactivates, and deactivating again or first does nothing", async () => {
    const surface: ScriptedViews = new ScriptedViews(["view-1"]);
    const { part, states } = partOf();
    await expect(part.deactivateAsync()).resolves.toBeUndefined();
    await part.activateAsync(new BrowserContext(surface));
    states().writeCursor("one", "view-1", 5);

    await part.deactivateAsync();
    await part.deactivateAsync();
    surface.emitViewEvent("view-1", WebViewEventKind.Closed);

    expect([surface.viewListenerCount, states().readCursor("one", "view-1")]).toEqual([0, 5]);
  });
});
