/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
import { type CommandContribution, type DocumentContribution, type IDocumentMarker, type IDocumentUpdate, type IWindowPartContext, type LinkPlace,
  StatusBarItem } from "@noldova/desktop.window";
import { FakeWindowPartContext, type FakeWindowWebViews } from "@noldova/desktop.window/testing";
import { vi } from "vitest";

import { Resources } from "../../src/resources.ts";
import { FakeWebViews } from "./fake-web-views.fixture.ts";

export class OpenedDocument {
  public readonly name: string;
  public readonly instance: string;
  public readonly title: string;
  public readonly after: string | null;
  public readonly marker: IDocumentMarker | null;
  public readonly activate: boolean | undefined;
  public readonly imageGlyph: string | undefined;

  public constructor(name: string, instance: string, title: string, after: string | null, marker: IDocumentMarker | null, activate: boolean | undefined,
    imageGlyph: string | undefined) {
    this.name = name;
    this.instance = instance;
    this.title = title;
    this.after = after;
    this.marker = marker;
    this.activate = activate;
    this.imageGlyph = imageGlyph;
  }
}

export class TitleUpdate {
  public readonly instance: string;
  public readonly update: IDocumentUpdate;

  public constructor(instance: string, update: IDocumentUpdate) {
    this.instance = instance;
    this.update = update;
  }
}

export class WindowRequest {
  public readonly method: string;
  public readonly parameters: JsonValue;

  public constructor(method: string, parameters: JsonValue) {
    this.method = method;
    this.parameters = parameters;
  }
}

export class WindowContext extends FakeWindowPartContext {
  public static readonly appName: string = "Fixture App";
  private static readonly declaredMethods: ReadonlySet<string> = new Set<string>([
    "browser.allowTypedAddress", "browser.passTypedRedirect", "browser.endTypedRedirects", "browser.readyPage", "browser.rememberPage",
    "browser.readPage", "browser.forgetPage", "browser.clearBrowsingData", "browser.readAppName", "browser.stopPage", "browser.readActivities",
    "browser.claimPage", "browser.holdPages", "browser.letGoPage"
  ]);
  private static readonly declaredDocuments: ReadonlySet<string> = new Set<string>(["browser.page"]);
  private static readonly declaredCommands: ReadonlySet<string> = new Set<string>(["browser.openPage", "browser.newPage"]);
  private static readonly declaredMenuPlaces: ReadonlySet<string> = new Set<string>(["browser.pageTabRow"]);
  private static readonly declaredStatusBarItems: ReadonlySet<string> = new Set<string>(["browser.agentPages"]);
  private static readonly requestAnswers: ReadonlyMap<string, JsonValue> = new Map<string, JsonValue>([
    ["browser.readAppName", WindowContext.appName],
    ["browser.claimPage", { agentName: null, isClaimed: true, isHere: false, record: null }],
    ["browser.holdPages", { agents: [], refused: [] }],
    ["browser.readActivities", []],
    ["browser.readPage", null],
    ["browser.endTypedRedirects", null],
    ["browser.readyPage", null],
    ["browser.rememberPage", null],
    ["browser.forgetPage", null],
    ["browser.clearBrowsingData", null],
    ["browser.stopPage", null],
    ["browser.letGoPage", null]
  ]);
  private static readonly settingDefaults: ReadonlyMap<string, JsonValue> = new Map<string, JsonValue>([
    ["browser.linkClick", "InApp"],
    ["browser.linkMiddleClick", "Modified"],
    ["browser.systemSites", ""],
    ["browser.agentTools", true],
    ["browser.localSites", ""],
    ["browser.popupSites", ""]
  ]);
  public override readonly webViews: FakeWindowWebViews;
  public readonly views: FakeWebViews = new FakeWebViews();
  public readonly documents: DocumentContribution[] = [];
  public readonly commands: CommandContribution[] = [];
  public readonly statusBarItems: StatusBarItem[] = [];
  public readonly opened: OpenedDocument[] = [];
  public readonly closed: string[] = [];
  public readonly titles: TitleUpdate[] = [];
  public readonly requests: WindowRequest[] = [];
  public readonly logs: string[] = [];
  public readonly links: string[] = [];
  public readonly linkPlaces: (LinkPlace | undefined)[] = [];
  public readonly settings: Map<string, JsonValue> = new Map<string, JsonValue>();
  public openDocuments: readonly string[] | null | Error = [];
  public settingFailure: Error | null = null;
  public answerRequest: (method: string, parameters: JsonValue) => Promise<JsonValue> = t => WindowContext.answerDeclared(t);
  public inAppBrowser: Parameters<IWindowPartContext["registerInAppBrowser"]>[0] | null = null;
  public readonly settingChecks: Map<string, (value: string) => string | null> = new Map<string, (value: string) => string | null>();

