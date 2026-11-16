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
  onCompleted(listener: (details: { id: number; url: string; ip?: string }) => void): void;
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
  private readonly carried: ViewRequest[];

  private constructor(application: ElectronApplication, carried: readonly ViewRequest[]) {
    this.application = application;
    this.carried = [...carried];
  }

  public static async watchAsync(application: ElectronApplication, carried: readonly ViewRequest[] = []): Promise<ViewRequests> {
    await application.evaluate(({ app }) => {
      const records: { url: string; error: string | null; address: string | null }[] = [];
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
          records.push({ url: details.url, error: null, address: details.ip ?? null });
        });
        contents.session.webRequest.onErrorOccurred(details => {
          inFlight.delete(details.id);
          records.push({ url: details.url, error: details.error, address: null });
        });
      });
    });
    return new ViewRequests(application, carried);
  }

  public async inFlightAsync(): Promise<readonly string[]> {
    return this.application.evaluate(() => [...globalThis.noldovaViewRequestsInFlight?.values() ?? []]);
  }

  public async peekAsync(): Promise<readonly ViewRequest[]> {
    const records = await this.application.evaluate(() => [...globalThis.noldovaViewRequests ?? []]);
    return [...this.carried, ...records.map(t => new ViewRequest(t.url, t.error))];
  }

  public async addressesAsync(url: string): Promise<readonly (string | null)[]> {
    return this.application.evaluate((_electron, href) => (globalThis.noldovaViewRequests ?? []).filter(t => t.url === href && t.error === null).map(t => t.address), url);
  }

  public async takeAsync(): Promise<readonly ViewRequest[]> {
    const records = await this.application.evaluate(() => globalThis.noldovaViewRequests?.splice(0) ?? []);
    return [...this.carried.splice(0), ...records.map(t => new ViewRequest(t.url, t.error))];
  }
}
