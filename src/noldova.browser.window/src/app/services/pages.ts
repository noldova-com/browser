/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, type WritableSignal, signal } from "@angular/core";
import { BrowserEvents, BrowserMethods, BrowsingDataRequest, type HeldPages, OpenPagesRequest, PageAction, type PageActivity, PageActivityState, type PageClaim,
  PageRecord, PageRequest, PageStopRequest, type TypedAddressAnswer, TypedAddressAnswerKind, TypedAddressRequest, TypedRedirectRequest } from "@noldova/browser.protocol";
import { QualifiedName, WebViewPane } from "@noldova/desktop.protocol";
import { DocumentTone, type IDocumentOptions, type IDocumentStatus, type IWebViewHandle, type IWindowPartContext } from "@noldova/desktop.window";
import type { JsonValue } from "@noldova/context.json";

import { Resources } from "../../resources.ts";
import { AddressRefusal } from "../enums/address-refusal.ts";
import { PaneState } from "../enums/pane-state.ts";
import { RefusedRequest } from "../enums/refused-request.ts";
import { LinkRefusedException } from "../exceptions/link-refused.exception.ts";
import { PageActivityEventMalformedException } from "../exceptions/page-activity-event-malformed.exception.ts";
import { PageInAnotherWindowException } from "../exceptions/page-in-another-window.exception.ts";
import { PageOnOtherWorkspaceException } from "../exceptions/page-on-other-workspace.exception.ts";
import { PagesInactiveException } from "../exceptions/pages-inactive.exception.ts";
import type { PaneStatus } from "../models/pane-status.ts";
import { PaneTab } from "../models/pane-tab.ts";
import { RefusedPage } from "../models/refused-page.ts";
import { TypedLoad } from "../models/typed-load.ts";
import type { ViewNewWindowEvent } from "../models/view-new-window-event.ts";
import type { ViewRefusalEvent } from "../models/view-refusal-event.ts";
import type { AddressReading } from "../types/address-reading.ts";
import type { PagePlace } from "../types/page-place.ts";
import { AddressReader } from "./address-reader.ts";
import { AgentPages } from "./agent-pages.ts";
import { PageAnswers } from "./page-answers.ts";

export class Pages {
  private static readonly registry: WeakMap<IWindowPartContext, Pages> = new WeakMap<IWindowPartContext, Pages>();
  private readonly context: IWindowPartContext;
  private readonly pending: Map<string, PagePlace> = new Map<string, PagePlace>();
  private readonly shown: Map<PaneTab, { readonly place: PagePlace; readonly stop: () => void }> = new Map<PaneTab, { readonly place: PagePlace; readonly stop: () => void }>();
  private readonly lastAsked: Map<string, string> = new Map<string, string>();
  private readonly entries: WeakMap<PaneTab, object> = new WeakMap<PaneTab, object>();
  private readonly typing: WeakMap<PaneTab, TypedLoad> = new WeakMap<PaneTab, TypedLoad>();
  private readonly passing: WeakSet<PaneTab> = new WeakSet<PaneTab>();
  private readonly name: WritableSignal<string | null> = signal(null);
  private readonly current: WritableSignal<ReadonlyMap<string, PageActivity>> = signal(new Map<string, PageActivity>());
  private readonly refused: WritableSignal<ReadonlyMap<string, RefusedPage>> = signal(new Map<string, RefusedPage>());
  private readonly heldElsewhere: WritableSignal<ReadonlySet<string>> = signal(new Set<string>());
  private readonly shownInstances: WritableSignal<ReadonlySet<string>> = signal(new Set<string>());
  private readonly opening: Map<string, boolean> = new Map<string, boolean>();
  private readonly firstLoads: Map<PaneTab, () => void> = new Map<PaneTab, () => void>();
  private readonly agentPages: AgentPages;
  private readonly stopActivities: () => void;
  private readonly stopClosing: () => void;
  private isClosed: boolean = false;
  private arriving: PageActivity[] | null = null;

