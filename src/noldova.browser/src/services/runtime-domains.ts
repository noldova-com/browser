/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWebViewRelay, WebViewProtocolEvent } from "@noldova/desktop.runtime";

import type { ExecutionContext } from "../models/execution-context.ts";
import { KeptCall } from "../models/kept-call.ts";
import { RuntimeView } from "../models/runtime-view.ts";
import { Resources } from "../resources.ts";
import type { AllowedMethod } from "../types/allowed-method.ts";
import type { JsonObject } from "../types/json-value.ts";
import type { ConsoleBuffers } from "./console-buffers.ts";

export class RuntimeDomains {
  private readonly relay: IWebViewRelay;
  private readonly views: Map<string, RuntimeView> = new Map();
  private readonly starts: Map<string, Promise<void>> = new Map();
  private readonly kept: Map<string, Set<KeptCall>> = new Map();
  public readonly consoles: ConsoleBuffers;

  public constructor(relay: IWebViewRelay, consoles: ConsoleBuffers) {
    this.relay = relay;
    this.consoles = consoles;
  }

  public startAsync(viewId: string, origin: string, sendAsync: (method: AllowedMethod, params: JsonObject) => Promise<unknown>): Promise<void> {
    const starting: Promise<void> | undefined = this.starts.get(viewId);
    if (starting !== undefined)
      return starting;
    if (this.views.has(viewId))
      return Promise.resolve();
    const view: RuntimeView = new RuntimeView(track => this.relay.onProtocolEvent(viewId, (event: WebViewProtocolEvent) => track(event.method, event.params)));
    this.views.set(viewId, view);
    const started: Promise<void> = RuntimeDomains.enableAsync(sendAsync, () => this.consoles.start(viewId, origin), () => [...this.keptOf(viewId)]);
    this.starts.set(viewId, started);
    started.then(() => {
      this.starts.delete(viewId);
    }, () => {
      this.starts.delete(viewId);
      this.stop(viewId, view);
    });
    return started;
  }

  public async keepAsync(viewId: string, origin: string, method: AllowedMethod, params: JsonObject,
    sendAsync: (method: AllowedMethod, params: JsonObject) => Promise<unknown>): Promise<() => void> {
    const call: KeptCall = new KeptCall(method, params);
    const calls: Set<KeptCall> = this.keptOf(viewId);
    calls.add(call);
    this.kept.set(viewId, calls);
    const release = (): void => {
      calls.delete(call);
      if (calls.size === 0)
        this.kept.delete(viewId);
    };
    try {
      await this.startAsync(viewId, origin, sendAsync);
      if (!call.isSent) {
        call.markSent();
        await sendAsync(method, params);
      }
    }
    catch (error) {
      release();
      throw error;
    }
    return release;
  }

  public findContextAsync(viewId: string, id: number, frameId: string, name: string, milliseconds: number, signal: AbortSignal): Promise<string | null> {
    const view: RuntimeView | undefined = this.views.get(viewId);
    if (view === undefined)
      return Promise.resolve(null);
    const { promise, resolve }: PromiseWithResolvers<string | null> = Promise.withResolvers<string | null>();
    const finish = (uniqueId: string | null): void => {
      clearTimeout(timer);
      view.removeWait(check);
      signal.removeEventListener("abort", check);
      resolve(uniqueId);
    };
    const check = (): void => {
      const context: ExecutionContext | undefined = view.contextOf(id);
      if (this.views.get(viewId) !== view || signal.aborted)
        finish(null);
      else if (context !== undefined)
        finish(context.name === name && context.frameId === frameId ? context.uniqueId : null);
    };
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
      finish(null);
      this.stop(viewId, view);
    }, milliseconds);
    view.addWait(check);
    signal.addEventListener("abort", check, { once: true });
    check();
    return promise;
  }

  public drop(viewId: string): void {
    this.consoles.pause(viewId);
    const view: RuntimeView | undefined = this.views.get(viewId);
    if (view !== undefined)
      this.stop(viewId, view);
  }

  public close(viewId: string): void {
    this.drop(viewId);
    this.consoles.close(viewId);
  }

  private stop(viewId: string, view: RuntimeView): void {
    this.consoles.pause(viewId);
    this.views.delete(viewId);
    view.stop();
    for (const call of this.keptOf(viewId))
      call.markUnsent();
    view.wake();
  }

  private keptOf(viewId: string): Set<KeptCall> {
    return this.kept.get(viewId) ?? new Set();
  }

  private static async enableAsync(sendAsync: (method: AllowedMethod, params: JsonObject) => Promise<unknown>, hear: () => void,
    kept: () => readonly KeptCall[]): Promise<void> {
    for (const method of Resources.runtimeEnables) {
      await sendAsync(method, {});
      if (method === Resources.disableMethod)
        hear();
    }
    for (const call of kept()) {
      call.markSent();
      await sendAsync(call.method, call.params);
    }
  }
}
