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
}

interface IViewPageRecord {
  url: string;
  title: string;
}

export class ViewPage {
  public readonly url: string;
  public readonly title: string;

  public constructor(url: string, title: string) {
    this.url = url;
    this.title = title;
  }
}

export class ViewPages {
  private readonly application: ElectronApplication;

  public constructor(application: ElectronApplication) {
    this.application = application;
  }

  public async listAsync(): Promise<readonly ViewPage[]> {
    const records = await this.application.evaluate(({ webContents }): IViewPageRecord[] => {
      const views: IViewPageContents[] = webContents.getAllWebContents().filter((t: IViewPageContents) => t.getType() === "webview");
      return views.map(t => ({ url: t.getURL(), title: t.getTitle() }));
    });
    return records.map(t => new ViewPage(t.url, t.title));
  }
}