  public readonly appName: Signal<string | null> = this.name.asReadonly();
  public readonly activities: Signal<ReadonlyMap<string, PageActivity>> = this.current.asReadonly();
  public readonly refusals: Signal<ReadonlyMap<string, RefusedPage>> = this.refused.asReadonly();
  public readonly elsewhere: Signal<ReadonlySet<string>> = this.heldElsewhere.asReadonly();

  public constructor(context: IWindowPartContext) {
    this.context = context;
    Pages.registry.set(context, this);
    this.agentPages = new AgentPages(context);
    this.stopActivities = context.onEvent(BrowserEvents.pageActivity, t => this.receiveActivity(t));
    this.stopClosing = context.onDocumentClosed(Resources.pageDocument, t => {
      this.markElsewhere(t, false);
      this.agentPages.closeTab(t);
      this.request(BrowserMethods.forgetPage, new PageRequest(t).toJson(), Resources.formatNotKept);
    });
    context.requestAsync(BrowserMethods.readAppName, null).then(t => this.name.set(PageAnswers.readAppName(t)))
      .catch((error: unknown) => context.log(Resources.formatNoAppName(error)));
  }

  public static of(context: IWindowPartContext): Pages {
    const pages: Pages | undefined = Pages.registry.get(context);
    if (pages === undefined)
      throw new PagesInactiveException();
    return pages;
  }

  public async openAsync(profileKey: string, url: string | null, picked: string | null): Promise<string> {
    if (picked === null || this.holds(picked))
      return this.open(profileKey, url, picked);
    const claim: PageClaim = PageAnswers.readClaim(await this.context.requestAsync(BrowserMethods.claimPage, new PageRequest(picked).toJson()));
    if (!claim.isClaimed)
      throw new PageInAnotherWindowException(picked);
    if (this.isClosed) {
      if (!claim.isHere)
        this.request(BrowserMethods.letGoPage, new PageRequest(picked).toJson(), Resources.formatNotLetGo);
      throw new PagesInactiveException();
    }
    const kept: PageRecord | null = claim.record;
    if (claim.isHere && kept !== null && kept.profileKey !== profileKey)
      throw new PageOnOtherWorkspaceException(picked, profileKey);
    const keptUrl: string | null = kept === null || kept.url === "" ? null : kept.url;
    let opened: string;
    try {
      opened = this.open(profileKey, url === null && kept?.profileKey === profileKey ? keptUrl : url, picked);
    }
    catch (error) {
      if (!claim.isHere)
        this.request(BrowserMethods.letGoPage, new PageRequest(picked).toJson(), Resources.formatNotLetGo);
      throw error;
    }
    if (claim.agentName !== null)
      this.agentPages.noteAgent(picked, claim.agentName);
    this.markElsewhere(picked, false);
    return opened;
  }

  public async reportOpenAsync(): Promise<boolean> {
    let open: readonly string[] | null;
    try {
      open = await this.context.listOpenDocumentsAsync(Resources.pageDocument);
    }
    catch (error) {
      this.context.log(Resources.formatOpenPagesNotRead(error));
      return false;
    }
    if (open === null || open.length === 0)
      return true;
    let held: HeldPages;
    try {
      held = PageAnswers.readHeldPages(await this.context.requestAsync(BrowserMethods.holdPages, new OpenPagesRequest([...open]).toJson()));
    }
    catch (error) {
      this.context.log(Resources.formatOpenPagesNotHeld(error));
      return false;
    }
    for (const instance of held.refused)
      this.yieldPage(instance);
    this.agentPages.openTabs(open.filter(t => !held.refused.includes(t)));
    for (const agent of held.agents)
      this.agentPages.noteAgent(agent.instance, agent.agentName);
    return true;
  }

  public async openLinkAsync(url: string): Promise<void> {
    const answer: TypedAddressAnswer = PageAnswers.readTypedAddress(await this.context.requestAsync(BrowserMethods.allowTypedAddress, new TypedAddressRequest(Resources.linkProfile, url).toJson()));
    if (answer.kind === TypedAddressAnswerKind.Refused)
      throw new LinkRefusedException(answer.reason);
    if (this.isClosed)
      throw new PagesInactiveException();
    this.open(Resources.linkProfile, url);
  }

