/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ElectronApplication } from "playwright/test";

interface ITargetInfo {
  targetId: string;
  type: string;
  url: string;
}

interface IAccessibilityValue {
  value?: unknown;
}

interface IAccessibilityNode {
  ignored?: boolean;
  role?: IAccessibilityValue;
  name?: IAccessibilityValue;
}

interface IRoleNameRecord {
  role: string;
  name: string;
}

interface IAccessibilityTree {
  nodes: IAccessibilityNode[];
}

interface ITargets {
  targetInfos: ITargetInfo[];
}

interface IAttachToTarget {
  targetId: string;
  flatten: boolean;
}

interface IAttachedTarget {
  sessionId: string;
}

interface IDetachFromTarget {
  sessionId: string;
}

interface IRuntimeEvaluate {
  expression: string;
  returnByValue: boolean;
}

interface IRemoteObject {
  value?: unknown;
}

interface IRuntimeEvaluated {
  result: IRemoteObject;
}

interface IViewDebugger {
  sendCommand(method: "Accessibility.getFullAXTree"): Promise<IAccessibilityTree>;
  sendCommand(method: "Target.getTargets"): Promise<ITargets>;
  sendCommand(method: "Target.attachToTarget", params: IAttachToTarget): Promise<IAttachedTarget>;
  sendCommand(method: "Target.detachFromTarget", params: IDetachFromTarget): Promise<unknown>;
  sendCommand(method: "Runtime.evaluate", params: IRuntimeEvaluate, sessionId: string): Promise<IRuntimeEvaluated>;
  sendCommand(method: string, ...rest: unknown[]): Promise<unknown>;
  // The commands sent since `watchCommandsAtAsync` that have no answer yet, by the number of each in the order sent.
  pendingCommands?: Map<number, string>;
  on(event: "message", listener: (event: unknown, method: string) => void): void;
  removeListener(event: "message", listener: (event: unknown, method: string) => void): void;
}

interface IViewCookieFilter {
  readonly url: string;
}

interface IViewCookie {
  readonly name: string;
}

interface IViewCookies {
  get(filter: IViewCookieFilter): Promise<IViewCookie[]>;
}

interface IViewProtocol {
  isProtocolHandled(scheme: string): boolean;
}

interface IViewSession {
  readonly cookies: IViewCookies;
  readonly protocol: IViewProtocol;
  getStoragePath(): string | null;
}

interface IViewChooserSession {
  on(event: "select-usb-device" | "select-serial-port" | "select-hid-device", listener: () => void): void;
}

interface IViewNavigationStart {
  readonly url: string;
  readonly isMainFrame: boolean;
  readonly isSameDocument: boolean;
}

interface IViewFrame {
  readonly url: string;
  readonly parent: IViewFrame | null;
  readonly framesInSubtree: IViewFrame[];
  executeJavaScript(code: string): Promise<unknown>;
}

interface IViewHistoryEntry {
  readonly pageState?: string;
}

interface IViewHistory {
  canGoBack(): boolean;
  getActiveIndex(): number;
  getAllEntries(): readonly IViewHistoryEntry[];
}

interface IViewKeyEvent {
  readonly type: "keyDown" | "keyUp";
  readonly keyCode: string;
  readonly modifiers: string[];
}

interface IViewRendererGone {
  readonly reason: string;
}

interface IViewDeviceChoice {
  preventDefault(): void;
}

