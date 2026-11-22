/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { JsonReader, type JsonValue } from "@noldova/context.json";
import { type ElectronApplication, type Page, type TestInfo, _electron, expect } from "playwright/test";

import { AnswerLimit } from "./answer-limit.ts";
import { HangLimits } from "./hang-limits.ts";
import { type LaunchSetting, LaunchSettings } from "./launch-settings.ts";
import { TestAppLayout } from "./test-app-layout.ts";
import { ViewPages } from "./view-pages.ts";
import { type ViewRequest, ViewRequests } from "./view-requests.ts";

interface IDownloadSession {
  setDownloadPath(path: string): void;
}

// What owns a session in the main process: a web contents, as the download folder sees it.
interface ISessionOwner {
  readonly session: IDownloadSession;
}

// A size in CSS pixels, sent to the main process and the window's page.
class WindowSize {
  public readonly width: number;
  public readonly height: number;

  public constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
}

class AppRun {
  public readonly application: ElectronApplication;
  // Taken at launch: once the app has quit, Playwright drops its record of the app, and asking for the process then fails.
  public readonly process: ChildProcess;
  public readonly closed: Promise<void>;
  public readonly window: Page;
  public readonly viewRequests: ViewRequests;
  public readonly viewPages: ViewPages;

  public constructor(application: ElectronApplication, window: Page, viewRequests: ViewRequests, viewPages: ViewPages) {
    this.application = application;
    this.process = application.process();
    this.closed = new Promise(resolve => application.once("close", () => resolve()));
    this.window = window;
    this.viewRequests = viewRequests;
    this.viewPages = viewPages;
  }
}

export class TestApp {
  public static readonly PROFILE_KEY: string = "e2e";
  private static readonly DISCONNECTED: string = "Disconnected";
  private static readonly FOLDER_PREFIX: string = "browser-e2e-";
  private static readonly DOWNLOADS_FOLDER: string = "downloads";
  private static readonly LOGS_FOLDER: string = "logs";
  private static readonly OUTPUT_NAME: string = "main-process-output.txt";
  private static readonly VIEW_LOG_NAME: string = "views.log";
  private static readonly WINDOW: string = "nol-window";
  private static readonly SETTINGS_BUTTON: string = ".nol-window-row-settings";

  public readonly dataDirectory: string;
  public readonly deviceDirectory: string;
  private readonly settings: readonly LaunchSetting[];
  private readonly testInfo: TestInfo;
  private readonly output: string[] = [];
  private readonly viewLog: string[] = [];
  private run: AppRun;

  private constructor(run: AppRun, dataDirectory: string, deviceDirectory: string, settings: readonly LaunchSetting[], testInfo: TestInfo) {
    this.run = run;
    this.testInfo = testInfo;
    this.settings = settings;
    this.dataDirectory = dataDirectory;
    this.deviceDirectory = deviceDirectory;
    this.listen(run);
  }

  public get application(): ElectronApplication {
    return this.run.application;
  }

  public get window(): Page {
    return this.run.window;
  }

  public get viewRequests(): ViewRequests {
    return this.run.viewRequests;
  }

  public get viewPages(): ViewPages {
    return this.run.viewPages;
  }

  public static async launchAsync(testInfo: TestInfo, dataFiles: Readonly<Record<string, string>>, settings: readonly LaunchSetting[]): Promise<TestApp> {
    const root = await mkdtemp(path.join(tmpdir(), TestApp.FOLDER_PREFIX));
    const dataDirectory = path.join(root, "data");
    const deviceDirectory = path.join(root, "device");
    await mkdir(dataDirectory);
    await mkdir(deviceDirectory);
    await mkdir(path.join(root, TestApp.DOWNLOADS_FOLDER));
    for (const [name, text] of Object.entries(dataFiles))
      await writeFile(path.join(dataDirectory, name), text);
    testInfo.annotations.push({ type: "app folders", description: root });
    for (const setting of settings)
      testInfo.annotations.push({ type: "launch setting", description: `${setting.arguments.join(" ")}: ${setting.reason}` });
    testInfo.annotations.push({ type: "launch setting", description: `app.setPath("downloads", ${TestApp.DOWNLOADS_FOLDER}): ${LaunchSettings.DOWNLOADS_FOLDER_REASON}` });
    return new TestApp(await TestApp.startAsync(dataDirectory, deviceDirectory, settings, []), dataDirectory, deviceDirectory, settings, testInfo);
  }