  public open(profileKey: string, url: string | null, picked: string | null = null, opener: PaneTab | null = null): string {
    const instance: string = picked ?? crypto.randomUUID();
    const shown: [PaneTab, { readonly place: PagePlace }] | undefined = [...this.shown.entries()].find(t => t[0].id === instance);
    const place: PagePlace | undefined = shown === undefined ? this.pending.get(instance) : shown[1].place;
    if (place !== undefined) {
      if (place.profileKey !== profileKey)
        throw new PageOnOtherWorkspaceException(instance, profileKey);
      this.context.openDocument(Resources.pageDocument, instance, shown === undefined ? Resources.formatTabTitle(place.url) : shown[0].title);
      return instance;
    }
    this.pending.set(instance, { profileKey, url: url === null ? "" : url });
    try {
      this.context.openDocument(Resources.pageDocument, instance, url === null ? Resources.newTab : url, this.documentOptions(opener));
    }
    catch (error) {
      this.pending.delete(instance);
      throw error;
    }
    if (opener !== null)
      this.lastAsked.set(opener.id, instance);
    this.agentPages.openTabs([instance]);
    return instance;
  }

  public async showAsync(instance: string): Promise<PaneTab | null> {
    const opened: PagePlace | undefined = this.pending.get(instance);
    this.pending.delete(instance);
    if (opened !== undefined)
      return await this.openViewAsync(instance, opened);
    const claim: PageClaim = PageAnswers.readClaim(await this.context.requestAsync(BrowserMethods.claimPage, new PageRequest(instance).toJson()));
    if (claim.isClaimed) {
      this.agentPages.openTabs([instance]);
      if (claim.agentName !== null)
        this.agentPages.noteAgent(instance, claim.agentName);
      return await this.openViewAsync(instance, Pages.placeOf(claim.record));
    }
    if (await this.readAsync(instance) !== null)
      this.markElsewhere(instance, true);
    return null;
  }

  public async goToAsync(tab: PaneTab, text: string): Promise<boolean> {
    const place: PagePlace | undefined = this.shown.get(tab)?.place;
    if (place === undefined || tab.controller.status.state === PaneState.Unavailable)
      return false;
    const entry: object = {};
    this.entries.set(tab, entry);
    const isLatest = (): boolean => this.shown.has(tab) && tab.controller.status.state !== PaneState.Unavailable && this.entries.get(tab) === entry;
    const reading: AddressReading = AddressReader.read(text);
    if (reading.kind === TypedAddressAnswerKind.Refused) {
      tab.controller.refuseAddress(reading.reason);
      return false;
    }
    let answer: TypedAddressAnswer;
    try {
      answer = PageAnswers.readTypedAddress(await this.context.requestAsync(BrowserMethods.allowTypedAddress, new TypedAddressRequest(place.profileKey, reading.url).toJson()));
    } catch (error: unknown) {
      if (isLatest())
        tab.controller.refuseAddress(AddressRefusal.Failed);
      throw error;
    }
    if (!isLatest())
      return false;
    if (answer.kind === TypedAddressAnswerKind.Refused) {
      tab.controller.refuseAddress(answer.reason, new URL(reading.url).origin);
      return false;
    }
    const typing: TypedLoad = new TypedLoad(entry);
    this.typing.set(tab, typing);
    try {
      await tab.controller.navigateAsync(reading.url);
    }
    finally {
      this.endGoing(tab, place, typing);
    }
    return isLatest();
  }

  public openPopup(tab: PaneTab, url: string): void {
    const place: PagePlace | undefined = this.shown.get(tab)?.place;
    if (place !== undefined)
      this.open(place.profileKey, url, null, tab);
    tab.controller.dismissRequest();
  }

  public openNew(tab: PaneTab): void {
    const place: PagePlace | undefined = this.shown.get(tab)?.place;
    try {
      if (place !== undefined)
        this.open(place.profileKey, null);
    }
    catch (error) {
      this.context.log(Resources.formatNewPageNotOpened(error));
    }
  }