interface IViewPageContents {
  readonly id: number;
  readonly mainFrame: IViewFrame;
  getType(): string;
  readonly session: IViewSession;
  readonly debugger: IViewDebugger;
  getURL(): string;
  getTitle(): string;
  isLoading(): boolean;
  readonly navigationHistory: IViewHistory;
  executeJavaScript(code: string, userGesture: boolean): Promise<unknown>;
  getOSProcessId(): number;
  isCrashed(): boolean;
  sendInputEvent(event: IViewKeyEvent): void;
  on(event: "did-navigate", listener: (event: unknown, url: string) => void): void;
  on(event: "did-frame-navigate", listener: (event: unknown, url: string, code: number, status: string, isMainFrame: boolean, processId: number) => void): void;
  on(event: "did-fail-load", listener: (event: unknown, code: number, description: string, url: string, isMainFrame: boolean) => void): void;
  on(event: "render-process-gone", listener: (event: unknown, details: IViewRendererGone) => void): void;
  on(event: "did-start-navigation", listener: (details: IViewNavigationStart) => void): void;
  on(event: "destroyed", listener: () => void): void;
  on(event: "did-fail-provisional-load", listener: () => void): void;
  removeListener(event: "did-start-navigation" | "did-frame-navigate" | "did-fail-provisional-load" | "destroyed", listener: (...rest: never[]) => void): void;
  emit(event: "select-bluetooth-device", details: IViewDeviceChoice, devices: readonly IBluetoothDevice[], choose: (deviceId: string) => void): boolean;
}

interface IBluetoothDevice {
  readonly deviceId: string;
  readonly deviceName: string;
}

interface IAppWindow {
  readonly webContents: IViewPageContents;
}

interface IAppSurfacesRecord {
  windows: number;
  contents: string[];
}

interface IViewSessionRecord {
  url: string;
  storagePath: string | null;
  isDefault: boolean;
  isWindows: boolean;
}

interface IProtocolHandlersRecord {
  views: boolean[];
  windows: boolean[];
}

interface IBluetoothChoiceRecord {
  url: string;
  isTaken: boolean;
  deviceIds: string[];
}

interface IDownloadSessionRecord {
  url: string;
  isDownloading: boolean;
}

interface IChildTargetRecord {
  sessionId: string;
  url: string;
}

interface ICookieRequest {
  pageUrl: string;
  url: string;
}

interface IPageStateRequest {
  url: string;
  text: string;
}

interface IScriptRequest {
  url: string;
  code: string;
}

interface IKeyRequest {
  url: string;
  keyCode: string;
  modifiers: readonly string[];
}

interface IViewPageRecord {
  url: string;
  title: string;
  isLoading: boolean;
}

export class ViewPage {
  public readonly url: string;
  public readonly title: string;
  public readonly isLoading: boolean;

  public constructor(url: string, title: string, isLoading: boolean = false) {
    this.url = url;
    this.title = title;
    this.isLoading = isLoading;
  }
}

export class AppSurfaces {
  public readonly windows: number;
  public readonly contents: readonly string[];

  public constructor(windows: number, contents: readonly string[]) {
    this.windows = windows;
    this.contents = contents;
  }
}

export class ViewSession {
  public readonly url: string;
  public readonly storagePath: string | null;
  public readonly isDefault: boolean;
  public readonly isWindows: boolean;

  public constructor(url: string, storagePath: string | null, isDefault: boolean, isWindows: boolean) {
    this.url = url;
    this.storagePath = storagePath;
    this.isDefault = isDefault;
    this.isWindows = isWindows;
  }
}

export class ProtocolHandlers {
  public readonly views: readonly boolean[];
  public readonly windows: readonly boolean[];

  public constructor(views: readonly boolean[], windows: readonly boolean[]) {
    this.views = views;
    this.windows = windows;
  }
}

export class RoleName {
  public readonly role: string;
  public readonly name: string;

  public constructor(role: string, name: string) {
    this.role = role;
    this.name = name;
  }
}

export class BluetoothChoice {
  public readonly url: string;
  public readonly isTaken: boolean;
  public readonly deviceIds: readonly string[];

  public constructor(url: string, isTaken: boolean, deviceIds: readonly string[]) {
    this.url = url;
    this.isTaken = isTaken;
    this.deviceIds = deviceIds;
  }
}

export class DownloadSession {
  public readonly url: string;
  public readonly isDownloading: boolean;

  public constructor(url: string, isDownloading: boolean) {
    this.url = url;
    this.isDownloading = isDownloading;
  }
}

export class ChildTarget {
  public readonly sessionId: string;
  public readonly url: string;

  public constructor(sessionId: string, url: string) {
    this.sessionId = sessionId;
    this.url = url;
  }
}