  private static async startAsync(dataDirectory: string, deviceDirectory: string, settings: readonly LaunchSetting[], carried: readonly ViewRequest[]): Promise<AppRun> {
    const application = await _electron.launch({
      executablePath: (await readFile(TestAppLayout.EXECUTABLE_RECORD, "utf8")).trim(),
      args: [TestAppLayout.DEVELOPMENT_PACKAGE, `--data-dir=${dataDirectory}`, `--device-dir=${deviceDirectory}`, ...settings.flatMap(t => t.arguments)],
      cwd: TestAppLayout.APP_FOLDER
    });
    // Electron gives a session its downloads folder when the session is made, and a restart may restore a page, and make its session,
    // before this runs, even before its web contents exist; so every session there is gets the folder, every one made after, and the
    // session of every web contents made after.
    await application.evaluate(({ app, session, webContents }, folder: string): void => {
      const sessions = new Set<object>();
      const own = (made: IDownloadSession): void => {
        made.setDownloadPath(folder);
        sessions.add(made);
      };
      app.setPath("downloads", folder);
      globalThis.noldovaDownloadSessions = sessions;
      app.on("session-created", own);
      app.on("web-contents-created", (_event: unknown, contents: ISessionOwner) => own(contents.session));
      const made: IDownloadSession[] = [session.defaultSession, ...webContents.getAllWebContents().map((t: ISessionOwner) => t.session)];
      for (const each of made)
        own(each);
    }, path.join(path.dirname(dataDirectory), TestApp.DOWNLOADS_FOLDER));
    const viewRequests = await ViewRequests.watchAsync(application, carried);
    const viewPages = await ViewPages.watchAsync(application);
    return new AppRun(application, await application.firstWindow(), viewRequests, viewPages);
  }

  public async restartAsync(): Promise<void> {
    await expect.poll(() => this.viewRequests.inFlightAsync(), { message: "A view's request was still in flight before the restart." }).toEqual([]);
    const carried = await this.viewRequests.takeAsync();
    this.viewLog.push(...await this.viewPages.takeLogAsync());
    await this.quitAsync();
    this.run = await TestApp.startAsync(this.dataDirectory, this.deviceDirectory, this.settings, carried);
    this.listen(this.run);
    await this.waitForStartAsync();
  }

  private listen(run: AppRun): void {
    const child = run.process;
    child.stdout?.setEncoding("utf8").on("data", (chunk: string) => this.output.push(chunk));
    child.stderr?.setEncoding("utf8").on("data", (chunk: string) => this.output.push(chunk));
    run.window.on("console", message => this.output.push(`[window ${message.type()}] ${message.text()}\n`));
  }

  // Settles once Playwright has seen the app close, after which it no longer answers for the app.
  public async closedAsync(): Promise<void> {
    await this.run.closed;
  }

  public async waitForStartAsync(): Promise<void> {
    await expect(this.window.locator(TestApp.WINDOW)).toBeVisible();
    await expect(this.window.locator(TestApp.SETTINGS_BUTTON), "The app's window never ended its start: its Settings button stayed disabled.").toBeEnabled();
  }

  public async allowLocalSitesAsync(origins: readonly string[]): Promise<void> {
    await this.setSettingAsync("browser.localSites", origins.join(","));
  }

  public async openPageAsync(url: string, profileKey: string = TestApp.PROFILE_KEY): Promise<string> {
    const instance = randomUUID();
    await this.requestAsync("agent-double.openPage", { profileKey, url, instance });
    return instance;
  }