  public constructor() {
    super();
    this.webViews = this.views.webViews;
    this.answer("registerDocument", t => {
      WindowContext.requireDeclared(t.name, WindowContext.declaredDocuments, this.documents);
      if (!Object.isNull(t.tabRowPlace) && !WindowContext.declaredMenuPlaces.has(t.tabRowPlace))
        throw new UnansweredCallException(t.tabRowPlace);
      this.documents.push(t);
    });
    this.answer("registerCommand", t => {
      WindowContext.requireDeclared(t.name, WindowContext.declaredCommands, this.commands);
      this.commands.push(t);
    });
    this.answer("registerStatusBarItem", t => {
      WindowContext.requireDeclared(t.name, WindowContext.declaredStatusBarItems, this.statusBarItems);
      const item: StatusBarItem = new StatusBarItem(t, state => {
        if (!Object.isNull(state.command) && !WindowContext.declaredCommands.has(state.command))
          throw new UnansweredCallException(state.command);
      });
      this.statusBarItems.push(item);
      return item;
    });
    this.answer("openDocument", (name, instance, title, options) =>
      void this.opened.push(new OpenedDocument(name, instance, title, options?.after ?? null, options?.marker ?? null, options?.activate,
        options?.imageGlyph)));
    this.answer("closeDocument", (_name, instance) => void this.closed.push(instance));
    this.answer("updateDocument", (_name, instance, update) => void this.titles.push(new TitleUpdate(instance, update)));
    this.answer("listOpenDocumentsAsync", () => this.openDocuments instanceof Error ? Promise.reject(this.openDocuments) : Promise.resolve(this.openDocuments));
    this.answer("log", t => void this.logs.push(t));
    this.answer("openLinkAsync", (t, options) => {
      this.links.push(t);
      this.linkPlaces.push(options?.place);
      return Promise.resolve();
    });
    this.answer("requestAsync", (method, parameters) => {
      this.requests.push(new WindowRequest(method, parameters));
      return WindowContext.declaredMethods.has(method) ? this.answerRequest(method, parameters) : Promise.reject(new UnansweredCallException(method));
    });
    this.answer("readSetting", t => {
      if (!WindowContext.settingDefaults.has(t))
        throw new UnansweredCallException(t);
      return this.settings.has(t) ? this.settings.get(t) : WindowContext.settingDefaults.get(t);
    });
    this.answer("writeSettingAsync", (name, value) => {
      if (!WindowContext.settingDefaults.has(name))
        return Promise.reject(new UnansweredCallException(name));
      if (!Object.isNull(this.settingFailure))
        return Promise.reject(this.settingFailure);
      this.settings.set(name, value);
      return Promise.resolve();
    });
    const context: FakeWindowPartContext = this;
    const registerInAppBrowser: IWindowPartContext["registerInAppBrowser"] = this.registerInAppBrowser;
    vi.spyOn(context, "registerInAppBrowser").mockImplementation(browser => {
      this.inAppBrowser = browser;
      const release: () => void = registerInAppBrowser(browser);
      return () => {
        if (this.inAppBrowser === browser)
          this.inAppBrowser = null;
        release();
      };
    });
    const provideSettingCheck: IWindowPartContext["provideSettingCheck"] = this.provideSettingCheck;
    vi.spyOn(context, "provideSettingCheck").mockImplementation((setting, check) => {
      this.settingChecks.set(setting, check);
      const release: () => void = provideSettingCheck(setting, check);
      return () => {
        this.settingChecks.delete(setting);
        release();
      };
    });
    this.beStrict();
    this.allow("markWorking", "onDocumentClosed", "onEvent", "provideSettingCheck", "registerInAppBrowser");
  }

  public get row(): string[] {
    const row: OpenedDocument[] = [];
    for (const opened of this.opened.filter((t, i) => this.opened.findIndex(u => u.instance === t.instance) === i)) {
      const index: number = row.findIndex(t => t.instance === opened.after);
      row.splice(index < 0 ? row.length : index + 1, 0, opened);
    }
    return row.map(t => t.title);
  }

  public get working(): readonly string[] {
    return this.activeCallsOf("markWorking").map(([, instance]) => String(instance));
  }

  public listenersOf(event: string): number {
    return this.activeCallsOf("onEvent").filter(([name]) => name === event).length;
  }

  public get closeListenerCount(): number {
    return this.activeCallsOf("onDocumentClosed").length;
  }

  public closeByPerson(instance: string): void {
    const before: number = this.errors.length;
    this.raiseDocumentClosed(Resources.pageDocument, instance);
    const thrown: readonly unknown[] = this.errors.slice(before);
    if (thrown.length > 0)
      throw new AggregateError(thrown, `A listener threw when the person closed ${instance}.`);
  }

  public emit(name: string, payload: JsonValue): void {
    this.raiseEvent(name, payload);
  }

  private static requireDeclared(name: string, declared: ReadonlySet<string>,
    registered: readonly (DocumentContribution | CommandContribution | StatusBarItem)[]): void {
    if (!declared.has(name) || registered.some(t => t.name === name))
      throw new UnansweredCallException(name);
  }

  private static answerDeclared(method: string): Promise<JsonValue> {
    const answer: JsonValue | undefined = WindowContext.requestAnswers.get(method);
    return Object.isUndefined(answer) ? Promise.reject(new UnansweredCallException(method)) : Promise.resolve(answer);
  }
}