export class ViewPages {
  private readonly application: ElectronApplication;

  private constructor(application: ElectronApplication) {
    this.application = application;
  }

  public static async watchAsync(application: ElectronApplication): Promise<ViewPages> {
    await application.evaluate(({ app }) => {
      const commits: string[] = [];
      const frameCommits: string[] = [];
      const choosers: string[] = [];
      const log: string[] = [];
      const watched = new WeakSet<object>();
      globalThis.noldovaViewCommits = commits;
      globalThis.noldovaViewFrameCommits = frameCommits;
      globalThis.noldovaViewChoosers = choosers;
      globalThis.noldovaViewLog = log;
      app.on("web-contents-created", (_event: unknown, contents: IViewPageContents & { readonly session: IViewChooserSession }) => {
        if (contents.getType() !== "webview")
          return;
        const note = (text: string): void => {
          log.push(`${new Date().toISOString()} view ${contents.id} ${text}`);
        };
        note("created");
        contents.on("did-start-navigation", (details: IViewNavigationStart) => note(`starts ${details.url}${details.isMainFrame ? "" : " in a frame"}${details.isSameDocument ? " in the same document" : ""}`));
        contents.on("did-frame-navigate", (_navigated: unknown, url: string, code: number, _status: string, isMainFrame: boolean, processId: number) =>
          note(`commits ${url} ${String(code)}${isMainFrame ? "" : " in a frame"} in process ${String(processId)}`));
        contents.on("did-fail-load", (_failed: unknown, code: number, description: string, url: string, isMainFrame: boolean) =>
          note(`fails ${url} ${String(code)} ${description}${isMainFrame ? "" : " in a frame"}`));
        contents.on("render-process-gone", (_gone: unknown, details: IViewRendererGone) => note(`renderer gone, ${details.reason}`));
        contents.on("destroyed", () => note("destroyed"));
        if (!watched.has(contents.session)) {
          watched.add(contents.session);
          for (const name of ["select-usb-device", "select-serial-port", "select-hid-device"] as const)
            contents.session.on(name, () => {
              choosers.push(name);
            });
        }
        contents.on("did-navigate", (_navigated: unknown, url: string) => {
          commits.push(url);
        });
        contents.on("did-frame-navigate", (_navigated: unknown, url: string, _code: number, _status: string, isMainFrame: boolean) => {
          if (!isMainFrame)
            frameCommits.push(url);
        });
      });
    });
    return new ViewPages(application);
  }

  // The views' creations, navigation starts, commits with their frame's process, failed loads, ended renderers and destructions, each with
  // its time, for a failed test's attachment.
  public async takeLogAsync(): Promise<readonly string[]> {
    return this.application.evaluate(() => globalThis.noldovaViewLog?.splice(0) ?? []);
  }

  // The same lines, left in the log, so a test can wait for one an event writes.
  public async readLogAsync(): Promise<readonly string[]> {
    return this.application.evaluate(() => [...globalThis.noldovaViewLog ?? []]);
  }

  public async listAsync(): Promise<readonly ViewPage[]> {
    const records = await this.application.evaluate(({ webContents }): IViewPageRecord[] => {
      const views: IViewPageContents[] = webContents.getAllWebContents().filter((t: IViewPageContents) => t.getType() === "webview");
      return views.map(t => ({ url: t.getURL(), title: t.getTitle(), isLoading: t.isLoading() }));
    });
    return records.map(t => new ViewPage(t.url, t.title, t.isLoading));
  }

  public async surfacesAsync(): Promise<AppSurfaces> {
    const surfaces = await this.application.evaluate(({ BrowserWindow, webContents }): IAppSurfacesRecord => ({
      windows: BrowserWindow.getAllWindows().length,
      contents: webContents.getAllWebContents().map((t: IViewPageContents) => t.getType()).sort()
    }));
    return new AppSurfaces(surfaces.windows, surfaces.contents);
  }

