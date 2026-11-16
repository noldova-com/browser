/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { JsonReader, type JsonValue } from "@noldova/context.json";
import { type ElectronApplication, type Page, type TestInfo, _electron, expect } from "playwright/test";

import { HangLimits } from "./hang-limits.ts";
import type { LaunchSetting } from "./launch-settings.ts";
import { TestAppLayout } from "./test-app-layout.ts";
import { ViewPages } from "./view-pages.ts";
import { ViewRequests } from "./view-requests.ts";

export class TestApp {
  private static readonly PROFILE_KEY: string = "e2e";
  private static readonly DISCONNECTED: string = "Disconnected";
  private static readonly FOLDER_PREFIX: string = "browser-e2e-";
  private static readonly LOGS_FOLDER: string = "logs";
  private static readonly OUTPUT_NAME: string = "main-process-output.txt";
  private static readonly WINDOW: string = "nol-window";
  private static readonly SETTINGS_BUTTON: string = ".nol-window-row-settings";

  public readonly window: Page;
  public readonly dataDirectory: string;
  public readonly deviceDirectory: string;
  public readonly viewRequests: ViewRequests;
  public readonly viewPages: ViewPages;
  private readonly application: ElectronApplication;
  private readonly testInfo: TestInfo;
  private readonly output: string[] = [];

  private constructor(application: ElectronApplication, window: Page, viewRequests: ViewRequests, dataDirectory: string, deviceDirectory: string, testInfo: TestInfo) {
    this.application = application;
    this.testInfo = testInfo;
    this.window = window;
    this.viewRequests = viewRequests;
    this.viewPages = new ViewPages(application);
    this.dataDirectory = dataDirectory;
    this.deviceDirectory = deviceDirectory;
    const child = application.process();
    child.stdout?.setEncoding("utf8").on("data", (chunk: string) => this.output.push(chunk));
    child.stderr?.setEncoding("utf8").on("data", (chunk: string) => this.output.push(chunk));
    window.on("console", message => this.output.push(`[window ${message.type()}] ${message.text()}\n`));
  }

  public static async launchAsync(testInfo: TestInfo, dataFiles: Readonly<Record<string, string>>, settings: readonly LaunchSetting[]): Promise<TestApp> {
    const root = await mkdtemp(path.join(tmpdir(), TestApp.FOLDER_PREFIX));
    const dataDirectory = path.join(root, "data");
    const deviceDirectory = path.join(root, "device");
    await mkdir(dataDirectory);
    await mkdir(deviceDirectory);
    for (const [name, text] of Object.entries(dataFiles))
      await writeFile(path.join(dataDirectory, name), text);
    testInfo.annotations.push({ type: "app folders", description: root });
    for (const setting of settings)
      testInfo.annotations.push({ type: "launch setting", description: `${setting.arguments.join(" ")}: ${setting.reason}` });
    const application = await _electron.launch({
      executablePath: (await readFile(TestAppLayout.EXECUTABLE_RECORD, "utf8")).trim(),
      args: [TestAppLayout.DEVELOPMENT_PACKAGE, `--data-dir=${dataDirectory}`, `--device-dir=${deviceDirectory}`, ...settings.flatMap(t => t.arguments)],
      cwd: TestAppLayout.APP_FOLDER
    });
    const viewRequests = await ViewRequests.watchAsync(application);
    return new TestApp(application, await application.firstWindow(), viewRequests, dataDirectory, deviceDirectory, testInfo);
  }

  public async waitForStartAsync(): Promise<void> {
    await expect(this.window.locator(TestApp.WINDOW)).toBeVisible();
    await expect(this.window.locator(TestApp.SETTINGS_BUTTON), "The app's window never ended its start: its Settings button, which it enables once it has activated the modules and enabled their commands, stayed disabled.").toBeEnabled();
  }

  public async allowLocalSitesAsync(origins: readonly string[]): Promise<void> {
    await this.setSettingAsync("browser.localSites", origins.join(","));
  }

  public async openPageAsync(url: string): Promise<void> {
    await this.requestAsync("agent-double.openPage", { profileKey: TestApp.PROFILE_KEY, url, instance: randomUUID() });
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
    return JsonReader.parse(await this.window.evaluate(async request => {
      if (globalThis.desktop === undefined)
        throw new Error("The page has no desktop bridge.");
      return JSON.stringify(await globalThis.desktop.request(request.method, JSON.parse(request.payload)));
    }, { method, payload: JSON.stringify(payload) }));
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
    await this.testInfo.attach(TestApp.OUTPUT_NAME, { body: this.output.join(""), contentType: "text/plain" });
  }

  private async closeAsync(): Promise<void> {
    const child = this.application.process();
    if (child.exitCode !== null || child.signalCode !== null)
      return;

    const exited = once(child, "exit");
    const closing = this.application.close().catch(() => undefined);
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