  public canOpenBeside(commandArguments: JsonValue): boolean {
    const instance: string | null = Pages.besideOf(commandArguments);
    return instance !== null && this.shownInstances().has(instance);
  }

  public openBeside(commandArguments: JsonValue): void {
    const instance: string | null = Pages.besideOf(commandArguments);
    const tab: PaneTab | undefined = [...this.shown.keys()].find(t => t.id === instance);
    if (tab !== undefined)
      this.openNew(tab);
  }

  public async clearBrowsingDataAsync(tab: PaneTab): Promise<void> {
    const place: PagePlace | undefined = this.shown.get(tab)?.place;
    if (place !== undefined)
      await this.context.requestAsync(BrowserMethods.clearBrowsingData, new BrowsingDataRequest(place.profileKey).toJson());
  }

  public stop(instance: string, isTakingOver: boolean): void {
    this.context.requestAsync(BrowserMethods.stopPage, new PageStopRequest(instance, isTakingOver).toJson()).catch((error: unknown) => this.context.log(Resources.formatNotStopped(error)));
  }

  public release(tab: PaneTab): void {
    const held: { readonly stop: () => void } | undefined = this.shown.get(tab);
    if (held === undefined)
      return;
    this.shown.delete(tab);
    this.noteShown();
    this.lastAsked.delete(tab.id);
    held.stop();
    this.stopFirstLoad(tab);
    tab.controller.close();
  }

  public close(): void {
    this.isClosed = true;
    Pages.registry.delete(this.context);
    for (const cancel of this.firstLoads.values())
      cancel();
    this.firstLoads.clear();
    this.pending.clear();
    this.stopActivities();
    this.stopClosing();
    this.current.set(new Map<string, PageActivity>());
    this.refused.set(new Map<string, RefusedPage>());
  }

  public async readActivitiesAsync(): Promise<boolean> {
    const arrived: PageActivity[] = [];
    this.arriving = arrived;
    let next: ReadonlyMap<string, PageActivity> = new Map<string, PageActivity>();
    let isRead: boolean = true;
    try {
      next = new Map<string, PageActivity>(PageAnswers.readActivities(await this.context.requestAsync(BrowserMethods.readActivities, null)).map(t => [t.instance, t]));
      for (const activity of next.values())
        this.agentPages.noteAgent(activity.instance, activity.agentName);
    }
    catch (error) {
      this.context.log(Resources.formatActivitiesNotRead(error));
      isRead = false;
    }
    finally {
      this.arriving = null;
    }
    this.current.set(arrived.reduce((shown, activity) => Pages.apply(shown, activity), next));
    return isRead;
  }

  public dismissRefusal(instance: string): void {
    if (!this.refused().has(instance))
      return;
    const next: Map<string, RefusedPage> = new Map<string, RefusedPage>(this.refused());
    next.delete(instance);
    this.refused.set(next);
  }

  private receiveActivity(payload: JsonValue): void {
    let activity: PageActivity;
    try {
      activity = PageAnswers.readActivity(payload);
    }
    catch (error) {
      if (!(error instanceof PageActivityEventMalformedException))
        throw error;
      this.context.log(Resources.formatActivityNotRead(error));
      return;
    }
    this.showActivity(activity);
  }

  private showActivity(activity: PageActivity): void {
    this.agentPages.noteAgent(activity.instance, activity.agentName);
    this.arriving?.push(activity);
    this.current.set(Pages.apply(this.current(), activity));
    const shown: [PaneTab, { readonly place: PagePlace }] | undefined = activity.state === PageActivityState.Idle ? undefined
      : [...this.shown].find(([t]) => t.id === activity.instance && this.typing.has(t));
    if (shown !== undefined)
      this.endTyping(shown[0], shown[1].place, false);
    if (activity.action === PageAction.Navigating && activity.state === PageActivityState.Acting)
      for (const tab of this.shown.keys())
        if (tab.id === activity.instance)
          tab.controller.followNavigation();
    if (activity.refusal !== null)
      this.refused.set(new Map<string, RefusedPage>(this.refused()).set(activity.instance, new RefusedPage(activity.agentName, activity.refusal.url, activity.refusal.origin)));
    const held: PaneTab | undefined = activity.state === PageActivityState.Ended && activity.isHandedOver ? [...this.shown.keys()].find(t => t.id === activity.instance) : undefined;
    if (held !== undefined)
      this.context.openDocument(Resources.pageDocument, activity.instance, held.title);
  }