  public async sessionsAsync(): Promise<readonly ViewSession[]> {
    const sessions = await this.application.evaluate(({ BrowserWindow, session, webContents }): IViewSessionRecord[] => {
      const windows: IViewSession[] = BrowserWindow.getAllWindows().map((t: IAppWindow) => t.webContents.session);
      const views: IViewPageContents[] = webContents.getAllWebContents().filter((t: IViewPageContents) => t.getType() === "webview");
      return views.map(t => ({ url: t.getURL(), storagePath: t.session.getStoragePath(), isDefault: t.session === session.defaultSession, isWindows: windows.includes(t.session) }));
    });
    return sessions.map(t => new ViewSession(t.url, t.storagePath, t.isDefault, t.isWindows));
  }

  public async viewCookiesAsync(pageUrl: string, url: string): Promise<readonly string[]> {
    return this.application.evaluate(async ({ webContents }, request: ICookieRequest): Promise<string[]> => {
      const views: IViewPageContents[] = webContents.getAllWebContents().filter((t: IViewPageContents) => t.getType() === "webview" && t.getURL() === request.pageUrl);
      const [view] = views;
      if (views.length !== 1 || view === undefined)
        throw new Error(`The app has ${views.length} views at ${request.pageUrl}, not one.`);
      return (await view.session.cookies.get({ url: request.url })).map(t => t.name);
    }, { pageUrl, url });
  }

  public async appCookiesAsync(url: string): Promise<readonly string[]> {
    return this.application.evaluate(async ({ BrowserWindow, session }, href: string): Promise<string[]> => {
      const sessions: IViewSession[] = [session.defaultSession, ...BrowserWindow.getAllWindows().map((t: IAppWindow) => t.webContents.session)];
      return (await Promise.all(sessions.map(t => t.cookies.get({ url: href })))).flat().map(t => t.name);
    }, url);
  }

  public async protocolHandlersAsync(scheme: string): Promise<ProtocolHandlers> {
    const handlers = await this.application.evaluate(({ BrowserWindow, webContents }, name: string): IProtocolHandlersRecord => {
      const views: IViewPageContents[] = webContents.getAllWebContents().filter((t: IViewPageContents) => t.getType() === "webview");
      return {
        views: views.map(t => t.session.protocol.isProtocolHandled(name)),
        windows: BrowserWindow.getAllWindows().map((t: IAppWindow) => t.webContents.session.protocol.isProtocolHandled(name))
      };
    }, scheme);
    return new ProtocolHandlers(handlers.views, handlers.windows);
  }

  public async downloadsFolderAsync(): Promise<string> {
    return this.application.evaluate(({ app }): string => app.getPath("downloads"));
  }

  // Offers each view a Bluetooth device, as the engine does when a page asks for one, and gives each view's address, whether its contents
  // took the choice from the engine, and the device ids it chose.
  public async bluetoothChoicesAsync(): Promise<readonly BluetoothChoice[]> {
    const choices = await this.application.evaluate(({ webContents }): IBluetoothChoiceRecord[] => webContents.getAllWebContents()
      .filter((t: IViewPageContents) => t.getType() === "webview")
      .map((t: IViewPageContents): IBluetoothChoiceRecord => {
        const chosen: string[] = [];
        let isTaken = false;
        t.emit("select-bluetooth-device", { preventDefault: (): void => { isTaken = true; } }, [{ deviceId: "AA:BB:CC:DD:EE:FF", deviceName: "Headphones" }],
          (deviceId: string) => chosen.push(deviceId));
        return { url: t.getURL(), isTaken, deviceIds: chosen };
      }));
    return choices.map(t => new BluetoothChoice(t.url, t.isTaken, t.deviceIds));
  }

  public async downloadSessionsAsync(): Promise<readonly DownloadSession[]> {
    const sessions = await this.application.evaluate(({ webContents }): IDownloadSessionRecord[] => webContents.getAllWebContents()
      .filter((t: IViewPageContents) => t.getType() === "webview")
      .map((t: IViewPageContents): IDownloadSessionRecord => ({ url: t.getURL(), isDownloading: globalThis.noldovaDownloadSessions?.has(t.session) === true })));
    return sessions.map(t => new DownloadSession(t.url, t.isDownloading));
  }