  // Gives the window's page the size, as the person's drag of the window's edge does, and waits until the page has it.
  public async resizeAsync(width: number, height: number): Promise<void> {
    const size = new WindowSize(width, height);
    await this.run.application.evaluate(({ BrowserWindow }, wanted: WindowSize): void => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.unmaximize();
        window.setContentSize(wanted.width, wanted.height);
      }
    }, size);
    // Above a device scale of 1, as a forced scale on Windows, the window's frame may round its content a device pixel short, which reads as one
    // CSS pixel less; at 1 the page has the size exactly.
    await expect.poll(() => this.window.evaluate((wanted: WindowSize): boolean => {
      const allowed = devicePixelRatio > 1 ? 1 : 0;
      return [wanted.width - innerWidth, wanted.height - innerHeight].every(t => t >= 0 && t <= allowed);
    }, size), { message: `The window never took the size ${String(width)} by ${String(height)}, or one CSS pixel less above a device scale of 1.` }).toBe(true);
  }

  public async requestAsync(method: string, payload: JsonValue): Promise<JsonValue> {
    return TestApp.payloadOf(method, await this.answerAsync(method, payload));
  }

  public async setSettingAsync(name: string, value: JsonValue): Promise<void> {
    const method = "desktop.setSetting";
    let answer = await this.answerAsync(method, { name, value });
    await expect.poll(async () => {
      if (TestApp.isDisconnected(answer))
        answer = await this.answerAsync(method, { name, value });
      return TestApp.isDisconnected(answer);
    }, { message: "The app's window never connected to its runtime." }).toBe(false);
    TestApp.payloadOf(method, answer);
  }

  private static isDisconnected(answer: JsonReader): boolean {
    return answer.hasField("failure") && answer.readObject("failure").readString("code") === TestApp.DISCONNECTED;
  }

  private static payloadOf(method: string, answer: JsonReader): JsonValue {
    if (answer.hasField("failure"))
      throw new Error(`${method} failed: ${JSON.stringify(answer.readValue("failure"))}`);
    return answer.hasField("payload") ? answer.readValue("payload") : null;
  }

  private async answerAsync(method: string, payload: JsonValue): Promise<JsonReader> {
    return JsonReader.parse(await AnswerLimit.withinAsync(this.window.evaluate(async request => {
      if (globalThis.desktop === undefined)
        throw new Error("The page has no desktop bridge.");
      return JSON.stringify(await globalThis.desktop.request(request.method, JSON.parse(request.payload)));
    }, { method, payload: JSON.stringify(payload) }), AbortSignal.timeout(HangLimits.APP_ANSWERS_A_REQUEST_WITHIN_MS), method));
  }

  // An app that can't answer any more still leaves what it logged before, and says why the rest is missing.
  public async attachViewLogAsync(): Promise<void> {
    const taken = await this.viewPages.takeLogAsync().catch((error: unknown) => [`The app's view log couldn't be read: ${String(error)}`]);
    await this.testInfo.attach(TestApp.VIEW_LOG_NAME, { body: [...this.viewLog.splice(0), ...taken].join("\n"), contentType: "text/plain" });
  }

  public async quitAsync(): Promise<void> {
    const quit = spawn(process.execPath, [TestAppLayout.BUILD_COMMAND_LINE, "desktop-tools", "quit", "--json", "--timeout", String(HangLimits.APP_QUITS_WITHIN_S), "--data-dir", this.dataDirectory, "--device-dir", this.deviceDirectory], {
      cwd: TestAppLayout.APP_FOLDER
    });
    let output = "";
    quit.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      output += chunk;
    });
    quit.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      output += chunk;
    });
    const code = await new Promise<number | null>((resolve, reject) => {
      quit.once("error", reject);
      quit.once("exit", resolve);
    });
    try {
      expect(code, `The command line's quit printed ${JSON.stringify(output)}.`).toBe(0);
    }
    finally {
      try {
        await this.closeAsync();
      }
      finally {
        await this.attachLogsAsync();
      }
    }
  }

  private async attachLogsAsync(): Promise<void> {
    const logs = path.join(this.dataDirectory, TestApp.LOGS_FOLDER);
    const files = existsSync(logs) ? (await readdir(logs)).sort() : [];
    for (const file of files)
      await this.testInfo.attach(file, { path: path.join(logs, file), contentType: "text/plain" });
    await this.testInfo.attach(TestApp.OUTPUT_NAME, { body: this.output.splice(0).join(""), contentType: "text/plain" });
  }

  private async closeAsync(): Promise<void> {
    const child = this.run.process;
    if (!Object.isNull(child.exitCode) || !Object.isNull(child.signalCode))
      return;

    const exited = once(child, "exit");
    const closing = this.run.application.close().catch(() => undefined);
    const limit = AbortSignal.timeout(HangLimits.APP_CLOSES_AFTER_ITS_QUIT_MS);
    const isClosed = await Promise.race([exited.then(() => true), once(limit, "abort").then(() => false)]);
    if (isClosed) {
      await closing;
      return;
    }
    child.kill("SIGKILL");
    await exited;
    await closing;
    throw new Error(`The app didn't close within ${HangLimits.APP_CLOSES_AFTER_ITS_QUIT_MS} ms of its quit, so its process was ended.`);
  }
}