  private noteShown(): void {
    this.shownInstances.set(new Set<string>([...this.shown.keys()].map(t => t.id)));
  }

  private static besideOf(commandArguments: JsonValue): string | null {
    return commandArguments === null ? Pages.focusedInstance() : Pages.instanceOf(commandArguments);
  }

  private static instanceOf(commandArguments: JsonValue): string | null {
    if (!PageAnswers.isObject(commandArguments))
      return null;
    const instance: JsonValue | undefined = commandArguments[Resources.instanceArgument];
    return commandArguments[Resources.documentArgument] === Resources.pageDocument && typeof instance === "string" ? instance : null;
  }

  private static focusedInstance(): string | null {
    return [...document.querySelectorAll(Resources.pageSelector)].find(t => t.contains(document.activeElement))?.getAttribute(Resources.pageInstanceAttribute) ?? null;
  }

  private documentOptions(opener: PaneTab | null): IDocumentOptions {
    if (opener !== null) {
      const last: string | undefined = this.lastAsked.get(opener.id);
      return { after: last !== undefined && this.holds(last) ? last : opener.id, marker: { glyph: Resources.openerGlyph, label: Resources.formatOpenedFrom(opener.title) } };
    }
    return {};
  }

  private static apply(shown: ReadonlyMap<string, PageActivity>, activity: PageActivity): ReadonlyMap<string, PageActivity> {
    if (activity.state === PageActivityState.Ended && shown.get(activity.instance)?.activity !== activity.activity)
      return shown;
    const next: Map<string, PageActivity> = new Map<string, PageActivity>(shown);
    if (activity.state === PageActivityState.Ended)
      next.delete(activity.instance);
    else
      next.set(activity.instance, activity);
    return next;
  }

  // Whether one of an agent's calls runs on the page, rather than the agent only keeping control of it between calls.
  private isCalledOn(instance: string): boolean {
    const state: PageActivityState | undefined = this.current().get(instance)?.state;
    return state !== undefined && state !== PageActivityState.Idle;
  }

  private holds(instance: string): boolean {
    return this.pending.has(instance) || [...this.shown.keys()].some(t => t.id === instance);
  }

  private yieldPage(instance: string): void {
    this.pending.delete(instance);
    this.agentPages.leaveTab(instance);
    if (this.opening.has(instance))
      this.opening.set(instance, true);
    for (const [tab, held] of this.shown) {
      if (tab.id !== instance)
        continue;
      this.shown.delete(tab);
      this.noteShown();
      held.stop();
      this.stopFirstLoad(tab);
      tab.controller.close();
      this.markElsewhere(instance, true);
    }
  }

  private markElsewhere(instance: string, isElsewhere: boolean): void {
    if (this.heldElsewhere().has(instance) === isElsewhere)
      return;
    const next: Set<string> = new Set<string>(this.heldElsewhere());
    if (isElsewhere)
      next.add(instance);
    else
      next.delete(instance);
    this.heldElsewhere.set(next);
  }

  private followRedirect(tab: PaneTab, place: PagePlace, event: ViewRefusalEvent): boolean {
    const typing: TypedLoad | undefined = this.typing.get(tab);
    if (typing === undefined || this.entries.get(tab) !== typing.entry || this.isCalledOn(tab.id) || typing.hops >= Resources.redirectLimit) {
      this.endTyping(tab, place);
      return false;
    }
    typing.follow();
    this.goOnAsync(tab, place, typing, event)
      .catch((error: unknown) => this.context.log(Resources.formatRedirectNotFollowed(error)))
      .finally(() => this.endGoing(tab, place, typing));
    return true;
  }

