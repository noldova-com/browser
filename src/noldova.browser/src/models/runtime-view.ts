/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { JsonShapes } from "../services/json-shapes.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";
import { ExecutionContext } from "./execution-context.ts";

export class RuntimeView {
  private readonly contexts: Map<number, ExecutionContext> = new Map();
  private readonly waits: Set<() => void> = new Set();
  private readonly stopEvents: () => void;

  public constructor(listen: (track: (method: string, params: JsonObject) => void) => () => void) {
    this.stopEvents = listen((method, params) => this.track(method, params));
  }

  public contextOf(id: number): ExecutionContext | undefined {
    return this.contexts.get(id);
  }

  public addWait(wait: () => void): void {
    this.waits.add(wait);
  }

  public removeWait(wait: () => void): void {
    this.waits.delete(wait);
  }

  public stop(): void {
    this.stopEvents();
  }

  public wake(): void {
    for (const wait of [...this.waits])
      wait();
  }

  private track(method: string, params: JsonObject): void {
    const destroyed: JsonValue | undefined = params[Resources.executionContextIdField];
    if (method === Resources.executionContextCreatedEvent) {
      const context: ExecutionContext | null = RuntimeView.readContext(params[Resources.contextField]);
      if (context !== null)
        this.contexts.set(context.id, context);
    }
    else if (method === Resources.executionContextDestroyedEvent && typeof destroyed === "number")
      this.contexts.delete(destroyed);
    else if (method === Resources.executionContextsClearedEvent)
      this.contexts.clear();
    this.wake();
  }

  private static readContext(value: JsonValue | undefined): ExecutionContext | null {
    if (!JsonShapes.isObject(value))
      return null;
    const { id, uniqueId, name, auxData }: JsonObject = value;
    const frameId: JsonValue | undefined = JsonShapes.isObject(auxData) ? auxData[Resources.frameIdField] : undefined;
    if (typeof id !== "number" || typeof uniqueId !== "string" || typeof name !== "string" || typeof frameId !== "string")
      return null;
    return new ExecutionContext(id, uniqueId, name, frameId);
  }
}
