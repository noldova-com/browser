/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonValue } from "@noldova/context.json";
import { BrowserEvents, BrowserMethods } from "@noldova/browser.protocol";
import type { WebViewNavigation } from "@noldova/desktop.protocol";
import { DocumentTone } from "@noldova/desktop.window";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AddressRefusal } from "../../../src/app/enums/address-refusal.ts";
import { EntryAnswer } from "../../../src/app/enums/entry-answer.ts";
import { PaneState } from "../../../src/app/enums/pane-state.ts";
import { RefusedRequest } from "../../../src/app/enums/refused-request.ts";
import { LinkRefusedException } from "../../../src/app/exceptions/link-refused.exception.ts";
import { PageClaimAnswerMalformedException } from "../../../src/app/exceptions/page-claim-answer-malformed.exception.ts";
import { PageInAnotherWindowException } from "../../../src/app/exceptions/page-in-another-window.exception.ts";
import { PageOnOtherWorkspaceException } from "../../../src/app/exceptions/page-on-other-workspace.exception.ts";
import { PageRecordAnswerMalformedException } from "../../../src/app/exceptions/page-record-answer-malformed.exception.ts";
import { PagesInactiveException } from "../../../src/app/exceptions/pages-inactive.exception.ts";
import { TypedAddressAnswerMalformedException } from "../../../src/app/exceptions/typed-address-answer-malformed.exception.ts";
import { PaneStatus } from "../../../src/app/models/pane-status.ts";
import type { PaneTab } from "../../../src/app/models/pane-tab.ts";
import { PopupOffer } from "../../../src/app/models/popup-offer.ts";
import { RefusedPage } from "../../../src/app/models/refused-page.ts";
import { ViewCrashEvent } from "../../../src/app/models/view-crash-event.ts";
import { ViewLoadFailureEvent } from "../../../src/app/models/view-load-failure-event.ts";
import { ViewNewWindowEvent } from "../../../src/app/models/view-new-window-event.ts";
import { ViewRefusalEvent } from "../../../src/app/models/view-refusal-event.ts";
import { ViewStateEvent } from "../../../src/app/models/view-state-event.ts";
import { PageAnswers } from "../../../src/app/services/page-answers.ts";
import { Pages } from "../../../src/app/services/pages.ts";
import { FakeWebView, type FakeWebViews, WebViewValues } from "../../fixtures/fake-web-views.fixture.ts";
import { WindowContext } from "../../fixtures/window-context.fixture.ts";