  private async goOnAsync(tab: PaneTab, place: PagePlace, typing: TypedLoad, event: ViewRefusalEvent): Promise<void> {
    const isLatest = (): boolean => this.shown.has(tab) && tab.controller.status.state !== PaneState.Unavailable && this.typing.get(tab) === typing;
    let answer: TypedAddressAnswer;
    this.passing.add(tab);
    try {
      answer = PageAnswers.readTypedAddress(await this.context.requestAsync(BrowserMethods.passTypedRedirect, new TypedRedirectRequest(tab.id, place.profileKey, event.address).toJson()));
    } catch (error: unknown) {
      if (isLatest())
        this.refuseRedirect(tab, place, event);
      throw error;
    }
    if (!isLatest())
      return;
    if (answer.kind === TypedAddressAnswerKind.Refused) {
      this.refuseRedirect(tab, place, event);
      return;
    }
    await tab.controller.navigateAsync(event.address);
  }

  private refuseRedirect(tab: PaneTab, place: PagePlace, event: ViewRefusalEvent): void {
    tab.controller.refuseNavigation(event.origin);
    this.endTyping(tab, place);
  }

  private endGoing(tab: PaneTab, place: PagePlace, typing: TypedLoad): void {
    typing.answer();
    if (typing.isAnswered && this.typing.get(tab) === typing && tab.controller.status.state !== PaneState.Loading)
      this.endTyping(tab, place);
  }

  private endTyping(tab: PaneTab, place: PagePlace, mayJoin: boolean = true): void {
    this.typing.delete(tab);
    if (!this.passing.delete(tab))
      return;
    const status: PaneStatus = tab.controller.status;
    const isLanded: boolean = mayJoin && status.state === PaneState.Loaded && !this.isCalledOn(tab.id);
    const log = (error: unknown): void => this.context.log(Resources.formatRedirectsNotEnded(error));
    const landing: Promise<unknown> = isLanded ? this.context.requestAsync(BrowserMethods.allowTypedAddress, new TypedAddressRequest(place.profileKey, status.url).toJson()) : Promise.resolve();
    landing.catch(log).then(() => this.context.requestAsync(BrowserMethods.endTypedRedirects, new PageRequest(tab.id).toJson())).catch(log);
  }

  private async openViewAsync(instance: string, place: PagePlace | null): Promise<PaneTab | null> {
    if (place === null || this.isClosed)
      return null;
    const pane: WebViewPane = new WebViewPane(QualifiedName.parse(Resources.pageDocument), instance);
    this.opening.set(instance, false);
    const view: IWebViewHandle | null = await this.context.webViews.openAsync(pane, place.profileKey).catch((error: unknown) => {
      this.context.log(Resources.formatViewNotOpened(error));
      return null;
    });
    const isTaken: boolean = this.opening.get(instance) === true;
    this.opening.delete(instance);
    const tab: PaneTab = new PaneTab(instance, view);
    if (this.isClosed || isTaken) {
      tab.controller.close();
      if (isTaken)
        this.markElsewhere(instance, true);
      return null;
    }
    this.shown.set(tab, { place, stop: this.follow(tab, place) });
    this.noteShown();
    if (place.url !== "" && view !== null)
      this.goFirst(tab, place.url);
    return tab;
  }

  private goFirst(tab: PaneTab, url: string): void {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cancel = (): void => clearTimeout(timer);
    const isWaiting = (): boolean => this.firstLoads.get(tab) === cancel;
    this.firstLoads.set(tab, cancel);
    const late: Promise<void> = new Promise<void>(resolve => {
      timer = setTimeout(() => {
        this.context.log(Resources.notReadyInTime);
        resolve();
      }, Resources.readyPageLimitMilliseconds);
    });
    const ready: Promise<void> = this.context.requestAsync(BrowserMethods.readyPage, new PageRequest(tab.id).toJson())
      .then(() => undefined, (error: unknown) => {
        if (isWaiting())
          this.context.log(Resources.formatNotReady(error));
      });
    Promise.race([ready, late])
      .then(() => {
        if (!isWaiting())
          return undefined;
        cancel();
        this.firstLoads.delete(tab);
        return tab.controller.navigateAsync(url);
      })
      .catch((error: unknown) => this.context.log(Resources.formatNotOpened(error)));
  }

