/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ElectronApplication } from "playwright/test";

interface IViewPageContents {
  getType(): string;
  getURL(): string;
  getTitle(): string;
  isLoading(): boolean;
  readonly navigationHistory: { canGoBack(): boolean };
  executeJavaScript(code: string, userGesture: boolean): Promise<unknown>;
  on(event: "did-navigate", listener: (event: unknown, url: string) => void): void;
  on(event: "did-frame-navigate", listener: (event: unknown, url: string, code: number, status: string, isMainFrame: boolean) => void): void;
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

export class ViewPages {
  private readonly application: ElectronApplication;

  private constructor(application: ElectronApplication) {
    this.application = application;
  }

  public static async watchAsync(application: ElectronApplication): Promise<ViewPages> {
    await application.evaluate(({ app }) => {
      const commits: string[] = [];
      const frameCommits: string[] = [];
      globalThis.noldovaViewCommits = commits;
      globalThis.noldovaViewFrameCommits = frameCommits;
      app.on("web-contents-created", (_event: unknown, contents: IViewPageContents) => {
        if (contents.getType() !== "webview")
          return;
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

  public async listAsync(): Promise<readonly ViewPage[]> {
    const records = await this.application.evaluate(({ webContents }): IViewPageRecord[] => {
      const views: IViewPageContents[] = webContents.getAllWebContents().filter((t: IViewPageContents) => t.getType() === "webview");
      return views.map(t => ({ url: t.getURL(), title: t.getTitle(), isLoading: t.isLoading() }));
    });
    return records.map(t => new ViewPage(t.url, t.title, t.isLoading));
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