  public async takeChoosersAsync(): Promise<readonly string[]> {
    return this.application.evaluate(() => globalThis.noldovaViewChoosers?.splice(0) ?? []);
  }

  public async takeCommitsAsync(): Promise<readonly string[]> {
    return this.application.evaluate(() => globalThis.noldovaViewCommits?.splice(0) ?? []);
  }

  public async takeFrameCommitsAsync(): Promise<readonly string[]> {
    return this.application.evaluate(() => globalThis.noldovaViewFrameCommits?.splice(0) ?? []);
  }

  public async canGoBackAsync(): Promise<boolean> {
    return this.application.evaluate(({ webContents }): boolean => {
      const views: IViewPageContents[] = webContents.getAllWebContents().filter((t: IViewPageContents) => t.getType() === "webview");
      const [view] = views;
      if (views.length !== 1 || view === undefined)
        throw new Error(`The app has ${views.length} views, not one.`);
      return view.navigationHistory.canGoBack();
    });
  }

  // Whether the state the view's page last committed to its history holds the text, as a form field's typed value, which the page
  // commits about a second after the change; Noldova Desktop restores a moved view's page from that state.
  public async holdsPageStateAsync(url: string, text: string): Promise<boolean> {
    return this.application.evaluate(({ webContents }, request: IPageStateRequest): boolean => {
      const view: IViewPageContents | undefined = webContents.getAllWebContents().find((t: IViewPageContents) => t.getType() === "webview" && t.getURL() === request.url);
      const state: string | undefined = view?.navigationHistory.getAllEntries()[view.navigationHistory.getActiveIndex()]?.pageState;
      return state !== undefined && Buffer.from(state, "base64").includes(Buffer.from(request.text, "utf16le"));
    }, { url, text });
  }

  public async attachChildAsync(url: string): Promise<ChildTarget> {
    const child = await this.application.evaluate(async ({ webContents }, frameUrl: string): Promise<IChildTargetRecord> => {
      const views: IViewPageContents[] = webContents.getAllWebContents().filter((t: IViewPageContents) => t.getType() === "webview");
      const [view] = views;
      if (views.length !== 1 || view === undefined)
        throw new Error(`The app has ${views.length} views, not one.`);
      const { targetInfos } = await view.debugger.sendCommand("Target.getTargets");
      const target = targetInfos.find(t => t.type === "iframe" && t.url === frameUrl);
      if (target === undefined)
        throw new Error(`The view has no child target at ${frameUrl}.`);
      const { sessionId } = await view.debugger.sendCommand("Target.attachToTarget", { targetId: target.targetId, flatten: true });
      const { result } = await view.debugger.sendCommand("Runtime.evaluate", { expression: "location.href", returnByValue: true }, sessionId);
      return { sessionId, url: String(result.value) };
    }, url);
    return new ChildTarget(child.sessionId, child.url);
  }

  public async detachChildAsync(sessionId: string): Promise<void> {
    await this.application.evaluate(async ({ webContents }, id: string): Promise<void> => {
      const views: IViewPageContents[] = webContents.getAllWebContents().filter((t: IViewPageContents) => t.getType() === "webview");
      const [view] = views;
      if (views.length !== 1 || view === undefined)
        throw new Error(`The app has ${views.length} views, not one.`);
      await view.debugger.sendCommand("Target.detachFromTarget", { sessionId: id });
    }, sessionId);
  }

  public async runAtAsync(url: string, script: string): Promise<string> {
    return this.application.evaluate(async ({ webContents }, request: IScriptRequest): Promise<string> => {
      const views: IViewPageContents[] = webContents.getAllWebContents().filter((t: IViewPageContents) => t.getType() === "webview" && t.getURL() === request.url);
      const [view] = views;
      if (views.length !== 1 || view === undefined)
        throw new Error(`The app has ${views.length} views at ${request.url}, not one.`);
      // Electron's executeJavaScript never answers when its view is destroyed during the call, as a move between groups destroys the moved
      // page's old view.
      return new Promise<string>((resolve, reject) => {
        const closed = (): void => reject(new Error(`The view at ${request.url} closed.`));
        view.on("destroyed", closed);
        view.executeJavaScript(request.code, true).then(t => resolve(String(t)), reject).finally(() => view.removeListener("destroyed", closed));
      });
    }, { url, code: script });
  }

