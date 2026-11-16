/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ElectronApplication } from "playwright/test";

interface IViewWebRequest {
  onSendHeaders(listener: (details: { id: number; url: string }) => void): void;
  onCompleted(listener: (details: { id: number; url: string }) => void): void;
  onErrorOccurred(listener: (details: { id: number; url: string; error: string }) => void): void;
}

interface IViewContents {
  getType(): string;
  readonly session: { readonly webRequest: IViewWebRequest };
}

export class ViewRequest {
  public readonly url: string;
  public readonly error: string | null;

  public constructor(url: string, error: string | null) {
    this.url = url;
    this.error = error;
  }
}

export class ViewRequests {
  private readonly application: ElectronApplication;

  private constructor(application: ElectronApplication) {
    this.application = application;
  }

  public static async watchAsync(application: ElectronApplication): Promise<ViewRequests> {
    await application.evaluate(({ app }) => {
      const records: { url: string; error: string | null }[] = [];
      const inFlight = new Map<number, string>();
      globalThis.noldovaViewRequests = records;
      globalThis.noldovaViewRequestsInFlight = inFlight;
      const watched = new WeakSet<object>();
      app.on("web-contents-created", (_event: unknown, contents: IViewContents) => {
        if (contents.getType() !== "webview" || watched.has(contents.session))
          return;
        watched.add(contents.session);
        contents.session.webRequest.onSendHeaders(details => {
          inFlight.set(details.id, details.url);
        });
        contents.session.webRequest.onCompleted(details => {
          inFlight.delete(details.id);
          records.push({ url: details.url, error: null });
        });
        contents.session.webRequest.onErrorOccurred(details => {
          inFlight.delete(details.id);
          records.push({ url: details.url, error: details.error });
        });
      });
    });
    return new ViewRequests(application);
  }

  public async inFlightAsync(): Promise<readonly string[]> {
    return this.application.evaluate(() => [...globalThis.noldovaViewRequestsInFlight?.values() ?? []]);
  }

  public async takeAsync(): Promise<readonly ViewRequest[]> {
    const records = await this.application.evaluate(() => globalThis.noldovaViewRequests?.splice(0) ?? []);
    return records.map(t => new ViewRequest(t.url, t.error));
  }
}
