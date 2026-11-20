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

export interface IRoleName {
  role: string;
  name: string;
}

interface IViewDebugger {
  sendCommand(method: "Accessibility.getFullAXTree"): Promise<{ nodes: IAccessibilityNode[] }>;
  sendCommand(method: "Target.getTargets"): Promise<{ targetInfos: ITargetInfo[] }>;
  sendCommand(method: "Target.attachToTarget", params: { targetId: string; flatten: boolean }): Promise<{ sessionId: string }>;
  sendCommand(method: "Target.detachFromTarget", params: { sessionId: string }): Promise<unknown>;
  sendCommand(method: "Runtime.evaluate", params: { expression: string; returnByValue: boolean }, sessionId: string): Promise<{ result: { value?: unknown } }>;
  sendCommand(method: string, ...rest: unknown[]): Promise<unknown>;
  // The commands sent since `watchCommandsAtAsync` that have no answer yet, by the number of each in the order sent.
  pendingCommands?: Map<number, string>;
}

interface IViewSession {
  readonly cookies: { get(filter: { url: string }): Promise<{ name: string }[]> };
  readonly protocol: { isProtocolHandled(scheme: string): boolean };
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

interface IViewPageContents {
  readonly id: number;
  readonly mainFrame: IViewFrame;
  getType(): string;
  readonly session: IViewSession;
  readonly debugger: IViewDebugger;
  getURL(): string;
  getTitle(): string;
  isLoading(): boolean;
  readonly navigationHistory: { canGoBack(): boolean; getActiveIndex(): number; getAllEntries(): readonly { readonly pageState?: string }[] };
  executeJavaScript(code: string, userGesture: boolean): Promise<unknown>;
  getOSProcessId(): number;
  isCrashed(): boolean;
  sendInputEvent(event: { type: "keyDown" | "keyUp"; keyCode: string; modifiers: string[] }): void;
  on(event: "did-navigate", listener: (event: unknown, url: string) => void): void;
  on(event: "did-frame-navigate", listener: (event: unknown, url: string, code: number, status: string, isMainFrame: boolean) => void): void;
  on(event: "did-start-navigation", listener: (details: IViewNavigationStart) => void): void;
  on(event: "destroyed", listener: () => void): void;
  removeListener(event: "destroyed", listener: () => void): void;
  emit(event: "select-bluetooth-device", details: { preventDefault(): void }, devices: readonly IBluetoothDevice[], choose: (deviceId: string) => void): boolean;
}

interface IBluetoothDevice {
  readonly deviceId: string;
  readonly deviceName: string;
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

  // The views' creations, navigation starts and destructions, each with its time, for a failed test's attachment.
  public async takeLogAsync(): Promise<readonly string[]> {
    return this.application.evaluate(() => globalThis.noldovaViewLog?.splice(0) ?? []);
  }

  public async listAsync(): Promise<readonly ViewPage[]> {
    const records = await this.application.evaluate(({ webContents }): IViewPageRecord[] => {
      const views: IViewPageContents[] = webContents.getAllWebContents().filter((t: IViewPageContents) => t.getType() === "webview");
      return views.map(t => ({ url: t.getURL(), title: t.getTitle(), isLoading: t.isLoading() }));
    });
    return records.map(t => new ViewPage(t.url, t.title, t.isLoading));
  }

  public async surfacesAsync(): Promise<AppSurfaces> {
    const surfaces = await this.application.evaluate(({ BrowserWindow, webContents }): { windows: number; contents: string[] } => ({
      windows: BrowserWindow.getAllWindows().length,
      contents: webContents.getAllWebContents().map((t: IViewPageContents) => t.getType()).sort()
    }));
    return new AppSurfaces(surfaces.windows, surfaces.contents);
  }

  public async sessionsAsync(): Promise<readonly ViewSession[]> {
    const sessions = await this.application.evaluate(({ BrowserWindow, session, webContents }): { url: string; storagePath: string | null; isDefault: boolean; isWindows: boolean }[] => {
      const windows: IViewSession[] = BrowserWindow.getAllWindows().map((t: { webContents: IViewPageContents }) => t.webContents.session);
      const views: IViewPageContents[] = webContents.getAllWebContents().filter((t: IViewPageContents) => t.getType() === "webview");
      return views.map(t => ({ url: t.getURL(), storagePath: t.session.getStoragePath(), isDefault: t.session === session.defaultSession, isWindows: windows.includes(t.session) }));
    });
    return sessions.map(t => new ViewSession(t.url, t.storagePath, t.isDefault, t.isWindows));
  }

  public async viewCookiesAsync(pageUrl: string, url: string): Promise<readonly string[]> {
    return this.application.evaluate(async ({ webContents }, request: { pageUrl: string; url: string }): Promise<string[]> => {
      const views: IViewPageContents[] = webContents.getAllWebContents().filter((t: IViewPageContents) => t.getType() === "webview" && t.getURL() === request.pageUrl);
      const [view] = views;
      if (views.length !== 1 || view === undefined)
        throw new Error(`The app has ${views.length} views at ${request.pageUrl}, not one.`);
      return (await view.session.cookies.get({ url: request.url })).map(t => t.name);
    }, { pageUrl, url });
  }