describe("Pages", () => {
  const UUID: RegExp = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
  let context: WindowContext;
  let pages: Pages;
  let declared: WindowContext["answerRequest"];

  function surface(): FakeWebViews {
    return context.views;
  }

  function viewOf(tab: PaneTab): FakeWebView {
    if (!(tab.view instanceof FakeWebView))
      throw new Error("The tab has no fake view.");
    return tab.view;
  }

  function lastOpened(): string {
    const opened = context.opened.at(-1);
    if (opened === undefined)
      throw new Error("No page document opened.");
    return opened.instance;
  }

  async function openAsync(url: string | null = null, profileKey: string = "workspace-1"): Promise<PaneTab> {
    pages.open(profileKey, url);
    const tab: PaneTab | null = await pages.showAsync(lastOpened());
    if (tab === null)
      throw new Error("The page didn't show.");
    place(tab);
    return tab;
  }

  function place(tab: PaneTab | null): void {
    if (tab === null || tab.view === null)
      return;
    const view: FakeWebView = viewOf(tab);
    view.mount(document.createElement("div"));
    view.calls.splice(view.calls.indexOf("mount"), 1);
  }

  function urlOf(parameters: JsonValue): string {
    return PageAnswers.isObject(parameters) ? String(parameters["url"]) : "";
  }

  function requestsOf(method: string): JsonValue[] {
    return context.requests.filter(t => t.method === method).map(t => t.parameters);
  }

  function underlines(): [string, string | null | undefined][] {
    return context.titles.filter(t => t.update.underline !== undefined).map(t => [t.instance, t.update.underline]);
  }

  function agentPagesText(): string | undefined {
    return context.statusBarItems[0]?.state().text;
  }

  function loading(view: FakeWebView, address: string, isLoading: boolean, title: string = ""): void {
    view.emit(new ViewStateEvent(address, title, isLoading, false, false));
  }

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    context = new WindowContext();
    declared = context.answerRequest;
    pages = new Pages(context);
  });

  it("is the pages of its context until the part deactivates, and no other context has any", () => {
    expect(Pages.of(context)).toBe(pages);
    expect(() => Pages.of(new WindowContext())).toThrow(PagesInactiveException);

    pages.close();

    expect(() => Pages.of(context)).toThrow(PagesInactiveException);
  });

  it("asks the runtime part for the app's name once, as it starts, for the notices", async () => {
    await vi.waitFor(() => expect(pages.appName()).toBe(WindowContext.appName));

    expect([requestsOf(BrowserMethods.readAppName), context.logs]).toEqual([[null], []]);
  });

  it("names no app, and logs the failure's kind, when the runtime part can't give the app's name or gives one that isn't a name", async () => {
    const failing: WindowContext = new WindowContext();
    failing.answerRequest = () => Promise.reject(new TypeError("No product file."));
    const blank: WindowContext = new WindowContext();
    blank.answerRequest = () => Promise.resolve(" ");
    const numbered: WindowContext = new WindowContext();
    numbered.answerRequest = () => Promise.resolve(7);

    const named: readonly Pages[] = [new Pages(failing), new Pages(blank), new Pages(numbered)];

    const malformed: string[] = ["The app's name wasn't read, so notices name no app: AppNameAnswerMalformedException."];
    await vi.waitFor(() => expect([failing.logs, blank.logs, numbered.logs]).toEqual([["The app's name wasn't read, so notices name no app: TypeError."], malformed, malformed]));
    expect(named.map(t => t.appName())).toEqual([null, null, null]);
  });

  it("follows what agents do on each page by its instance until each activity ends, never underlines its tab, and leaves an end of another activity alone", () => {
    const acting: JsonObject = { instance: "page-1", activity: "call-1", agentName: "Scout", action: "Clicking", state: "Acting", box: null, point: null, refusal: null, isHandedOver: false };
    context.emit(BrowserEvents.pageActivity, acting);
    context.emit(BrowserEvents.pageActivity, { ...acting, instance: "page-2", activity: "call-2" });
    context.emit(BrowserEvents.pageActivity, { ...acting, state: "Asking" });
    context.emit(BrowserEvents.pageActivity, { ...acting, activity: "call-0", state: "Ended" });

    expect([...pages.activities().entries()].map(t => [t[0], t[1].activity, t[1].state])).toEqual([["page-1", "call-1", "Asking"], ["page-2", "call-2", "Acting"]]);

    context.emit(BrowserEvents.pageActivity, { ...acting, state: "Ended" });
    context.emit(BrowserEvents.pageActivity, { ...acting, instance: "page-3", activity: "call-3", state: "Ended" });

    expect([...pages.activities().keys()]).toEqual(["page-2"]);
    expect(underlines()).toEqual([]);
  });

  it("keeps an agent's control of a page between its calls, until the control ends", () => {
    const control: JsonObject = { instance: "page-1", activity: "control-1", agentName: "Scout", action: "Reading", state: "Acting", box: null, point: null, refusal: null, isHandedOver: false };
    context.emit(BrowserEvents.pageActivity, control);
    context.emit(BrowserEvents.pageActivity, { ...control, state: "Idle" });
    const resting: unknown[] = [...pages.activities().values()].map(t => [t.activity, t.state]);
    context.emit(BrowserEvents.pageActivity, { ...control, state: "Ended" });

    expect([resting, pages.activities().size]).toEqual([[["control-1", "Idle"]], 0]);
  });

  it("opens a page's document with no underline when a teammate's call on it already runs, and adds none to one already open", async () => {
    const picked: string = "3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d";
    const opening = vi.spyOn(context, "openDocument");
    context.emit(BrowserEvents.pageActivity, { instance: picked, activity: "call-1", agentName: " ", action: "Clicking", state: "Acting", box: null, point: null, refusal: null,
      isHandedOver: false });

    pages.open("workspace-1", null, picked);
    await pages.showAsync(picked);
    pages.open("workspace-1", null, picked);

    expect([opening.mock.calls, underlines()]).toEqual([[["browser.page", picked, "New tab", {}], ["browser.page", picked, "New tab"]], []]);
  });

  it("logs an activity event that isn't one, without its payload, and changes no page", () => {
    const acting: JsonObject = { instance: "page-1", activity: "call-1", agentName: "Scout", action: "Clicking", state: "Acting", box: null, point: null, refusal: null, isHandedOver: false };
    context.emit(BrowserEvents.pageActivity, acting);

    context.emit(BrowserEvents.pageActivity, { ...acting, state: "dragging" });

    expect([[...pages.activities().values()].map(t => t.state), context.logs])
      .toEqual([["Acting"], ["A teammate's call on a page wasn't shown: PageActivityEventMalformedException."]]);
  });

  it("passes on an error reading an activity event that isn't the event's own malformation, and logs nothing", () => {
    const failure: TypeError = new TypeError("Cannot read properties of undefined");
    vi.spyOn(PageAnswers, "readActivity").mockImplementation(() => {
      throw failure;
    });

    const emitting = (): void => context.emit(BrowserEvents.pageActivity, { instance: "page-1" });

    expect(emitting).toThrow(failure);
    expect([pages.activities().size, context.logs]).toEqual([0, []]);
  });

  it("brings a page this window shows forward when its call ends handed over to the person, and no page for any other event", async () => {
    const tab: PaneTab = await openAsync("https://shop.example.com/");
    loading(viewOf(tab), "https://shop.example.com/login", false, "Sign in");
    const before: number = context.opened.length;
    const typing: JsonObject = { instance: tab.id, activity: "call-1", agentName: "Scout", action: "Typing", state: "Acting", box: null, point: null, refusal: null, isHandedOver: true };

    context.emit(BrowserEvents.pageActivity, typing);
    context.emit(BrowserEvents.pageActivity, { ...typing, instance: "page-elsewhere", activity: "call-2", state: "Ended" });
    context.emit(BrowserEvents.pageActivity, { ...typing, activity: "call-0", state: "Ended", isHandedOver: false });
    context.emit(BrowserEvents.pageActivity, { ...typing, state: "Ended" });

    expect(context.opened.slice(before).map(t => [t.name, t.instance, t.title])).toEqual([["browser.page", tab.id, "Sign in"]]);
  });

  it("reads the calls running on the pages again when the runtime starts again, with the events that arrive meanwhile over them", async () => {
    const acting: JsonObject = { instance: "page-1", activity: "call-1", agentName: "Scout", action: "Clicking", state: "Acting", box: null, point: null, refusal: null, isHandedOver: false };
    context.emit(BrowserEvents.pageActivity, acting);
    const answer: PromiseWithResolvers<JsonValue> = Promise.withResolvers<JsonValue>();
    context.answerRequest = (method, parameters) => method === BrowserMethods.readActivities ? answer.promise : declared(method, parameters);

    const reading: Promise<boolean> = pages.readActivitiesAsync();
    context.emit(BrowserEvents.pageActivity, { ...acting, instance: "page-2", activity: "call-5" });
    context.emit(BrowserEvents.pageActivity, { ...acting, instance: "page-3", activity: "call-7", state: "Ended" });
    answer.resolve([{ ...acting, instance: "page-3", activity: "call-7" }, { ...acting, instance: "page-4", activity: "call-8", state: "Asking" }]);
    const isRead: boolean = await reading;

    expect(isRead).toBe(true);
    expect([...pages.activities().entries()].map(t => [t[0], t[1].activity, t[1].state])).toEqual([["page-4", "call-8", "Asking"], ["page-2", "call-5", "Acting"]]);
    expect(underlines()).toEqual([]);
    expect(context.requests.filter(t => t.method === BrowserMethods.readActivities)).toEqual([{ method: BrowserMethods.readActivities, parameters: null }]);
  });

  it("shows only the calls that start after the runtime started again when it can't read them, or reads no array, and says so", async () => {
    const acting: JsonObject = { instance: "page-1", activity: "call-1", agentName: "Scout", action: "Clicking", state: "Acting", box: null, point: null, refusal: null, isHandedOver: false };
    context.emit(BrowserEvents.pageActivity, acting);
    context.answerRequest = (method, parameters) => method === BrowserMethods.readActivities ? Promise.reject(new TypeError("Disconnected.")) : declared(method, parameters);

    const reading: Promise<boolean> = pages.readActivitiesAsync();
    context.emit(BrowserEvents.pageActivity, { ...acting, instance: "page-2", activity: "call-2" });
    const isRead: boolean = await reading;

    expect([isRead, [...pages.activities().keys()], context.logs.at(-1)]).toEqual([false, ["page-2"],
      "The teammates' calls on the pages weren't read again after the runtime started, so the pages show only the calls that start now: TypeError."]);
    context.answerRequest = () => Promise.resolve({ activities: [acting] });
    await pages.readActivitiesAsync();
    context.answerRequest = () => Promise.resolve([acting, { instance: "page-5" }]);
    await pages.readActivitiesAsync();

    expect([pages.activities().size, context.logs.slice(-2)]).toEqual([0, [
      "The teammates' calls on the pages weren't read again after the runtime started, so the pages show only the calls that start now: PageActivitiesAnswerMalformedException.",
      "The teammates' calls on the pages weren't read again after the runtime started, so the pages show only the calls that start now: PageActivitiesAnswerMalformedException."
    ]]);
  });

  it("counts each agent's pages open here in the status bar, from the reported tabs, the claims and the activities, and drops a closed or yielded tab's", async () => {
    const restored: string = "0f8fad5b-d9cb-469f-a165-70867728950e";
    const other: string = "3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d";
    const picked: string = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
    const acting: JsonObject = { instance: other, activity: "call-1", agentName: "Scout", action: "Clicking", state: "Acting", box: null, point: null, refusal: null, isHandedOver: false };
    context.openDocuments = [restored, other];
    context.answerRequest = (method, parameters) => method === BrowserMethods.holdPages ? Promise.resolve({ agents: [{ agentName: "Helper", instance: restored }], refused: [other] })
      : method === BrowserMethods.claimPage ? Promise.resolve({ agentName: "Scout", isClaimed: true, isHere: false, record: null })
        : method === BrowserMethods.readActivities ? Promise.resolve([{ ...acting, agentName: "Helper", instance: picked }]) : declared(method, parameters);

    await pages.reportOpenAsync();
    const reported: string | undefined = agentPagesText();
    await pages.openAsync("workspace-1", null, picked);
    const claimed: string | undefined = agentPagesText();
    const tab: PaneTab = await openAsync();
    context.emit(BrowserEvents.pageActivity, acting);
    context.emit(BrowserEvents.pageActivity, { ...acting, instance: tab.id });
    const acted: string | undefined = agentPagesText();
    context.closeByPerson(restored);
    await pages.readActivitiesAsync();

    expect([reported, claimed, acted, agentPagesText()]).toEqual(["Helper · 1 page open", "Helper · 1 page open, Scout · 1 page open",
      "Helper · 1 page open, Scout · 2 pages open", "Helper · 1 page open, Scout · 1 page open"]);
  });

  it("counts a restored tab's page for the agent its claim names as the tab shows", async () => {
    const restored: string = "0f8fad5b-d9cb-469f-a165-70867728950e";
    context.answerRequest = (method, parameters) => method === BrowserMethods.claimPage
      ? Promise.resolve({ agentName: "Scout", isClaimed: true, isHere: false, record: { instance: restored, profileKey: "workspace-1", url: "" } }) : declared(method, parameters);

    const tab: PaneTab | null = await pages.showAsync(restored);

    expect([tab?.id, agentPagesText()]).toEqual([restored, "Scout · 1 page open"]);
  });

  it("keeps the address a navigation ended without because the person denied its site, until they answer, and drops it as the page loads", async () => {
    const tab = await openAsync();
    const view: FakeWebView = viewOf(tab);
    const refusal: JsonObject = { url: "https://docs.example.com/pricing", origin: "https://docs.example.com" };
    const refused: RefusedPage = new RefusedPage("Scout", "https://docs.example.com/pricing", "https://docs.example.com");
    const navigating: JsonObject = { instance: tab.id, activity: "call-1", agentName: "Scout", action: "Navigating", state: "Acting", box: null, point: null, refusal: null, isHandedOver: false };
    context.emit(BrowserEvents.pageActivity, navigating);
    context.emit(BrowserEvents.pageActivity, { ...navigating, state: "Ended", refusal });

    expect([...pages.refusals().entries()]).toStrictEqual([[tab.id, refused]]);
    pages.dismissRefusal(tab.id);
    pages.dismissRefusal(tab.id);
    expect(pages.refusals().size).toBe(0);

    context.emit(BrowserEvents.pageActivity, { ...navigating, activity: "call-2" });
    context.emit(BrowserEvents.pageActivity, { ...navigating, activity: "call-2", state: "Ended", refusal });
    loading(view, "https://docs.example.com/", true);
    expect(pages.refusals().size).toBe(0);
  });

  it("ends a page's own refused navigation's hold for a teammate's navigation, so its reload ends loading and then shows loaded", async () => {
    const tab = await openAsync();
    const view: FakeWebView = viewOf(tab);
    loading(view, "https://docs.example.com/", true);
    loading(view, "https://docs.example.com/", false, "Docs");
    view.emit(new ViewRefusalEvent("http://127.0.0.1:8080/away", "http://127.0.0.1:8080", false));
    const navigating: JsonObject = { instance: tab.id, activity: "call-1", agentName: "Scout", action: "Navigating", state: "Acting", box: null, point: null, refusal: null, isHandedOver: false };
    context.emit(BrowserEvents.pageActivity, { ...navigating, instance: "page-elsewhere" });
    context.emit(BrowserEvents.pageActivity, { ...navigating, state: "Asking" });
    context.emit(BrowserEvents.pageActivity, { ...navigating, action: "Reading" });
    expect([tab.controller.status.state, tab.controller.status.refusedOrigin]).toEqual([PaneState.Refused, "http://127.0.0.1:8080"]);

    context.emit(BrowserEvents.pageActivity, navigating);
    loading(view, "https://docs.example.com/", true);
    const reloading: string = tab.controller.status.state;
    loading(view, "https://docs.example.com/", false, "Docs");

    expect([reloading, tab.controller.status.state, tab.controller.status.refusedOrigin]).toEqual([PaneState.Loading, PaneState.Loaded, null]);
  });

  it("forgets the refused navigations once the part deactivates", () => {
    const navigating: JsonObject = { instance: "page-1", activity: "call-1", agentName: "Scout", action: "Navigating", state: "Acting", box: null, point: null, refusal: null, isHandedOver: false };
    context.emit(BrowserEvents.pageActivity, navigating);
    context.emit(BrowserEvents.pageActivity, { ...navigating, state: "Ended", refusal: { url: "https://docs.example.com/", origin: "https://docs.example.com" } });

    pages.close();

    expect(pages.refusals().size).toBe(0);
  });

  it("stops following activities once the part deactivates, and shows none", () => {
    context.emit(BrowserEvents.pageActivity, { instance: "page-1", activity: "call-1", agentName: "Scout", action: "Typing", state: "Acting", box: null, point: null, refusal: null, isHandedOver: false });

    pages.close();
    context.emit(BrowserEvents.pageActivity, { instance: "page-2", activity: "call-2", agentName: "Scout", action: "Typing", state: "Acting", box: null, point: null, refusal: null, isHandedOver: false });

    expect([pages.activities().size, context.listenersOf(BrowserEvents.pageActivity)]).toEqual([0, 0]);
  });

  it("opens each page as a document of its own, titled by its address or as a new tab", () => {
    const first: string = pages.open("workspace-1", "https://docs.example.com/pricing");
    const second: string = pages.open("workspace-2", null);

    expect(context.opened).toEqual([
      { name: "browser.page", instance: first, title: "https://docs.example.com/pricing", after: null, marker: null },
      { name: "browser.page", instance: second, title: "New tab", after: null, marker: null }
    ]);
    expect([UUID.test(first), UUID.test(second), first === second]).toEqual([true, true, false]);
  });

  it("opens a page with the instance the app picked, and brings that page forward as it is when it opens again", async () => {
    const picked: string = "3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d";

    expect(pages.open("workspace-1", null, picked)).toBe(picked);
    expect(pages.open("workspace-1", "https://docs.example.com/", picked)).toBe(picked);
    const tab: PaneTab | null = await pages.showAsync(picked);
    if (tab === null)
      throw new Error("The picked page didn't show.");
    loading(viewOf(tab), "https://docs.example.com/guide", false, "Guide");
    expect(pages.open("workspace-1", "https://other.example.com/", picked)).toBe(picked);

    expect(context.opened.map(t => [t.instance, t.title])).toEqual([[picked, "New tab"], [picked, "New tab"], [picked, "Guide"]]);
    expect(tab.controller.status.url).toBe("https://docs.example.com/guide");
  });

  it("refuses to open a picked instance that is already opening or open on another workspace, and opens nothing", async () => {
    const picked: string = "3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d";
    pages.open("workspace-1", "https://docs.example.com/", picked);
    expect(() => pages.open("workspace-2", null, picked)).toThrow(PageOnOtherWorkspaceException);
    pages.open("workspace-1", null, picked);
    await pages.showAsync(picked);

    expect(() => pages.open("workspace-2", null, picked)).toThrow(PageOnOtherWorkspaceException);
    expect(context.opened.map(t => t.title)).toEqual(["https://docs.example.com/", "https://docs.example.com/"]);
  });

  it("refuses the app's instance when this window doesn't hold it and the runtime part's claim says another window has it, shown or not", async () => {
    const picked: string = "3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d";
    context.answerRequest = (method, parameters) => method === BrowserMethods.claimPage ? Promise.resolve({ agentName: null, isClaimed: false, isHere: false, record: null }) : declared(method, parameters);

    await expect(pages.openAsync("workspace-1", null, picked)).rejects.toThrow(PageInAnotherWindowException);
    expect([context.opened, requestsOf(BrowserMethods.claimPage)]).toEqual([[], [{ instance: picked }]]);
  });

  it("opens the app's instance whose record outlived its tab, as a page open at quit that no window restored, at its kept address", async () => {
    const picked: string = "3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d";
    context.answerRequest = (method, parameters) => method === BrowserMethods.claimPage
      ? Promise.resolve({ agentName: null, isClaimed: true, isHere: false, record: { instance: picked, profileKey: "workspace-1", url: "https://docs.example.com/pricing" } }) : declared(method, parameters);

    expect(await pages.openAsync("workspace-1", null, picked)).toBe(picked);
    const tab = await pages.showAsync(picked);
    place(tab);

    expect([context.opened.map(t => [t.instance, t.title]), requestsOf(BrowserMethods.claimPage), requestsOf(BrowserMethods.readPage)])
      .toEqual([[[picked, "https://docs.example.com/pricing"]], [{ instance: picked }], []]);
    expect([tab?.id, tab === null ? null : viewOf(tab).profileKey]).toEqual([picked, "workspace-1"]);
    await vi.waitFor(() => expect(tab === null ? null : viewOf(tab).calls).toEqual(["navigate https://docs.example.com/pricing"]));
  });

  it("opens a kept page no window has at the address or on the workspace the app asks for, not where its record was", async () => {
    const first: string = "3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d";
    const second: string = "0f8fad5b-d9cb-469f-a165-70867728950e";
    context.answerRequest = (method, params) => method === BrowserMethods.claimPage
      ? Promise.resolve({ agentName: null, isClaimed: true, isHere: false, record: { instance: (params as { readonly instance: string }).instance, profileKey: "workspace-1", url: "https://docs.example.com/pricing" } })
      : declared(method, params);

    await pages.openAsync("workspace-1", "https://status.example.com/", first);
    await pages.openAsync("workspace-2", null, second);
    const tabs = [await pages.showAsync(first), await pages.showAsync(second)];
    tabs.forEach(place);

    expect(context.opened.map(t => t.title)).toEqual(["https://status.example.com/", "New tab"]);
    expect(tabs.map(t => t === null ? null : viewOf(t).profileKey)).toEqual(["workspace-1", "workspace-2"]);
    await vi.waitFor(() => expect(tabs.map(t => t === null ? null : viewOf(t).calls)).toEqual([["navigate https://status.example.com/"], []]));
  });

  it("brings forward a page this window restored but hasn't shown, on its own workspace, and refuses it on another", async () => {
    const [kept, plain]: readonly [string, string] = ["3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d", "0f8fad5b-d9cb-469f-a165-70867728950e"];
    context.answerRequest = (method, params) => method !== BrowserMethods.claimPage ? declared(method, params) : Promise.resolve((params as { readonly instance: string }).instance === kept
      ? { agentName: null, isClaimed: true, isHere: true, record: { instance: kept, profileKey: "workspace-1", url: "https://docs.example.com/pricing" } }
      : { agentName: null, isClaimed: true, isHere: true, record: null });

    await expect(pages.openAsync("workspace-2", null, kept)).rejects.toThrow(PageOnOtherWorkspaceException);
    expect(await pages.openAsync("workspace-1", null, kept)).toBe(kept);
    expect(await pages.openAsync("workspace-2", null, plain)).toBe(plain);

    expect(context.opened.map(t => [t.instance, t.title])).toEqual([[kept, "https://docs.example.com/pricing"], [plain, "New tab"]]);
  });

  it("opens a kept page that never went anywhere as a new tab, restored here but not shown or restored nowhere", async () => {
    const [here, nowhere]: readonly [string, string] = ["3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d", "0f8fad5b-d9cb-469f-a165-70867728950e"];
    context.answerRequest = (method, params) => {
      if (method !== BrowserMethods.claimPage)
        return declared(method, params);
      const instance: string = (params as { readonly instance: string }).instance;
      return Promise.resolve({ agentName: null, isClaimed: true, isHere: instance === here, record: { instance, profileKey: "workspace-1", url: "" } });
    };

    expect([await pages.openAsync("workspace-1", null, here), await pages.openAsync("workspace-1", null, nowhere)]).toEqual([here, nowhere]);
    const tab = await pages.showAsync(nowhere);

    expect(context.opened.map(t => [t.instance, t.title])).toEqual([[here, "New tab"], [nowhere, "New tab"]]);
    expect([tab === null ? null : viewOf(tab).calls, tab?.controller.status, requestsOf(BrowserMethods.letGoPage)]).toEqual([[], PaneStatus.empty, []]);
  });

  it("lets go of a page it claimed when Noldova Desktop refuses to open it, and keeps a page this window restored", async () => {
    const [nowhere, here]: readonly [string, string] = ["3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d", "0f8fad5b-d9cb-469f-a165-70867728950e"];
    const refusal: Error = new Error("The title is blank.");
    context.answerRequest = (method, params) => method === BrowserMethods.letGoPage ? Promise.reject(new TypeError("The runtime part went away."))
      : method === BrowserMethods.claimPage ? Promise.resolve({ agentName: null, isClaimed: true, isHere: (params as { readonly instance: string }).instance === here, record: null }) : declared(method, params);
    vi.spyOn(context, "openDocument").mockImplementation(() => {
      throw refusal;
    });

    await expect(pages.openAsync("workspace-1", null, nowhere)).rejects.toThrow(refusal);
    await expect(pages.openAsync("workspace-1", null, here)).rejects.toThrow(refusal);

    expect(requestsOf(BrowserMethods.letGoPage)).toEqual([{ instance: nowhere }]);
    await vi.waitFor(() => expect(context.logs).toEqual([
      "A page the window claimed wasn't let go, so another window may not open it until this window closes: TypeError."
    ]));
  });

  it("lets go of a page it claimed, and opens nothing, when the part deactivates while the runtime part answers the claim", async () => {
    const [nowhere, here]: readonly [string, string] = ["3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d", "0f8fad5b-d9cb-469f-a165-70867728950e"];
    const claims: PromiseWithResolvers<JsonValue>[] = [Promise.withResolvers<JsonValue>(), Promise.withResolvers<JsonValue>()];
    let asked: number = 0;
    context.answerRequest = (method, parameters) => method === BrowserMethods.claimPage ? claims[asked++]?.promise ?? declared(method, parameters) : declared(method, parameters);
    const opening: readonly Promise<string>[] = [pages.openAsync("workspace-1", null, nowhere), pages.openAsync("workspace-1", null, here)];

    pages.close();
    claims[0]?.resolve({ agentName: null, isClaimed: true, isHere: false, record: null });
    claims[1]?.resolve({ agentName: null, isClaimed: true, isHere: true, record: null });

    await expect(opening[0]).rejects.toThrow(PagesInactiveException);
    await expect(opening[1]).rejects.toThrow(PagesInactiveException);
    expect([context.opened, requestsOf(BrowserMethods.letGoPage)]).toEqual([[], [{ instance: nowhere }]]);
  });

  it("opens no view for a restored tab whose page another window claimed before this window reported its tabs, and claims it again on an open", async () => {
    const [claimed, gone]: readonly [string, string] = ["3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d", "0f8fad5b-d9cb-469f-a165-70867728950e"];
    context.answerRequest = (method, params) => method === BrowserMethods.claimPage
      ? Promise.resolve({ agentName: null, isClaimed: false, isHere: false, record: null })
      : method === BrowserMethods.readPage && (params as { readonly instance: string }).instance === claimed
        ? Promise.resolve({ instance: claimed, profileKey: "workspace-1", url: "https://docs.example.com/" }) : declared(method, params);

    expect([await pages.showAsync(claimed), await pages.showAsync(gone)]).toEqual([null, null]);
    expect([[...pages.elsewhere()], surface().views, requestsOf(BrowserMethods.rememberPage)]).toEqual([[claimed], [], []]);
    await expect(pages.openAsync("workspace-1", null, claimed)).rejects.toThrow(PageInAnotherWindowException);
    expect([requestsOf(BrowserMethods.claimPage), context.opened, [...pages.elsewhere()]]).toEqual([[{ instance: claimed }, { instance: gone }, { instance: claimed }], [], [claimed]]);
  });

  it("gives a tab whose page another window had a view once this window claims the page on an open", async () => {
    const instance: string = "3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d";
    const record = { instance, profileKey: "workspace-1", url: "https://docs.example.com/" };
    let isFree: boolean = false;
    context.answerRequest = (method, parameters) => method === BrowserMethods.claimPage
      ? Promise.resolve({ agentName: null, isClaimed: isFree, isHere: false, record: isFree ? record : null })
      : method === BrowserMethods.readPage ? Promise.resolve(record) : declared(method, parameters);
    await pages.showAsync(instance);

    isFree = true;
    expect(await pages.openAsync("workspace-1", null, instance)).toBe(instance);
    const tab = await pages.showAsync(instance);
    place(tab);

    expect([[...pages.elsewhere()], context.opened.map(t => [t.instance, t.title]), tab === null ? null : viewOf(tab).profileKey])
      .toEqual([[], [[instance, "https://docs.example.com/"]], "workspace-1"]);
    await vi.waitFor(() => expect(tab === null ? null : viewOf(tab).calls).toEqual(["navigate https://docs.example.com/"]));
  });

  it("closes the view of a shown tab, and drops a tab yet to show, whose page another window claimed while the runtime started again", async () => {
    const shown: PaneTab = await openAsync("https://docs.example.com/");
    const kept: PaneTab = await openAsync("https://status.example.com/");
    const waiting: string = pages.open("workspace-1", "https://news.example.com/");
    context.openDocuments = [shown.id, kept.id, waiting];
    context.answerRequest = (method, parameters) => method === BrowserMethods.holdPages ? Promise.resolve({ agents: [], refused: [shown.id, waiting] }) : declared(method, parameters);

    await pages.reportOpenAsync();

    expect([viewOf(shown).isClosed, viewOf(kept).isClosed, [...pages.elsewhere()]]).toEqual([true, false, [shown.id]]);
    expect(requestsOf(BrowserMethods.holdPages)).toEqual([{ instances: [shown.id, kept.id, waiting] }]);
    context.answerRequest = (method, parameters) => method === BrowserMethods.claimPage ? Promise.resolve({ agentName: null, isClaimed: false, isHere: false, record: null }) : declared(method, parameters);
    expect(await pages.showAsync(waiting)).toBeNull();
    expect(requestsOf(BrowserMethods.claimPage)).toEqual([{ instance: waiting }]);
  });

  it("closes a view that opened while another window took its page, and says so", async () => {
    const instance: string = pages.open("workspace-1", "https://docs.example.com/");
    const release = surface().holdNextOpen();
    const showing: Promise<PaneTab | null> = pages.showAsync(instance);
    context.openDocuments = [instance];
    context.answerRequest = (method, parameters) => method === BrowserMethods.holdPages ? Promise.resolve({ agents: [], refused: [instance] }) : declared(method, parameters);
    await pages.reportOpenAsync();
    release();

    expect(await showing).toBeNull();
    expect([surface().views.map(t => t.isClosed), [...pages.elsewhere()], requestsOf(BrowserMethods.rememberPage)]).toEqual([[true], [instance], []]);
  });

  it("logs an answer to the window's open pages that fails or isn't one, and changes no tab, nor counts a reported tab's page for its agent", async () => {
    const tab: PaneTab = await openAsync("https://docs.example.com/");
    const reported: string = "3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d";
    context.openDocuments = [tab.id, reported];
    context.emit(BrowserEvents.pageActivity, { instance: reported, activity: "call-1", agentName: "Scout", action: "Clicking", state: "Acting", box: null, point: null,
      refusal: null, isHandedOver: false });
    const failure: Error = new Error("The runtime stopped.");
    context.answerRequest = (method, parameters) => method === BrowserMethods.holdPages ? Promise.reject(failure) : declared(method, parameters);
    await pages.reportOpenAsync();
    context.answerRequest = (method, parameters) => method === BrowserMethods.holdPages ? Promise.resolve({ agents: [], refused: [1] }) : declared(method, parameters);
    await pages.reportOpenAsync();

    expect([context.logs, viewOf(tab).isClosed, [...pages.elsewhere()], context.statusBarItems[0]?.state().isHidden])
      .toEqual([[
        "The window's open pages weren't held, so another window may open one of them too: Error.",
        "The window's open pages weren't held, so another window may open one of them too: HeldPagesAnswerMalformedException."
      ], false, [], true]);
  });

  it("forgets that another window has the page of a tab the person closes", async () => {
    const instance: string = "3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d";
    context.answerRequest = (method, parameters) => method === BrowserMethods.claimPage
      ? Promise.resolve({ agentName: null, isClaimed: false, isHere: false, record: null })
      : method === BrowserMethods.readPage ? Promise.resolve({ instance, profileKey: "workspace-1", url: "" }) : declared(method, parameters);
    await pages.showAsync(instance);

    context.closeByPerson(instance);

    expect([[...pages.elsewhere()], requestsOf(BrowserMethods.forgetPage)]).toEqual([[], [{ instance }]]);
  });

  it("opens the app's instance that no window holds, and brings one this window holds forward without asking the runtime part", async () => {
    const picked: string = "3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d";
    context.answerRequest = (method, parameters) => method === BrowserMethods.claimPage ? Promise.resolve({ agentName: null, isClaimed: true, isHere: false, record: null }) : declared(method, parameters);

    expect(await pages.openAsync("workspace-1", null, picked)).toBe(picked);
    expect(await pages.openAsync("workspace-1", null, picked)).toBe(picked);
    await pages.showAsync(picked);
    expect(await pages.openAsync("workspace-1", null, picked)).toBe(picked);
    expect(UUID.test(await pages.openAsync("workspace-1", null, null))).toBe(true);

    expect([context.opened.map(t => t.instance).slice(0, 3), requestsOf(BrowserMethods.claimPage)]).toEqual([[picked, picked, picked], [{ instance: picked }]]);
  });

  it("tells the runtime part the pages this window has open, shown or not, and nothing when it has none or Noldova Desktop lists none", async () => {
    const open: readonly string[] = ["3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d", "0f8fad5b-d9cb-469f-a165-70867728950e"];
    context.openDocuments = open;
    await pages.reportOpenAsync();
    context.openDocuments = [];
    await pages.reportOpenAsync();
    context.openDocuments = null;
    await pages.reportOpenAsync();

    expect(requestsOf(BrowserMethods.holdPages)).toEqual([{ instances: open }]);
  });

  it("logs a list of open pages Noldova Desktop can't give, and tells the runtime part nothing", async () => {
    context.openDocuments = new Error("The part deactivated.");

    await pages.reportOpenAsync();

    expect([requestsOf(BrowserMethods.holdPages), context.logs]).toEqual([[], ["The window's open pages weren't read, so another window may open one of them too: Error."]]);
  });

  it("forgets the page of each tab the person closes, one that never showed too, so the app's instance takes a claim again, until the part closes", async () => {
    const unshown: string = pages.open("workspace-1", "https://docs.example.com/");
    context.answerRequest = (method, parameters) => method === BrowserMethods.claimPage ? Promise.resolve({ agentName: null, isClaimed: false, isHere: false, record: null }) : declared(method, parameters);

    context.closeByPerson(unshown);
    await expect(pages.openAsync("workspace-1", null, unshown)).rejects.toThrow(PageInAnotherWindowException);
    pages.close();
    context.closeByPerson(unshown);

    expect([requestsOf(BrowserMethods.forgetPage), context.closeListenerCount]).toEqual([[{ instance: unshown }], 0]);
  });

  it("waits for no page Noldova Desktop refused to open, so its instance shows only through its record", async () => {
    const refusal: Error = new Error("The title is blank.");
    let refused: string = "";
    vi.spyOn(context, "openDocument").mockImplementation((_name: string, instance: string) => {
      refused = instance;
      throw refusal;
    });

    expect(() => pages.open("workspace-1", "https://docs.example.com/")).toThrow(refusal);
    expect(await pages.showAsync(refused)).toBeNull();
    expect(requestsOf(BrowserMethods.claimPage)).toEqual([{ instance: refused }]);
  });

  it("opens a shown page's view on its document's pane and workspace, keeps its record and goes to its address", async () => {
    const tab = await openAsync("https://docs.example.com/pricing");

    expect([viewOf(tab).pane, viewOf(tab).profileKey, tab.id]).toEqual([WebViewValues.pane("browser.page", lastOpened()), "workspace-1", lastOpened()]);
    expect(requestsOf(BrowserMethods.rememberPage)).toEqual([{ instance: tab.id, profileKey: "workspace-1", url: "https://docs.example.com/pricing" }]);
    await vi.waitFor(() => expect(viewOf(tab).calls).toEqual(["navigate https://docs.example.com/pricing"]));
  });

  it("opens an empty page without going anywhere", async () => {
    const tab = await openAsync();

    expect([viewOf(tab).calls, tab.controller.status, requestsOf(BrowserMethods.rememberPage)]).toEqual([[], PaneStatus.empty, [{ instance: tab.id, profileKey: "workspace-1", url: "" }]]);
  });

  it("keeps no about:blank in an empty page's record or tab, whether or not it heard its view's start there", async () => {
    const heard = await openAsync();
    const unheard = await openAsync();
    loading(viewOf(heard), "about:blank", false, "about:blank");
    for (const tab of [heard, unheard])
      loading(viewOf(tab), "https://docs.example.com/", true);

    expect(requestsOf(BrowserMethods.rememberPage)).toEqual([heard, unheard, heard, unheard]
      .map((t, i) => ({ instance: t.id, profileKey: "workspace-1", url: i < 2 ? "" : "https://docs.example.com/" })));
    expect(context.titles.filter(t => t.update.title !== undefined).map(t => [t.instance, t.update.title]))
      .toEqual([[heard.id, "New tab"], [heard.id, "https://docs.example.com/"], [unheard.id, "https://docs.example.com/"]]);
  });

  it("opens a restored page in the workspace its record keeps, at the address it last showed", async () => {
    const instance: string = "0f8fad5b-d9cb-469f-a165-70867728950e";
    context.answerRequest = (method, parameters) => method === BrowserMethods.claimPage
      ? Promise.resolve({ agentName: null, isClaimed: true, isHere: false, record: { instance, profileKey: "workspace-2", url: "https://status.example.com/" } }) : declared(method, parameters);

    const tab = await pages.showAsync(instance);
    place(tab);

    expect([requestsOf(BrowserMethods.claimPage), requestsOf(BrowserMethods.readPage)]).toEqual([[{ instance }], []]);
    expect([tab?.id, tab === null ? null : viewOf(tab).profileKey]).toEqual([instance, "workspace-2"]);
    await vi.waitFor(() => expect(tab === null ? null : viewOf(tab).calls).toEqual(["navigate https://status.example.com/"]));
  });

  it("gives null, and opens no view, for a restored page the module keeps no record of, or once the part deactivated", async () => {
    expect(await pages.showAsync("0f8fad5b-d9cb-469f-a165-70867728950e")).toBeNull();
    const instance: string = pages.open("workspace-1", null);
    pages.close();
    context.answerRequest = () => Promise.resolve({ agentName: null, isClaimed: true, isHere: false, record: { instance, profileKey: "workspace-1", url: "" } });

    expect(await pages.showAsync(instance)).toBeNull();
    expect(surface().views).toEqual([]);
  });

  it("rejects when the runtime part's claim, or the record of a page another window claimed, is malformed", async () => {
    context.answerRequest = () => Promise.resolve({ instance: "page" });
    await expect(pages.showAsync("0f8fad5b-d9cb-469f-a165-70867728950e")).rejects.toThrow(PageClaimAnswerMalformedException);

    context.answerRequest = (method, parameters) => method === BrowserMethods.claimPage ? Promise.resolve({ agentName: null, isClaimed: false, isHere: false, record: null })
      : method === BrowserMethods.readPage ? Promise.resolve({ instance: "page" }) : declared(method, parameters);
    await expect(pages.showAsync("0f8fad5b-d9cb-469f-a165-70867728950e")).rejects.toThrow(PageRecordAnswerMalformedException);
  });

  it("gives an unavailable tab, which goes nowhere, when the host refuses its view, and logs the refusal by its kind", async () => {
    surface().refuseNextOpen(new RangeError("The window has no pane."));

    const tab = await openAsync("https://docs.example.com/");

    expect([tab.view, tab.controller.status, context.logs]).toEqual([null, PaneStatus.unavailable, ["A page's view didn't open, so its tab shows no page: RangeError."]]);
  });

  it("closes a view that opens after the part deactivated, and gives null", async () => {
    const release = surface().holdNextOpen();
    const instance: string = pages.open("workspace-1", null);
    const showing = pages.showAsync(instance);
    pages.close();
    release();

    expect(await showing).toBeNull();
    expect(surface().views[0]?.calls).toEqual(["close"]);
  });

  it("asks the runtime part to stop a page's calls, or to take it over, and logs a stop that fails by its kind alone", async () => {
    const instance: string = "3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d";
    pages.stop(instance, false);
    pages.stop(instance, true);
    context.answerRequest = () => Promise.reject(new TypeError("The runtime part went away."));
    pages.stop(instance, true);

    expect(requestsOf(BrowserMethods.stopPage)).toEqual([{ instance, isTakingOver: false }, { instance, isTakingOver: true }, { instance, isTakingOver: true }]);
    await vi.waitFor(() => expect(context.logs).toEqual(["A teammate's call on a page wasn't stopped: TypeError."]));
  });

  it("sends a page's new view to its first address only once the runtime part has given it its workspace's origins", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const ready: PromiseWithResolvers<JsonValue> = Promise.withResolvers<JsonValue>();
    context.answerRequest = (method, parameters) => method === BrowserMethods.readyPage ? ready.promise : declared(method, parameters);
    const tab = await openAsync("https://docs.example.com/pricing");
    await vi.advanceTimersByTimeAsync(0);
    expect(requestsOf(BrowserMethods.readyPage)).toEqual([{ instance: tab.id }]);
    const before: string[] = [...viewOf(tab).calls];

    ready.resolve(null);
    await vi.advanceTimersByTimeAsync(0);

    expect([before, viewOf(tab).calls, context.logs]).toEqual([[], ["navigate https://docs.example.com/pricing"], []]);
  });

  it("logs a failed answer to a new view's origins by the failure's kind alone and sends the view to its first address anyway", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    context.answerRequest = (method, parameters) => method === BrowserMethods.readyPage ? Promise.reject(new TypeError("The runtime part went away.")) : declared(method, parameters);

    const tab = await openAsync("https://docs.example.com/pricing");
    await vi.advanceTimersByTimeAsync(0);

    expect([viewOf(tab).calls, context.logs]).toEqual([["navigate https://docs.example.com/pricing"], ["A page's view didn't get its workspace's origins before its first address: TypeError."]]);
  });

  it("logs a new view whose origins don't come within the limit and sends it to its first address anyway, rather than leave its tab blank", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    context.answerRequest = (method, parameters) => method === BrowserMethods.readyPage ? new Promise<JsonValue>(() => undefined) : declared(method, parameters);
    const tab = await openAsync("https://docs.example.com/pricing");
    await vi.advanceTimersByTimeAsync(0);
    expect(requestsOf(BrowserMethods.readyPage)).toEqual([{ instance: tab.id }]);

    await vi.advanceTimersByTimeAsync(4_999);
    const before: string[] = [...viewOf(tab).calls];
    await vi.advanceTimersByTimeAsync(1);

    expect([before, viewOf(tab).calls, context.logs]).toEqual([[], ["navigate https://docs.example.com/pricing"], ["A page's view didn't get its workspace's origins within 5 s, so it goes to its first address anyway."]]);
  });

  it("goes nowhere and logs nothing for a tab released, or a part deactivated, before the runtime part fails to ready its view", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const ready: PromiseWithResolvers<JsonValue> = Promise.withResolvers<JsonValue>();
    context.answerRequest = (method, parameters) => method === BrowserMethods.readyPage ? ready.promise : declared(method, parameters);
    const released = await openAsync("https://docs.example.com/pricing");
    const kept = await openAsync("https://status.example.com/");
    await vi.advanceTimersByTimeAsync(0);
    expect(requestsOf(BrowserMethods.readyPage)).toEqual([{ instance: released.id }, { instance: kept.id }]);

    pages.release(released);
    pages.close();
    ready.reject(new TypeError("The runtime part went away."));
    await vi.advanceTimersByTimeAsync(5_000);

    expect([viewOf(released).calls, viewOf(kept).calls, context.logs]).toEqual([["close"], [], []]);
  });

  it("goes nowhere and logs nothing for a tab released while the part stays active, and its other tabs still go to their first addresses", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const ready: PromiseWithResolvers<JsonValue> = Promise.withResolvers<JsonValue>();
    context.answerRequest = (method, parameters) => method === BrowserMethods.readyPage ? ready.promise : declared(method, parameters);
    const released = await openAsync("https://docs.example.com/pricing");
    const kept = await openAsync("https://status.example.com/");
    await vi.advanceTimersByTimeAsync(0);

    pages.release(released);
    ready.reject(new TypeError("The runtime part went away."));
    await vi.advanceTimersByTimeAsync(5_000);

    expect([viewOf(released).calls, viewOf(kept).calls, context.logs])
      .toEqual([["close"], ["navigate https://status.example.com/"], ["A page's view didn't get its workspace's origins before its first address: TypeError."]]);
  });

  it("goes nowhere and logs nothing for a tab another window takes before the runtime part readies its view", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const ready: PromiseWithResolvers<JsonValue> = Promise.withResolvers<JsonValue>();
    const refused: string[] = [];
    context.answerRequest = (method, parameters) => method === BrowserMethods.readyPage ? ready.promise
      : method === BrowserMethods.holdPages ? Promise.resolve({ agents: [], refused }) : declared(method, parameters);
    const taken = await openAsync("https://docs.example.com/pricing");
    const kept = await openAsync("https://status.example.com/");
    refused.push(taken.id);
    context.openDocuments = [taken.id, kept.id];

    await pages.reportOpenAsync();
    ready.reject(new TypeError("The runtime part went away."));
    await vi.advanceTimersByTimeAsync(5_000);

    expect([viewOf(taken).calls, viewOf(kept).calls, context.logs, [...pages.elsewhere()]])
      .toEqual([["close"], ["navigate https://status.example.com/"], ["A page's view didn't get its workspace's origins before its first address: TypeError."], [taken.id]]);
  });

  it("asks for no origins for a page that opens without an address", async () => {
    const tab = await openAsync();
    await Promise.resolve();

    expect([requestsOf(BrowserMethods.readyPage), viewOf(tab).calls]).toEqual([[], []]);
  });

  it("logs a first address the bridge fails to go to by the failure's kind alone, without its message or the address", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.spyOn(FakeWebView.prototype, "navigateAsync").mockImplementationOnce(() => Promise.reject(new TypeError("https://docs.example.com/private/report is gone.")));

    await openAsync("https://docs.example.com/private/report");
    await vi.advanceTimersByTimeAsync(0);

    expect(context.logs).toEqual(["A page didn't go to its first address: TypeError."]);
  });

  it("keeps the document's title, its working mark and the record's address in step with the page", async () => {
    const tab = await openAsync();
    const view = viewOf(tab);

    loading(view, "https://docs.example.com/", true);
    loading(view, "https://docs.example.com/", true);
    expect(context.working).toEqual([tab.id]);
    loading(view, "https://docs.example.com/", false, "Plans and pricing");
    loading(view, "https://docs.example.com/", false, "Plans and pricing");

    expect(context.working).toEqual([]);
    expect(context.titles).toEqual([{ instance: tab.id, update: { title: "https://docs.example.com/" } }, { instance: tab.id, update: { title: "Plans and pricing" } }]);
    expect(requestsOf(BrowserMethods.rememberPage)).toEqual([
      { instance: tab.id, profileKey: "workspace-1", url: "" }, { instance: tab.id, profileKey: "workspace-1", url: "https://docs.example.com/" }
    ]);
  });

  it("takes the working mark away when a load fails, is refused or is stopped, so a failed or refused page shows its glyph alone", async () => {
    surface().script("https://docs.example.com/slow", { kind: "pending" });
    const tab = await openAsync();
    const view = viewOf(tab);
    const working: (readonly string[])[] = [];

    loading(view, "https://docs.exmaple.com/", true);
    working.push(context.working);
    view.emit(new ViewLoadFailureEvent("https://docs.exmaple.com/", -105, "ERR_NAME_NOT_RESOLVED"));
    working.push(context.working);
    loading(view, "https://docs.example.com/", true);
    working.push(context.working);
    tab.controller.refuseNavigation("https://refused.example");
    working.push(context.working);
    await tab.controller.navigateAsync("https://docs.example.com/slow");
    working.push(context.working);
    await tab.controller.stopAsync();
    working.push(context.working);

    expect(working).toEqual([[tab.id], [], [tab.id], [], [tab.id], []]);
  });

  it("says on its tab that a page can't be reached, in the failure colour, or isn't opened, in the tab's own, once each, and nothing once it stops working or loads again", async () => {
    const tab = await openAsync();
    const view = viewOf(tab);
    const status = (glyph: string, heading: string, tone: DocumentTone) => ({ instance: tab.id, update: { status: { glyph, description: heading, tone } } });

    loading(view, "https://docs.exmaple.com/", true);
    view.emit(new ViewLoadFailureEvent("https://docs.exmaple.com/", -105, "ERR_NAME_NOT_RESOLVED"));
    view.emit(new ViewLoadFailureEvent("https://docs.exmaple.com/", -105, "ERR_NAME_NOT_RESOLVED"));
    tab.controller.refuseNavigation("https://refused.example");
    view.emit(new ViewCrashEvent());
    view.emit(new ViewCrashEvent());
    loading(view, "https://docs.example.com/", true);
    loading(view, "https://docs.example.com/", false, "Plans and pricing");

    expect(context.titles.filter(t => t.update.status !== undefined)).toEqual([
      status("error", "Can't reach docs.exmaple.com", DocumentTone.Failed), status("block", `${WindowContext.appName}'s browser doesn't open https://refused.example`, DocumentTone.Neutral),
      { instance: tab.id, update: { status: null } }
    ]);
  });

  it("names the app's browser in an open page's status when the app's name answers after a refusal", async () => {
    let answerName: (name: JsonValue) => void = () => undefined;
    context = new WindowContext();
    context.answerRequest = (method, parameters) => method === BrowserMethods.readAppName ? new Promise<JsonValue>(t => {
      answerName = t;
    }) : declared(method, parameters);
    pages = new Pages(context);
    const tab = await openAsync();
    const status = (heading: string) => ({ instance: tab.id, update: { status: { glyph: "block", description: heading, tone: DocumentTone.Neutral } } });

    tab.controller.refuseNavigation("https://refused.example");
    answerName(WindowContext.appName);
    await vi.waitFor(() => expect(pages.appName()).toBe(WindowContext.appName));

    expect(context.titles.filter(t => t.update.status !== undefined)).toEqual([
      status("This browser doesn't open https://refused.example"), status(`${WindowContext.appName}'s browser doesn't open https://refused.example`)
    ]);
  });

  it("opens each view named as the app's browser for its refused pages, or as this browser while the app's name is unknown", async () => {
    let answerName: (name: JsonValue) => void = () => undefined;
    context = new WindowContext();
    context.answerRequest = (method, parameters) => method === BrowserMethods.readAppName ? new Promise<JsonValue>(t => {
      answerName = t;
    }) : declared(method, parameters);
    pages = new Pages(context);

    await openAsync();
    answerName(WindowContext.appName);
    await vi.waitFor(() => expect(pages.appName()).toBe(WindowContext.appName));
    await openAsync();

    expect(context.views.names).toEqual(["This browser", `${WindowContext.appName}'s browser`]);
  });

  it("keeps the address the record has while the page shows none yet", async () => {
    const tab = await openAsync("https://docs.example.com/");

    loading(viewOf(tab), "", true);

    expect(requestsOf(BrowserMethods.rememberPage)).toEqual([{ instance: tab.id, profileKey: "workspace-1", url: "https://docs.example.com/" }]);
  });

  it("logs a record the runtime part fails to keep, by the failure's kind, and the page goes on", async () => {
    context.answerRequest = () => Promise.reject("The database is closed.");

    const tab = await openAsync();

    await vi.waitFor(() => expect(context.logs).toEqual(["A page's record wasn't kept or forgotten, so the window may not restore it: string."]));
    expect(tab.controller.status).toBe(PaneStatus.empty);
  });

  it("opens a new window the person's own input asked for as a page on the same workspace, marked with the page that asked, and offers any other in the tab's notice", async () => {
    const tab = await openAsync(null, "workspace-2");
    loading(viewOf(tab), "https://docs.example.com/", false, "Plans and pricing");

    viewOf(tab).emit(new ViewNewWindowEvent("https://status.example.com/", true, "https://docs.example.com"));
    viewOf(tab).emit(new ViewNewWindowEvent("https://ads.example.com/", false, null));

    expect(context.opened.slice(1).map(t => [t.title, t.after, t.marker]))
      .toEqual([["https://status.example.com/", tab.id, { glyph: "subdirectory_arrow_right", label: "Opened from Plans and pricing" }]]);
    expect(tab.controller.status.popup).toStrictEqual(new PopupOffer("https://ads.example.com/", null, false));
    const opener = await pages.showAsync(lastOpened());
    expect(opener === null ? null : viewOf(opener).profileKey).toBe("workspace-2");
  });

  it("opens one page for the person's input however many windows the page asks for, offers the rest, and opens again once the input is old", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-06T12:00:00Z"));
    const tab = await openAsync(null, "workspace-2");
    const other = await openAsync(null, "workspace-2");
    const ask = (view: FakeWebView, address: string): void => view.emit(new ViewNewWindowEvent(address, true, null));

    for (let count = 1; count <= 50; count++)
      ask(viewOf(tab), `https://ads.example.com/${count}`);
    ask(viewOf(other), "https://status.example.com/");
    vi.setSystemTime(new Date("2026-11-06T12:00:04.999Z"));
    ask(viewOf(tab), "https://ads.example.com/late");

    expect(context.opened.slice(2).map(t => t.title)).toEqual(["https://ads.example.com/1", "https://status.example.com/"]);
    expect(tab.controller.status.popup).toStrictEqual(new PopupOffer("https://ads.example.com/late", null, true));
    vi.setSystemTime(new Date("2026-11-06T12:00:05Z"));
    ask(viewOf(tab), "https://docs.example.com/next");
    expect(context.opened.slice(4).map(t => t.title)).toEqual(["https://docs.example.com/next"]);
  });

  it("opens a tab behind the page at once for each of the person's middle or Ctrl clicks on a link, while the same click's second request and a page's other requests in the same 5 seconds wait in its notice", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-06T12:00:00Z"));
    const tab = await openAsync(null, "workspace-2");

    viewOf(tab).emit(new ViewNewWindowEvent("https://docs.example.com/a", true, null, true, true));
    viewOf(tab).emit(new ViewNewWindowEvent("https://docs.example.com/b", true, null, true, true));
    viewOf(tab).emit(new ViewNewWindowEvent("https://ads.example.com/second", true, null, true, false));
    const second: PopupOffer | null = tab.controller.status.popup;
    viewOf(tab).emit(new ViewNewWindowEvent("https://ads.example.com/", true, null));
    viewOf(tab).emit(new ViewNewWindowEvent("https://docs.example.com/c", false, null, true, true));

    expect(context.opened.map(t => [t.title, t.activate])).toEqual([["New tab", undefined], ["https://docs.example.com/a", false], ["https://docs.example.com/b", false]]);
    expect(second).toStrictEqual(new PopupOffer("https://ads.example.com/second", null, true));
    expect(tab.controller.status.popup).toStrictEqual(new PopupOffer("https://docs.example.com/c", null, false));
  });

  it("opens a new window as a page of its own, with its own view, controller and history, and leaves the page that asked as it was, even once that page closes", async () => {
    const tab = await openAsync("https://docs.example.com/", "workspace-2");
    await vi.waitFor(() => expect(tab.controller.status.url).toBe("https://docs.example.com/"));
    const asked: string[] = [...viewOf(tab).calls];

    viewOf(tab).emit(new ViewNewWindowEvent("https://status.example.com/", true, "https://docs.example.com"));
    const opened = await pages.showAsync(lastOpened());
    if (opened === null)
      throw new Error("The new page didn't show.");
    place(opened);
    await vi.waitFor(() => expect(opened.controller.status.url).toBe("https://status.example.com/"));

    expect([opened.id === tab.id, opened.controller === tab.controller, viewOf(opened) === viewOf(tab), viewOf(opened).profileKey])
      .toEqual([false, false, false, "workspace-2"]);
    expect([viewOf(opened).calls, opened.controller.status.canGoBack]).toEqual([["navigate https://status.example.com/"], false]);
    expect([viewOf(tab).calls, tab.controller.status.url, tab.controller.status.canGoBack]).toEqual([asked, "https://docs.example.com/", false]);

    pages.release(tab);

    viewOf(opened).emit(new ViewNewWindowEvent("https://status.example.com/history", true, "https://status.example.com"));

    expect([viewOf(tab).isClosed, viewOf(opened).isClosed, opened.controller.status.url]).toEqual([true, false, "https://status.example.com/"]);
    expect(context.opened.slice(1).map(t => t.title)).toEqual(["https://status.example.com/", "https://status.example.com/history"]);
  });

  it("logs a new window Noldova Desktop refused to open, says so in the tab's notice, and lets the next one the input asks for open", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-06T12:00:00Z"));
    const tab = await openAsync(null, "workspace-2");
    const refusal = vi.spyOn(context, "openDocument").mockImplementationOnce(() => {
      throw new RangeError("The title is too long.");
    });

    viewOf(tab).emit(new ViewNewWindowEvent("https://status.example.com/", true, null));
    expect([tab.controller.status.refusedRequest, tab.controller.status.refusedTarget, tab.controller.status.popup]).toEqual([RefusedRequest.NewWindow, "https://status.example.com/", null]);
    vi.setSystemTime(new Date("2026-11-06T12:00:01Z"));
    viewOf(tab).emit(new ViewNewWindowEvent("https://docs.example.com/next", true, null));

    expect([refusal.mock.calls.length, context.logs]).toEqual([2, ["A page's new window didn't open as a page: RangeError."]]);
    expect([context.opened.slice(1).map(t => t.title), tab.controller.status.popup]).toEqual([["https://docs.example.com/next"], null]);
  });

  it("opens an offered pop-up as a page on the tab's workspace and takes its notice away, and nothing for a tab it let go of", async () => {
    const tab = await openAsync(null, "workspace-2");
    tab.controller.offerPopup("https://ads.example.com/", null);

    pages.openPopup(tab, "https://ads.example.com/");
    expect(tab.controller.status.popup).toBeNull();
    pages.release(tab);
    pages.openPopup(tab, "https://other.example.com/");

    expect(context.opened.slice(1).map(t => t.title)).toEqual(["https://ads.example.com/"]);
  });

  it("opens a page that another page asked for after it, after the person's click or from the pop-up notice", async () => {
    const tab = await openAsync("https://docs.example.com/", "workspace-2");
    tab.controller.offerPopup("https://ads.example.com/", null);

    viewOf(tab).emit(new ViewNewWindowEvent("https://status.example.com/", true, "https://docs.example.com"));
    pages.openPopup(tab, "https://ads.example.com/");

    expect(context.opened.map(t => [t.title, t.after])).toEqual([
      ["https://docs.example.com/", null], ["https://status.example.com/", tab.id], ["https://ads.example.com/", context.opened[1]?.instance]
    ]);
  });

  it("keeps the pages one page asks for in a row in their order, and opens the next right after the asking page once the last has closed", async () => {
    const tab = await openAsync("https://docs.example.com/", "workspace-2");

    pages.openPopup(tab, "https://a.example.com/");
    pages.openPopup(tab, "https://b.example.com/");
    const inRow = context.row;
    const last = await pages.showAsync(lastOpened());
    if (last === null)
      throw new Error("The page didn't show.");
    pages.release(last);
    pages.openPopup(tab, "https://c.example.com/");

    expect([inRow, context.row]).toEqual([
      ["https://docs.example.com/", "https://a.example.com/", "https://b.example.com/"],
      ["https://docs.example.com/", "https://c.example.com/", "https://a.example.com/", "https://b.example.com/"]
    ]);
  });

  it("opens an empty page on a tab's workspace at the end of the row, logs one Noldova Desktop refused to open, and opens none for a tab it let go of", async () => {
    const tab = await openAsync("https://docs.example.com/", "workspace-2");
    await vi.waitFor(() => expect(tab.controller.status.url).toBe("https://docs.example.com/"));
    pages.openPopup(tab, "https://ads.example.com/");

    pages.openNew(tab);
    vi.spyOn(context, "openDocument").mockImplementationOnce(() => {
      throw new RangeError("The title is too long.");
    });
    pages.openNew(tab);
    pages.release(tab);
    pages.openNew(tab);
    const shown: PaneTab | null = await pages.showAsync(lastOpened());

    expect([context.opened.map(t => [t.title, t.after]), context.logs, shown === null ? null : viewOf(shown).profileKey]).toEqual([
      [["https://docs.example.com/", null], ["https://ads.example.com/", tab.id], ["New tab", null]], ["The new page didn't open: RangeError."], "workspace-2"
    ]);
  });

  it("clears the tab's workspace's browsing data, and nothing for a tab it let go of", async () => {
    const tab = await openAsync(null, "workspace-2");

    await pages.clearBrowsingDataAsync(tab);
    pages.release(tab);
    await pages.clearBrowsingDataAsync(tab);

    expect(requestsOf(BrowserMethods.clearBrowsingData)).toEqual([{ profileKey: "workspace-2" }]);
  });

  it("closes a released tab's view and stops following it, and forgets its record once, as the person's close says", async () => {
    const tab = await openAsync();
    const other = await openAsync(null, "workspace-2");
    loading(viewOf(tab), "https://docs.example.com/", true);

    pages.release(tab);
    pages.release(tab);
    loading(viewOf(tab), "https://docs.example.com/", false, "Plans and pricing");
    context.closeByPerson(tab.id);
    await pages.clearBrowsingDataAsync(other);

    expect([viewOf(tab).calls, context.working, context.titles.length]).toEqual([["close"], [], 1]);
    expect(requestsOf(BrowserMethods.forgetPage)).toEqual([{ instance: tab.id }]);
  });

  it("keeps the record of a tab released as the part deactivates, so the window restores it", async () => {
    const tab = await openAsync();
    const other = await openAsync(null, "workspace-2");

    pages.release(tab);
    pages.close();
    await pages.clearBrowsingDataAsync(other);

    expect([requestsOf(BrowserMethods.clearBrowsingData), requestsOf(BrowserMethods.forgetPage)]).toEqual([[{ profileKey: "workspace-2" }], []]);
  });

  describe("goToAsync", () => {
    let answer: JsonValue;

    beforeEach(() => {
      answer = { kind: "Allowed", origin: "https://example.com" };
      context.answerRequest = (method, parameters) => method === BrowserMethods.allowTypedAddress || method === BrowserMethods.passTypedRedirect ? Promise.resolve(answer) : declared(method, parameters);
    });

    function typedAddresses(): JsonValue[] {
      return requestsOf(BrowserMethods.allowTypedAddress);
    }

    function passed(): string[] {
      return requestsOf(BrowserMethods.passTypedRedirect).map(urlOf);
    }

    function joinsAndEnds(): string[] {
      return context.requests.filter(t => t.method === BrowserMethods.allowTypedAddress || t.method === BrowserMethods.endTypedRedirects)
        .map(t => t.method === BrowserMethods.endTypedRedirects ? "end" : urlOf(t.parameters));
    }

    it("allows the typed address in the page's workspace, then goes there in that tab", async () => {
      const first = await openAsync();
      const second = await openAsync();

      expect(await pages.goToAsync(first, "  example.com/docs ")).toBe(EntryAnswer.Gone);
      expect(typedAddresses()).toEqual([{ profileKey: "workspace-1", url: "https://example.com/docs", instance: first.id }]);
      expect([viewOf(first).calls, viewOf(second).calls]).toEqual([["navigate https://example.com/docs"], []]);
      expect(first.controller.status.url).toBe("https://example.com/docs");
    });

    it("reads a typed address without a scheme with the scheme of the single site the setting Sites on this computer or network names there", async () => {
      context.settings.set("browser.localSites", "https://192.168.1.5:8006, http://127.0.0.1:4173");
      const tab = await openAsync();

      await pages.goToAsync(tab, "192.168.1.5:8006");

      expect(typedAddresses()).toEqual([{ profileKey: "workspace-1", url: "https://192.168.1.5:8006/", instance: tab.id }]);
    });

    it("answers that Noldova Desktop refused when it refuses the typed address's navigation, which the pane shows as refused", async () => {
      surface().script("https://example.com/docs", { kind: "refuse" });
      const tab = await openAsync();

      expect(await pages.goToAsync(tab, "example.com/docs")).toBe(EntryAnswer.Refused);
      expect([viewOf(tab).calls, tab.controller.status.state, tab.controller.status.refusedOrigin]).toEqual([["navigate https://example.com/docs"], PaneState.Refused, "https://example.com"]);
    });

    it("follows the typed address's redirects for that load only, judging each one's address as a typed one, and only the page it lands on joins", async () => {
      surface().script("https://example.com/", { kind: "redirect", to: "https://www.example.com/", title: "", isRefused: true });
      surface().script("https://www.example.com/", { kind: "redirect", to: "https://consent.example.net/", title: "", isRefused: true });
      surface().script("https://consent.example.net/", { kind: "load", title: "Consent" });
      const tab = await openAsync();

      expect(await pages.goToAsync(tab, "example.com")).toBe(EntryAnswer.Gone);
      await vi.waitFor(() => expect(joinsAndEnds()).toEqual(["https://example.com/", "https://consent.example.net/", "end"]));

      expect(requestsOf(BrowserMethods.passTypedRedirect)).toEqual(["https://www.example.com/", "https://consent.example.net/"].map(url => ({ instance: tab.id, profileKey: "workspace-1", url })));
      expect([typedAddresses().at(-1), requestsOf(BrowserMethods.endTypedRedirects)]).toEqual([{ profileKey: "workspace-1", url: "https://consent.example.net/" }, [{ instance: tab.id }]]);
      expect(viewOf(tab).calls).toEqual(["navigate https://example.com/", "navigate https://www.example.com/", "navigate https://consent.example.net/"]);
      expect([tab.controller.status.state, tab.controller.status.title, tab.controller.status.refusedOrigin, tab.controller.status.failureReason]).toEqual([PaneState.Loaded, "Consent", null, null]);
    });

    it("shows the not-allowed page for a redirect the runtime part refuses, never the cancelled request's failure, and the hop it followed joins nothing", async () => {
      context.answerRequest = (method, parameters) => method !== BrowserMethods.allowTypedAddress && method !== BrowserMethods.passTypedRedirect ? declared(method, parameters)
        : Promise.resolve(urlOf(parameters) === "http://192.168.1.1/" ? { kind: "Refused", reason: "Local" } : answer);
      surface().script("https://example.com/", { kind: "redirect", to: "https://www.example.com/", title: "", isRefused: true });
      surface().script("https://www.example.com/", { kind: "redirect", to: "http://192.168.1.1/", title: "", isRefused: true });
      const tab = await openAsync();

      await pages.goToAsync(tab, "example.com");
      await vi.waitFor(() => expect(joinsAndEnds()).toEqual(["https://example.com/", "end"]));

      expect([passed(), viewOf(tab).calls]).toEqual([["https://www.example.com/", "http://192.168.1.1/"], ["navigate https://example.com/", "navigate https://www.example.com/"]]);
      expect([tab.controller.status.state, tab.controller.status.refusedOrigin, tab.controller.status.failureReason]).toEqual([PaneState.Refused, "http://192.168.1.1", null]);
    });

    it("shows the not-allowed page, logs the failure's kind and ends the view's redirects when judging a redirect fails", async () => {
      context.answerRequest = (method, parameters) => method === BrowserMethods.passTypedRedirect ? Promise.reject(new RangeError("The runtime part is gone."))
        : method === BrowserMethods.allowTypedAddress ? Promise.resolve(answer) : declared(method, parameters);
      surface().script("https://example.com/", { kind: "redirect", to: "https://www.example.com/", title: "", isRefused: true });
      const tab = await openAsync();

      await pages.goToAsync(tab, "example.com");
      await vi.waitFor(() => expect([context.logs, joinsAndEnds()]).toEqual([["A typed address's redirect to another site wasn't followed: RangeError."], ["https://example.com/", "end"]]));

      expect([viewOf(tab).calls, tab.controller.status.state, tab.controller.status.refusedOrigin]).toEqual([["navigate https://example.com/"], PaneState.Refused, "https://www.example.com"]);
    });

    it("logs the failure's kind when the landed page can't join or the view's redirects can't end", async () => {
      context.answerRequest = (method, parameters) => method === BrowserMethods.endTypedRedirects || (method === BrowserMethods.allowTypedAddress && urlOf(parameters) === "https://www.example.com/")
        ? Promise.reject(new RangeError("The runtime part is gone."))
        : method === BrowserMethods.allowTypedAddress || method === BrowserMethods.passTypedRedirect ? Promise.resolve(answer) : declared(method, parameters);
      surface().script("https://example.com/", { kind: "redirect", to: "https://www.example.com/", title: "", isRefused: true });
      const tab = await openAsync();

      await pages.goToAsync(tab, "example.com");
      await vi.waitFor(() => expect(context.logs).toEqual(["A typed address's redirects weren't ended: RangeError.", "A typed address's redirects weren't ended: RangeError."]));

      expect([joinsAndEnds(), tab.controller.status.url]).toEqual([["https://example.com/", "https://www.example.com/", "end"], "https://www.example.com/"]);
    });

    it("follows ten redirects to other origins at most, and the next one's refusal stands, with none of them joining", async () => {
      for (let i = 0; i <= 10; i++)
        surface().script(`https://r${String(i)}.example/`, { kind: "redirect", to: `https://r${String(i + 1)}.example/`, title: "", isRefused: true });
      const tab = await openAsync();

      await pages.goToAsync(tab, "r0.example");
      await vi.waitFor(() => expect(joinsAndEnds()).toEqual(["https://r0.example/", "end"]));

      expect([passed().length, viewOf(tab).calls.length, tab.controller.status.state, tab.controller.status.refusedOrigin]).toEqual([10, 11, PaneState.Refused, "https://r11.example"]);
    });

    it("leaves the refusal of a redirect that isn't the typed address's own: the page's later loads, and a page a teammate acts on", async () => {
      surface().script("https://old.example/", { kind: "redirect", to: "https://new.example/", title: "", isRefused: true });
      const tab = await openAsync();
      await pages.goToAsync(tab, "example.com");

      await viewOf(tab).navigateAsync("https://old.example/");
      expect([typedAddresses().map(urlOf), tab.controller.status.refusedOrigin]).toEqual([["https://example.com/"], "https://new.example"]);
      context.emit(BrowserEvents.pageActivity, { instance: tab.id, activity: "call-1", agentName: "Builder", action: "Navigating", state: "Acting", box: null, point: null, refusal: null, isHandedOver: false });
      surface().script("https://example.com/", { kind: "redirect", to: "https://www.example.com/", title: "", isRefused: true });
      await pages.goToAsync(tab, "example.com");

      expect([typedAddresses().map(urlOf), passed(), viewOf(tab).calls.at(-1), tab.controller.status.refusedOrigin])
        .toEqual([["https://example.com/", "https://example.com/"], [], "navigate https://example.com/", "https://www.example.com"]);
    });

    it("joins no page a teammate acts on by the time the typed load lands, and ends the redirects its view followed", async () => {
      surface().script("https://example.com/", { kind: "redirect", to: "https://www.example.com/", title: "", isRefused: true });
      surface().script("https://www.example.com/", { kind: "pending" });
      const tab = await openAsync();

      await pages.goToAsync(tab, "example.com");
      await vi.waitFor(() => expect(viewOf(tab).calls).toEqual(["navigate https://example.com/", "navigate https://www.example.com/"]));
      context.emit(BrowserEvents.pageActivity, { instance: tab.id, activity: "call-1", agentName: "Builder", action: "Reading", state: "Acting", box: null, point: null, refusal: null, isHandedOver: false });
      await viewOf(tab).stopAsync();
      await vi.waitFor(() => expect(joinsAndEnds()).toEqual(["https://example.com/", "end"]));

      expect([tab.controller.status.state, tab.controller.status.url]).toEqual([PaneState.Loaded, "https://www.example.com/"]);
    });

    it("joins the page a teammate only keeps control of between its calls, once the typed load lands, and ends the redirects its view followed", async () => {
      surface().script("https://example.com/", { kind: "redirect", to: "https://www.example.com/", title: "", isRefused: true });
      surface().script("https://www.example.com/", { kind: "pending" });
      const tab = await openAsync();

      await pages.goToAsync(tab, "example.com");
      await vi.waitFor(() => expect(viewOf(tab).calls).toEqual(["navigate https://example.com/", "navigate https://www.example.com/"]));
      context.emit(BrowserEvents.pageActivity, { instance: tab.id, activity: "control-1", agentName: "Builder", action: "Reading", state: "Idle", box: null, point: null, refusal: null, isHandedOver: false });
      await viewOf(tab).stopAsync();
      await vi.waitFor(() => expect(joinsAndEnds()).toEqual(["https://example.com/", "https://www.example.com/", "end"]));

      expect([pages.activities().get(tab.id)?.state, tab.controller.status.url]).toEqual(["Idle", "https://www.example.com/"]);
    });

    it("follows the redirects of a load typed on a page a teammate keeps control of between its calls, and joins the page once the load lands", async () => {
      surface().script("https://example.com/", { kind: "redirect", to: "https://www.example.com/", title: "", isRefused: true });
      surface().script("https://www.example.com/", { kind: "pending" });
      const tab = await openAsync();
      context.emit(BrowserEvents.pageActivity, { instance: tab.id, activity: "control-1", agentName: "Builder", action: "Reading", state: "Idle", box: null, point: null, refusal: null, isHandedOver: false });

      await pages.goToAsync(tab, "example.com");
      await vi.waitFor(() => expect(viewOf(tab).calls).toEqual(["navigate https://example.com/", "navigate https://www.example.com/"]));
      await viewOf(tab).stopAsync();
      await vi.waitFor(() => expect(joinsAndEnds()).toEqual(["https://example.com/", "https://www.example.com/", "end"]));

      expect([passed(), pages.activities().get(tab.id)?.state, tab.controller.status.url]).toEqual([["https://www.example.com/"], "Idle", "https://www.example.com/"]);
    });

    it("follows no redirect and joins nothing once a teammate's call starts on the page during its typed load, even after the call ended", async () => {
      surface().script("https://example.com/", { kind: "redirect", to: "https://www.example.com/", title: "", isRefused: true });
      surface().script("https://www.example.com/", { kind: "pending" });
      surface().script("https://login.example.org/", { kind: "load", title: "Signed in" });
      const tab = await openAsync();
      const activity = { instance: tab.id, activity: "call-1", agentName: "Builder", action: "Clicking", box: null, point: null, refusal: null, isHandedOver: false };

      await pages.goToAsync(tab, "example.com");
      await vi.waitFor(() => expect(viewOf(tab).calls).toEqual(["navigate https://example.com/", "navigate https://www.example.com/"]));
      context.emit(BrowserEvents.pageActivity, { ...activity, state: "Acting" });
      context.emit(BrowserEvents.pageActivity, { ...activity, state: "Ended" });
      expect([pages.activities().has(tab.id), joinsAndEnds()]).toEqual([false, ["https://example.com/"]]);
      surface().script("https://www.example.com/", { kind: "redirect", to: "https://login.example.org/", title: "", isRefused: true });
      await viewOf(tab).navigateAsync("https://www.example.com/");
      await vi.waitFor(() => expect(joinsAndEnds()).toEqual(["https://example.com/", "end"]));

      expect([passed(), viewOf(tab).calls.at(-1), tab.controller.status.state, tab.controller.status.refusedOrigin])
        .toEqual([["https://www.example.com/"], "navigate https://www.example.com/", PaneState.Refused, "https://login.example.org"]);
    });

    it("follows no redirect whose address the runtime part judges after the person entered another one, and ends it once that load ended", async () => {
      const judged = Promise.withResolvers<JsonValue>();
      context.answerRequest = (method, parameters) => method === BrowserMethods.passTypedRedirect && urlOf(parameters) === "https://www.example.com/" ? judged.promise
        : method === BrowserMethods.allowTypedAddress ? Promise.resolve(answer) : declared(method, parameters);
      surface().script("https://example.com/", { kind: "redirect", to: "https://www.example.com/", title: "", isRefused: true });
      const tab = await openAsync();

      await pages.goToAsync(tab, "example.com");
      await pages.goToAsync(tab, "example.org");
      judged.resolve(answer);
      await vi.waitFor(() => expect(joinsAndEnds()).toEqual(["https://example.com/", "https://example.org/", "https://example.org/", "end"]));

      expect([viewOf(tab).calls, tab.controller.status.url]).toEqual([["navigate https://example.com/", "navigate https://example.org/"], "https://example.org/"]);
    });

    it("logs a redirect whose judging fails after the person entered another address, and leaves that address's page as it is", async () => {
      const judged = Promise.withResolvers<JsonValue>();
      context.answerRequest = (method, parameters) => method === BrowserMethods.passTypedRedirect && urlOf(parameters) === "https://www.example.com/" ? judged.promise
        : method === BrowserMethods.allowTypedAddress ? Promise.resolve(answer) : declared(method, parameters);
      surface().script("https://example.com/", { kind: "redirect", to: "https://www.example.com/", title: "", isRefused: true });
      const tab = await openAsync();

      await pages.goToAsync(tab, "example.com");
      await pages.goToAsync(tab, "example.org");
      judged.reject(new RangeError("The runtime part is gone."));
      await vi.waitFor(() => expect([context.logs, joinsAndEnds()])
        .toEqual([["A typed address's redirect to another site wasn't followed: RangeError."], ["https://example.com/", "https://example.org/", "https://example.org/", "end"]]));

      expect([tab.controller.status.state, tab.controller.status.url]).toEqual([PaneState.Loaded, "https://example.org/"]);
    });

    it("ends the typed address's redirects once a load still going when the bridge answered ends", async () => {
      surface().script("https://example.com/", { kind: "pending" });
      surface().script("https://old.example/", { kind: "redirect", to: "https://new.example/", title: "", isRefused: true });
      const tab = await openAsync();

      await pages.goToAsync(tab, "example.com");
      expect(tab.controller.status.state).toBe(PaneState.Loading);
      await viewOf(tab).stopAsync();
      await viewOf(tab).navigateAsync("https://old.example/");

      expect([typedAddresses().map(urlOf), passed(), tab.controller.status.state, tab.controller.status.refusedOrigin]).toEqual([["https://example.com/"], [], PaneState.Refused, "https://new.example"]);
    });

    it("loads nothing and asks nothing for text that isn't a web address, and the tab says why", async () => {
      const tab = await openAsync();

      await pages.goToAsync(tab, "release notes");
      expect(tab.controller.status.refusedAddress).toBe("NotAnAddress");
      await pages.goToAsync(tab, "file:///etc/hosts");

      expect([typedAddresses(), viewOf(tab).calls, tab.controller.status.refusedAddress]).toEqual([[], [], "NotWeb"]);
    });

    it("loads nothing when the runtime part refuses the address, and the tab says why", async () => {
      const tab = await openAsync();
      answer = { kind: "Refused", reason: "Local" };

      expect(await pages.goToAsync(tab, "localhost:3000")).toBe(EntryAnswer.Stayed);
      expect(typedAddresses()).toEqual([{ profileKey: "workspace-1", url: "http://localhost:3000/", instance: tab.id }]);
      expect([viewOf(tab).calls, tab.controller.status.state, tab.controller.status.refusedAddress]).toEqual([[], PaneState.Empty, "Local"]);
    });

    it("shows the runtime part's refusal of a typed address in place of a failed load's state, and keeps that state for text that isn't an address", async () => {
      surface().script("https://down.example/", { kind: "fail", code: -105, description: "ERR_NAME_NOT_RESOLVED" });
      const tab = await openAsync();
      await pages.goToAsync(tab, "down.example");
      await pages.goToAsync(tab, "release notes");
      expect([tab.controller.status.state, tab.controller.status.refusedAddress]).toEqual([PaneState.Failed, "NotAnAddress"]);
      answer = { kind: "Refused", reason: "Local" };

      expect(await pages.goToAsync(tab, "http://192.168.1.1:8080/admin")).toBe(EntryAnswer.Stayed);
      expect([tab.controller.status.state, tab.controller.status.refusedOrigin, tab.controller.status.refusedAddress, tab.controller.status.failureReason, tab.controller.status.url])
        .toEqual([PaneState.Refused, "http://192.168.1.1:8080", "Local", null, "https://down.example/"]);
    });

    it("says so and rejects when the runtime part's answer isn't one, and loads nothing", async () => {
      const tab = await openAsync();
      answer = { kind: "Refused", reason: "unknown" };

      await expect(pages.goToAsync(tab, "example.com")).rejects.toThrow(TypedAddressAnswerMalformedException);

      expect([viewOf(tab).calls, tab.controller.status.refusedAddress]).toEqual([[], AddressRefusal.Failed]);
    });

    it("does nothing for a tab it let go of or one without a view", async () => {
      const tab = await openAsync();
      pages.release(tab);
      surface().refuseNextOpen(new Error("The window has no pane."));
      const unavailable = await openAsync();

      await pages.goToAsync(tab, "example.com");
      await pages.goToAsync(unavailable, "example.com");

      expect([typedAddresses(), viewOf(tab).calls, unavailable.controller.status]).toEqual([[], ["close"], PaneStatus.unavailable]);
    });

    it("goes nowhere when the tab goes while the runtime part answers", async () => {
      const { promise, resolve } = Promise.withResolvers<JsonValue>();
      context.answerRequest = (method, parameters) => method === BrowserMethods.allowTypedAddress ? promise : declared(method, parameters);
      const tab = await openAsync();

      const going = pages.goToAsync(tab, "example.com");
      pages.release(tab);
      resolve({ kind: "Allowed", origin: "https://example.com" });

      expect(await going).toBe(EntryAnswer.Stayed);
      expect(viewOf(tab).calls).toEqual(["close"]);
    });

    it("acts only on a tab's latest entry, so an earlier answer that comes later changes nothing", async () => {
      const answers: Map<string, (answer: JsonValue) => void> = new Map();
      context.answerRequest = (method, parameters) => method === BrowserMethods.allowTypedAddress
        ? new Promise<JsonValue>(resolve => answers.set(urlOf(parameters), resolve))
        : declared(method, parameters);
      const tab = await openAsync();

      const first = pages.goToAsync(tab, "new.example");
      const second = pages.goToAsync(tab, "kept.example");
      answers.get("https://kept.example/")?.({ kind: "Allowed", origin: "https://kept.example" });
      expect(await second).toBe(EntryAnswer.Gone);
      answers.get("https://new.example/")?.({ kind: "Refused", reason: "Local" });

      expect([await first, viewOf(tab).calls, tab.controller.status.refusedAddress]).toEqual([EntryAnswer.Stayed, ["navigate https://kept.example/"], null]);
    });

    describe("an entry left while its address waits for its answer", () => {
      let allow: (answer: JsonValue) => void;

      beforeEach(() => {
        allow = () => undefined;
        context.answerRequest = (method, parameters) => method === BrowserMethods.allowTypedAddress
          ? new Promise<JsonValue>(resolve => allow = resolve)
          : declared(method, parameters);
      });

      it("answers at once that the person left it, and goes nowhere once it is allowed", async () => {
        const tab = await openAsync();

        const going = pages.goToAsync(tab, "new.example");
        pages.leaveEntry(tab);

        expect(await going).toBe(EntryAnswer.Left);
        allow({ kind: "Allowed", origin: "https://new.example" });
        await vi.waitFor(() => expect(context.requests.some(t => t.method === BrowserMethods.allowTypedAddress)).toBe(true));
        expect([viewOf(tab).calls, tab.controller.status.refusedAddress]).toEqual([[], null]);
      });

      it("is left by each navigation the pane's controller starts, as Back, Forward and Reload, but not by its own typed load", async () => {
        const tab = await openAsync();
        const seen: EntryAnswer[] = [];
        for (const start of [() => tab.controller.goBackAsync(), () => tab.controller.goForwardAsync(), () => tab.controller.reloadAsync()]) {
          const going = pages.goToAsync(tab, "new.example");
          await start();
          seen.push(await going);
          allow({ kind: "Allowed", origin: "https://new.example" });
        }
        const kept = pages.goToAsync(tab, "kept.example");
        await vi.waitFor(() => expect(context.requests.filter(t => t.method === BrowserMethods.allowTypedAddress)).toHaveLength(4));
        allow({ kind: "Allowed", origin: "https://kept.example" });

        expect([seen, await kept, viewOf(tab).calls.filter(t => t.startsWith("navigate"))])
          .toEqual([[EntryAnswer.Left, EntryAnswer.Left, EntryAnswer.Left], EntryAnswer.Gone, ["navigate https://kept.example/"]]);
      });

      it("is left by a load in the pane that comes before its answer, and not by its own load once allowed", async () => {
        surface().script("https://kept.example/", { kind: "pending" });
        const tab = await openAsync();
        const view: FakeWebView = viewOf(tab);

        const left = pages.goToAsync(tab, "new.example");
        loading(view, "https://link.example/", true);
        expect(await left).toBe(EntryAnswer.Left);
        allow({ kind: "Allowed", origin: "https://new.example" });
        loading(view, "https://link.example/", false);

        const gone = pages.goToAsync(tab, "kept.example");
        await vi.waitFor(() => expect(context.requests.filter(t => t.method === BrowserMethods.allowTypedAddress)).toHaveLength(2));
        allow({ kind: "Allowed", origin: "https://kept.example" });

        expect([await gone, view.calls.filter(t => t.startsWith("navigate"))]).toEqual([EntryAnswer.Gone, ["navigate https://kept.example/"]]);
      });

      it("isn't left by a loading page's news, even its own redirect to another address, so it goes once allowed", async () => {
        const tab = await openAsync();
        const view: FakeWebView = viewOf(tab);
        loading(view, "https://slow.example/", true);

        const going = pages.goToAsync(tab, "new.example");
        loading(view, "https://slow.example/", true, "Slow");
        loading(view, "https://slow.example/next", true, "Slow");
        await vi.waitFor(() => expect(typedAddresses()).toHaveLength(1));
        allow({ kind: "Allowed", origin: "https://new.example" });

        expect([await going, view.calls.filter(t => t.startsWith("navigate"))]).toEqual([EntryAnswer.Gone, ["navigate https://new.example/"]]);
      });

      it("answers at once that the person left it when the runtime part's answer says an agent's call started on the page, and goes nowhere", async () => {
        const tab = await openAsync();

        const going = pages.goToAsync(tab, "new.example");
        await vi.waitFor(() => expect(typedAddresses()).toHaveLength(1));
        allow({ kind: "Left" });

        expect([await going, typedAddresses(), viewOf(tab).calls, tab.controller.status.refusedAddress])
          .toEqual([EntryAnswer.Left, [{ profileKey: "workspace-1", url: "https://new.example/", instance: tab.id }], [], null]);
      });

      it("logs a failure of its request that comes after the person left it, while one that came before goes to its caller alone", async () => {
        const failures: ((error: Error) => void)[] = [];
        context.answerRequest = (method, parameters) => method === BrowserMethods.allowTypedAddress
          ? new Promise<JsonValue>((_resolve, reject) => failures.push(reject))
          : declared(method, parameters);
        const tab = await openAsync();

        const failed = pages.goToAsync(tab, "first.example");
        await vi.waitFor(() => expect(failures).toHaveLength(1));
        failures[0]?.(new Error("The runtime part stopped."));
        const caught: unknown = await failed.catch((error: unknown) => error);
        pages.leaveEntry(tab);
        const left = pages.goToAsync(tab, "second.example");
        await vi.waitFor(() => expect(failures).toHaveLength(2));
        pages.leaveEntry(tab);
        const answer: EntryAnswer = await left;
        failures[1]?.(new TypeError("The runtime part stopped."));

        await vi.waitFor(() => expect(context.logs).toHaveLength(1));
        expect([caught, answer, context.logs]).toEqual([new Error("The runtime part stopped."), EntryAnswer.Left, ["A typed address the person left failed after it: TypeError."]]);
      });
    });

    it("answers that the page stayed for an earlier entry whose navigation Noldova Desktop refuses after a later entry went", async () => {
      surface().script("https://new.example/", { kind: "refuse" });
      const tab = await openAsync();
      const view: FakeWebView = viewOf(tab);
      const navigate: (url: string) => Promise<WebViewNavigation> = view.navigateAsync.bind(view);
      const held: (() => void)[] = [];
      view.navigateAsync = (url: string) => url !== "https://new.example/" ? navigate(url)
        : new Promise<WebViewNavigation>(resolve => held.push(() => resolve(navigate(url))));

      const first = pages.goToAsync(tab, "new.example");
      await vi.waitFor(() => expect(held).toHaveLength(1));
      expect(await pages.goToAsync(tab, "kept.example")).toBe(EntryAnswer.Gone);
      held.forEach(t => t());

      expect([await first, view.calls]).toEqual([EntryAnswer.Stayed, ["navigate https://kept.example/", "navigate https://new.example/"]]);
    });

    it("says so and rejects with the failure when the runtime part's request fails, and loads nothing", async () => {
      const failure: Error = new Error("The store is closed.");
      context.answerRequest = (method, parameters) => method === BrowserMethods.allowTypedAddress ? Promise.reject(failure) : declared(method, parameters);
      const tab = await openAsync();

      await expect(pages.goToAsync(tab, "example.com")).rejects.toBe(failure);

      expect([viewOf(tab).calls, tab.controller.status.refusedAddress]).toEqual([[], AddressRefusal.Failed]);
    });

    it("marks nothing when an earlier entry's request fails after a later one", async () => {
      let fail: () => void = () => undefined;
      context.answerRequest = (method, parameters) => {
        if (method !== BrowserMethods.allowTypedAddress)
          return declared(method, parameters);
        return urlOf(parameters) === "https://new.example/"
          ? new Promise<JsonValue>((_, reject) => fail = () => reject(new Error("The store is closed.")))
          : Promise.resolve({ kind: "Allowed", origin: "https://kept.example" });
      };
      const tab = await openAsync();

      const first = pages.goToAsync(tab, "new.example");
      expect(await pages.goToAsync(tab, "kept.example")).toBe(EntryAnswer.Gone);
      fail();

      await expect(first).rejects.toThrow("The store is closed.");
      expect([viewOf(tab).calls, tab.controller.status.refusedAddress]).toEqual([["navigate https://kept.example/"], null]);
    });
  });

  describe("openLinkAsync", () => {
    let answer: JsonValue;

    beforeEach(() => {
      answer = { kind: "Allowed", origin: "https://example.com" };
      context.answerRequest = (method, parameters) => method === BrowserMethods.allowTypedAddress ? Promise.resolve(answer) : declared(method, parameters);
    });

    it("allows the link's address on the links workspace, then opens it there in a new tab, which goes to it once it shows", async () => {
      await pages.openAsync("workspace-1", null, null);

      await pages.openLinkAsync("https://example.com/docs");
      const tab: PaneTab | null = await pages.showAsync(lastOpened());
      if (tab === null)
        throw new Error("The link's page didn't show.");
      await vi.waitFor(() => expect(viewOf(tab).calls).toEqual(["navigate https://example.com/docs"]));

      expect(requestsOf(BrowserMethods.allowTypedAddress)).toEqual([{ profileKey: "links", url: "https://example.com/docs" }]);
      expect(context.opened.map(t => [t.title, t.after])).toEqual([["New tab", null], ["https://example.com/docs", null]]);
      expect(surface().views.at(-1)?.profileKey).toBe("links");
    });

    it("rejects, opening nothing, when the runtime part refuses the address, so Noldova Desktop opens it in the system's browser", async () => {
      answer = { kind: "Refused", reason: "Local" };

      const opening: Promise<void> = pages.openLinkAsync("http://localhost:3000/");

      await expect(opening).rejects.toBeInstanceOf(LinkRefusedException);
      await expect(opening).rejects.toMatchObject({ name: "LinkRefusedException", reason: "Local" });
      expect(context.opened).toEqual([]);
    });

    it("rejects, opening nothing, when the runtime part's answer isn't one or its request fails", async () => {
      answer = { kind: "maybe" };
      await expect(pages.openLinkAsync("https://example.com/")).rejects.toThrow(TypedAddressAnswerMalformedException);
      context.answerRequest = () => Promise.reject(new Error("The store is closed."));

      await expect(pages.openLinkAsync("https://example.com/")).rejects.toThrow("The store is closed.");
      expect(context.opened).toEqual([]);
    });

    it("rejects, opening nothing, when the part deactivates while the runtime part answers", async () => {
      const { promise, resolve } = Promise.withResolvers<JsonValue>();
      context.answerRequest = () => promise;
      const opening: Promise<void> = pages.openLinkAsync("https://example.com/");
      pages.close();
      resolve(answer);

      await expect(opening).rejects.toThrow(PagesInactiveException);
      expect(context.opened).toEqual([]);
    });
  });
});