  // The text each frame inside the view at the URL shows, in the frames' order; a frame whose text can't be read gives its error.
  public async frameTextsAsync(url: string): Promise<readonly string[]> {
    return this.frameResultsAsync(url, "document.body?.innerText ?? \"\"");
  }

  // What the script gives in each frame inside the view at the URL, in the frames' order, as text; a frame whose result can't be read
  // gives its error.
  public async frameResultsAsync(url: string, script: string): Promise<readonly string[]> {
    return this.application.evaluate(async ({ webContents }, request: IScriptRequest): Promise<string[]> => {
      const views: IViewPageContents[] = webContents.getAllWebContents().filter((t: IViewPageContents) => t.getType() === "webview" && t.getURL() === request.url);
      // Electron's executeJavaScript on a frame never answers when the frame's document is replaced or removed during the call: a
      // committed navigation, a failed one, which commits its error page without a frame navigation, and a removal, which only the
      // view's debugger reports, since Desktop enables its Page domain. Each of those and the view's end make each read still open
      // unreadable, and a poll reads again.
      const readAsync = async (view: IViewPageContents, frame: IViewFrame): Promise<string> => new Promise<string>(resolve => {
        const finish = (text: string): void => {
          view.removeListener("did-start-navigation", started);
          view.removeListener("did-frame-navigate", committed);
          view.removeListener("did-fail-provisional-load", failed);
          view.removeListener("destroyed", closed);
          view.debugger.removeListener("message", removed);
          resolve(text);
        };
        const started = (details: IViewNavigationStart): void => {
          if (!details.isSameDocument)
            finish(`unreadable: the view started ${details.url}`);
        };
        const committed = (): void => finish("unreadable: a frame in the view navigated");
        const failed = (): void => finish("unreadable: a frame in the view failed to load");
        const closed = (): void => finish("unreadable: the view closed");
        const removed = (_event: unknown, method: string): void => {
          if (method === "Page.frameDetached")
            finish("unreadable: a frame in the view was removed");
        };
        view.on("did-start-navigation", started);
        view.on("did-frame-navigate", committed);
        view.on("did-fail-provisional-load", failed);
        view.on("destroyed", closed);
        view.debugger.on("message", removed);
        frame.executeJavaScript(request.code).then(t => finish(String(t)), (error: unknown) => finish(`unreadable: ${String(error)}`));
      });
      return Promise.all(views.flatMap(view => view.mainFrame.framesInSubtree.filter(t => t.parent !== null).map(async frame => readAsync(view, frame))));
    }, { url, code: script });
  }

  // The role and name of each node the engine's own accessibility tree of the view at the URL keeps, in its order.
  public async accessibilityNodesAsync(url: string): Promise<readonly RoleName[]> {
    const nodes = await this.application.evaluate(async ({ webContents }, pageUrl: string): Promise<IRoleNameRecord[]> => {
      const views: IViewPageContents[] = webContents.getAllWebContents().filter((t: IViewPageContents) => t.getType() === "webview" && t.getURL() === pageUrl);
      const [view] = views;
      if (views.length !== 1 || view === undefined)
        throw new Error(`The app has ${views.length} views at ${pageUrl}, not one.`);
      const { nodes } = await view.debugger.sendCommand("Accessibility.getFullAXTree");
      return nodes.filter(t => t.ignored !== true).map(t => ({ role: String(t.role?.value ?? ""), name: String(t.name?.value ?? "") }));
    }, url);
    return nodes.map(t => new RoleName(t.role, t.name));
  }