  public async appCookiesAsync(url: string): Promise<readonly string[]> {
    return this.application.evaluate(async ({ BrowserWindow, session }, href: string): Promise<string[]> => {
      const sessions: IViewSession[] = [session.defaultSession, ...BrowserWindow.getAllWindows().map((t: { webContents: IViewPageContents }) => t.webContents.session)];
      return (await Promise.all(sessions.map(t => t.cookies.get({ url: href })))).flat().map(t => t.name);
    }, url);
  }

  public async protocolHandlersAsync(scheme: string): Promise<ProtocolHandlers> {
    const handlers = await this.application.evaluate(({ BrowserWindow, webContents }, name: string): { views: boolean[]; windows: boolean[] } => {
      const views: IViewPageContents[] = webContents.getAllWebContents().filter((t: IViewPageContents) => t.getType() === "webview");
      return {
        views: views.map(t => t.session.protocol.isProtocolHandled(name)),
        windows: BrowserWindow.getAllWindows().map((t: { webContents: IViewPageContents }) => t.webContents.session.protocol.isProtocolHandled(name))
      };
    }, scheme);
    return new ProtocolHandlers(handlers.views, handlers.windows);
  }

  public async downloadsFolderAsync(): Promise<string> {
    return this.application.evaluate(({ app }): string => app.getPath("downloads"));
  }

  // Offers each view a Bluetooth device, as the engine does when a page asks for one, and gives each view's address, whether its contents
  // took the choice from the engine, and the device ids it chose.
  public async bluetoothChoicesAsync(): Promise<readonly (readonly [string, boolean, readonly string[]])[]> {
    return this.application.evaluate(({ webContents }): [string, boolean, string[]][] => webContents.getAllWebContents()
      .filter((t: IViewPageContents) => t.getType() === "webview")
      .map((t: IViewPageContents): [string, boolean, string[]] => {
        const chosen: string[] = [];
        let isTaken = false;
        t.emit("select-bluetooth-device", { preventDefault: (): void => { isTaken = true; } }, [{ deviceId: "AA:BB:CC:DD:EE:FF", deviceName: "Headphones" }],
          (deviceId: string) => chosen.push(deviceId));
        return [t.getURL(), isTaken, chosen];
      }));
  }

  public async downloadSessionsAsync(): Promise<readonly (readonly [string, boolean])[]> {
    return this.application.evaluate(({ webContents }): [string, boolean][] => webContents.getAllWebContents()
      .filter((t: IViewPageContents) => t.getType() === "webview")
      .map((t: IViewPageContents): [string, boolean] => [t.getURL(), globalThis.noldovaDownloadSessions?.has(t.session) === true]));
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
    return this.application.evaluate(({ webContents }, [address, typed]): boolean => {
      const view: IViewPageContents | undefined = webContents.getAllWebContents().find((t: IViewPageContents) => t.getType() === "webview" && t.getURL() === address);
      const state: string | undefined = view?.navigationHistory.getAllEntries()[view.navigationHistory.getActiveIndex()]?.pageState;
      return state !== undefined && Buffer.from(state, "base64").includes(Buffer.from(typed, "utf16le"));
    }, [url, text] as const);
  }

  public async attachChildAsync(url: string): Promise<ChildTarget> {
    const child = await this.application.evaluate(async ({ webContents }, frameUrl: string): Promise<{ sessionId: string; url: string }> => {
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
    return this.application.evaluate(async ({ webContents }, request: { url: string; code: string }): Promise<string> => {
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
    return this.application.evaluate(async ({ webContents }, pageUrl: string): Promise<string[]> => {
      const views: IViewPageContents[] = webContents.getAllWebContents().filter((t: IViewPageContents) => t.getType() === "webview" && t.getURL() === pageUrl);
      const frames: IViewFrame[] = views.flatMap(t => t.mainFrame.framesInSubtree).filter(t => t.parent !== null);
      return Promise.all(frames.map(async t => String(await t.executeJavaScript("document.body?.innerText ?? \"\"").catch((error: unknown) => `unreadable: ${String(error)}`))));
    }, url);
  }

  // The role and name of each node the engine's own accessibility tree of the view at the URL keeps, in its order.
  public async accessibilityNodesAsync(url: string): Promise<IRoleName[]> {
    return this.application.evaluate(async ({ webContents }, pageUrl: string): Promise<IRoleName[]> => {
      const views: IViewPageContents[] = webContents.getAllWebContents().filter((t: IViewPageContents) => t.getType() === "webview" && t.getURL() === pageUrl);
      const [view] = views;
      if (views.length !== 1 || view === undefined)
        throw new Error(`The app has ${views.length} views at ${pageUrl}, not one.`);
      const { nodes } = await view.debugger.sendCommand("Accessibility.getFullAXTree");
      return nodes.filter(t => t.ignored !== true).map(t => ({ role: String(t.role?.value ?? ""), name: String(t.name?.value ?? "") }));
    }, url);
  }

  public async pressAtAsync(url: string, keyCode: string, modifiers: readonly string[]): Promise<void> {
    await this.application.evaluate(({ webContents }, request: { url: string; keyCode: string; modifiers: readonly string[] }): void => {
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