  private stopFirstLoad(tab: PaneTab): void {
    this.firstLoads.get(tab)?.();
    this.firstLoads.delete(tab);
  }

  private async readAsync(instance: string): Promise<PagePlace | null> {
    return Pages.placeOf(PageAnswers.readRecord(await this.context.requestAsync(BrowserMethods.readPage, new PageRequest(instance).toJson())));
  }

  private static statusOf(state: PaneStatus): IDocumentStatus | null {
    switch (state.state) {
      case PaneState.Failed:
        return { glyph: Resources.pageErrorGlyph, description: Resources.formatPageStateText(state).heading, tone: DocumentTone.Failed };
      case PaneState.Refused:
        return { glyph: Resources.pageBlockedGlyph, description: Resources.formatPageStateText(state).heading, tone: DocumentTone.Neutral };
      default:
        return null;
    }
  }

  private static placeOf(record: PageRecord | null): PagePlace | null {
    return record === null ? null : { profileKey: record.profileKey, url: record.url };
  }

  private follow(tab: PaneTab, place: PagePlace): () => void {
    let title: string = "";
    let openedAt: number = Number.NEGATIVE_INFINITY;
    let url: string = place.url;
    let clearWorking: (() => void) | null = null;
    let shownStatus: IDocumentStatus | null = null;
    this.request(BrowserMethods.rememberPage, new PageRecord(tab.id, place.profileKey, url).toJson(), Resources.formatNotKept);
    const stopStatus: () => void = tab.controller.onChange(status => {
      if (status.state !== PaneState.Loading && this.typing.get(tab)?.isAnswered === true)
        this.endTyping(tab, place);
      if (status.state === PaneState.Loading)
        this.dismissRefusal(tab.id);
      if (status.state === PaneState.Loading && clearWorking === null)
        clearWorking = this.context.markWorking(Resources.pageDocument, tab.id);
      else if (status.state !== PaneState.Loading && clearWorking !== null) {
        clearWorking();
        clearWorking = null;
      }
      if (tab.title !== title) {
        title = tab.title;
        this.context.updateDocument(Resources.pageDocument, tab.id, { title });
      }
      const next: IDocumentStatus | null = Pages.statusOf(status);
      if (next?.description !== shownStatus?.description) {
        shownStatus = next;
        this.context.updateDocument(Resources.pageDocument, tab.id, { status: next });
      }
      if (status.url !== url && status.url !== "") {
        url = status.url;
        this.request(BrowserMethods.rememberPage, new PageRecord(tab.id, place.profileKey, url).toJson(), Resources.formatNotKept);
      }
    });
    const stopWindows: () => void = tab.controller.onNewWindow((event: ViewNewWindowEvent) => {
      if (event.hadRecentInput && Date.now() - openedAt >= Resources.recentInputMilliseconds) {
        try {
          this.open(place.profileKey, event.address, null, tab);
          openedAt = Date.now();
        }
        catch (error) {
          this.context.log(Resources.formatNewWindowNotOpened(error));
          tab.controller.refuseRequest(RefusedRequest.NewWindow, event.address);
        }
      }
      else
        tab.controller.offerPopup(event.address, event.origin, event.hadRecentInput);
    });
    const stopRedirects: () => void = tab.controller.onRefusedRedirect(event => this.followRedirect(tab, place, event));
    return () => {
      stopStatus();
      stopWindows();
      stopRedirects();
      clearWorking?.();
    };
  }

  private request(method: string, parameters: JsonValue, formatFailure: (error: unknown) => string): void {
    this.context.requestAsync(method, parameters).catch((error: unknown) => this.context.log(formatFailure(error)));
  }
}