  public async pressAtAsync(url: string, keyCode: string, modifiers: readonly string[]): Promise<void> {
    await this.application.evaluate(({ webContents }, request: IKeyRequest): void => {
      const views: IViewPageContents[] = webContents.getAllWebContents().filter((t: IViewPageContents) => t.getType() === "webview" && t.getURL() === request.url);
      const [view] = views;
      if (views.length !== 1 || view === undefined)
        throw new Error(`The app has ${views.length} views at ${request.url}, not one.`);
      for (const type of ["keyDown", "keyUp"] as const)
        view.sendInputEvent({ type, keyCode: request.keyCode, modifiers: [...request.modifiers] });
    }, { url, keyCode, modifiers });
  }

  // From now on, keeps each command the base sends the one view at the URL until its answer comes, so a test can see
  // which calls wait on the page.
  public async watchCommandsAtAsync(url: string): Promise<void> {
    await this.application.evaluate(({ webContents }, pageUrl: string): void => {
      const views: IViewPageContents[] = webContents.getAllWebContents().filter((t: IViewPageContents) => t.getType() === "webview" && t.getURL() === pageUrl);
      const [view] = views;
      if (views.length !== 1 || view === undefined)
        throw new Error(`The app has ${views.length} views at ${pageUrl}, not one.`);
      const pending: Map<number, string> = new Map();
      const send = view.debugger.sendCommand.bind(view.debugger);
      let sent = 0;
      Object.defineProperty(view.debugger, "sendCommand", {
        configurable: true,
        value: (method: string, ...rest: unknown[]): Promise<unknown> => {
          sent += 1;
          const number: number = sent;
          pending.set(number, method);
          return send(method, ...rest).finally(() => pending.delete(number));
        }
      });
      view.debugger.pendingCommands = pending;
    }, url);
  }

  // The commands the base sent the one view at the URL since `watchCommandsAtAsync` that have no answer yet, each as its
  // number in the order sent and its method, such as "3 Page.captureScreenshot".
  public async pendingCommandsAtAsync(url: string): Promise<readonly string[]> {
    return this.application.evaluate(({ webContents }, pageUrl: string): string[] => {
      const views: IViewPageContents[] = webContents.getAllWebContents().filter((t: IViewPageContents) => t.getType() === "webview" && t.getURL() === pageUrl);
      const [view] = views;
      if (views.length !== 1 || view === undefined)
        throw new Error(`The app has ${views.length} views at ${pageUrl}, not one.`);
      const pending: Map<number, string> | undefined = view.debugger.pendingCommands;
      if (pending === undefined)
        throw new Error(`The commands to the view at ${pageUrl} aren't watched.`);
      return [...pending].map(([number, method]) => `${number} ${method}`);
    }, url);
  }

  // Ends the renderer of the one view at the URL, as a crash of its page would, by killing its process: on Linux,
  // Electron's `forcefullyCrashRenderer` only asks the renderer to crash, and a busy one was seen to keep running.
  // It kills only a live renderer's own process, never the app's or, through 0 or a negative number, a process group.
  public async crashAtAsync(url: string): Promise<void> {
    await this.application.evaluate(({ webContents }, pageUrl: string): void => {
      const views: IViewPageContents[] = webContents.getAllWebContents().filter((t: IViewPageContents) => t.getType() === "webview" && t.getURL() === pageUrl);
      const [view] = views;
      if (views.length !== 1 || view === undefined)
        throw new Error(`The app has ${views.length} views at ${pageUrl}, not one.`);
      if (view.isCrashed())
        throw new Error(`The view at ${pageUrl} has already crashed.`);
      const pid: number = view.getOSProcessId();
      if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid)
        throw new Error(`The view at ${pageUrl} has no renderer process of its own to end: ${pid}.`);
      process.kill(pid, "SIGKILL");
    }, url);
  }

  public async runAsync(script: string): Promise<string> {
    return this.application.evaluate(async ({ webContents }, code: string): Promise<string> => {
      const views: IViewPageContents[] = webContents.getAllWebContents().filter((t: IViewPageContents) => t.getType() === "webview");
      const [view] = views;
      if (views.length !== 1 || view === undefined)
        throw new Error(`The app has ${views.length} views, not one.`);
      return String(await view.executeJavaScript(code, true));
    }, script);
  }
}
