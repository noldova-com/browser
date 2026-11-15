/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Buffer } from "node:buffer";

import { type IWebViewRelay, WebViewFailureException } from "@noldova/desktop.runtime";

import { CallFailureException } from "../exceptions/call-failure.exception.ts";
import { MalformedReplyException } from "../exceptions/malformed-reply.exception.ts";
import { PageAnswerTimedOutException } from "../exceptions/page-answer-timed-out.exception.ts";
import { ReplyTooLargeException } from "../exceptions/reply-too-large.exception.ts";
import type { CallOptions } from "../models/call-options.ts";
import { Resources } from "../resources.ts";
import type { AllowedMethod } from "../types/allowed-method.ts";
import type { CommandParams } from "../types/command-params.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";
import { JsonShapes } from "./json-shapes.ts";
import { ToolFailures } from "./tool-failures.ts";

export class ViewCalls {
  private static readonly UNSTOPPABLE: AbortSignal = new AbortController().signal;
  private readonly relay: IWebViewRelay;

  public constructor(relay: IWebViewRelay) {
    this.relay = relay;
  }

  public static holding(options: CallOptions): CallOptions {
    if (options.signal.aborted)
      throw ToolFailures.fromAbort(options.signal.reason);
    return options.withSignal(ViewCalls.UNSTOPPABLE, options.deadline);
  }

  public static releasing(options: CallOptions): CallOptions {
    return options.withSignal(ViewCalls.UNSTOPPABLE, Date.now() + Resources.releaseMilliseconds);
  }

  public async sendAsync<TMethod extends AllowedMethod>(viewId: string, method: TMethod, params: CommandParams<TMethod> & JsonObject, options: CallOptions): Promise<JsonObject> {
    return this.relayAsync(viewId, method, params, options, this.prepare(method, options));
  }

  public async pressAsync<TMethod extends "Input.dispatchMouseEvent" | "Input.dispatchKeyEvent">(viewId: string, method: TMethod, press: CommandParams<TMethod> & JsonObject,
    release: CommandParams<TMethod> & JsonObject, options: CallOptions): Promise<void> {
    const remaining: number = this.prepare(method, options);
    try {
      await this.relayAsync(viewId, method, press, options, remaining);
    }
    catch (error) {
      await this.sendAsync(viewId, method, release, ViewCalls.releasing(options)).catch(ViewCalls.ignoreCallFailure);
      throw error;
    }
    await this.sendAsync(viewId, method, release, ViewCalls.releasing(options));
  }

  private prepare(method: AllowedMethod, options: CallOptions): number {
    if (options.signal.aborted)
      throw ToolFailures.fromAbort(options.signal.reason);
    const remaining: number = options.deadline - Date.now();
    if (remaining <= 0)
      throw new PageAnswerTimedOutException();

    if (Resources.stateChanging.includes(method))
      options.progress.markInputSent();
    return remaining;
  }

  private async relayAsync<TMethod extends AllowedMethod>(viewId: string, method: TMethod, params: CommandParams<TMethod> & JsonObject, options: CallOptions,
    remaining: number): Promise<JsonObject> {
    const stop: AbortController = new AbortController();
    let reply: JsonValue;
    try {
      reply = await Promise.race([this.relay.sendAsync(viewId, method, params, Math.min(remaining, Resources.maximumTimeoutMilliseconds)), ViewCalls.waitAsync(remaining, AbortSignal.any([stop.signal, options.signal]))]);
    }
    catch (error) {
      if (error instanceof WebViewFailureException)
        throw ToolFailures.fromRelay(error, options.isReferenced);
      throw error;
    }
    finally {
      stop.abort();
    }
    if (Buffer.byteLength(JSON.stringify(reply), Resources.textEncoding) > options.maximumReplyBytes)
      throw new ReplyTooLargeException();
    if (!JsonShapes.isObject(reply))
      throw new MalformedReplyException();
    return reply;
  }

  private static ignoreCallFailure(error: unknown): void {
    if (!(error instanceof CallFailureException))
      throw error;
  }

  private static waitAsync(milliseconds: number, signal: AbortSignal): Promise<never> {
    return new Promise<never>((_resolve, reject) => {
      const abort = (): void => {
        clearTimeout(timer);
        reject(ToolFailures.fromAbort(signal.reason));
      };
      const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
        signal.removeEventListener("abort", abort);
        reject(new PageAnswerTimedOutException());
      }, milliseconds);
      if (signal.aborted)
        abort();
      else
        signal.addEventListener("abort", abort, { once: true });
    });
  }
}
