/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type PageAction, PageActivity as PageActivityMessage, PageActivityState, type PageBox, type PagePoint, type PageRefusal } from "@noldova/browser.protocol";
import { ToolAbortReason } from "@noldova/desktop.runtime";

import type { JsonObject } from "../types/json-value.ts";
import type { SessionPage } from "./session-page.ts";

export class PageActivity implements Disposable {
  private readonly id: string = crypto.randomUUID();
  private readonly page: SessionPage;
  private readonly action: PageAction;
  private readonly publish: (payload: JsonObject) => void;
  private readonly stopper: AbortController = new AbortController();
  private state: PageActivityState = PageActivityState.Acting;
  private box: PageBox | null = null;
  private point: PagePoint | null = null;
  private refusal: PageRefusal | null = null;
  private isHandedOver: boolean = false;
  public readonly session: string;
  public readonly signal: AbortSignal;

  public constructor(page: SessionPage, session: string, action: PageAction, callSignal: AbortSignal, publish: (payload: JsonObject) => void) {
    this.page = page;
    this.session = session;
    this.action = action;
    this.publish = publish;
    this.signal = AbortSignal.any([callSignal, this.stopper.signal]);
    this.send();
  }

  public get instance(): string {
    return this.page.instance;
  }

  public get stopSignal(): AbortSignal {
    return this.stopper.signal;
  }

  public stop(): void {
    this.stopper.abort(ToolAbortReason.Stopped);
  }

  public ask(): void {
    this.move(PageActivityState.Asking);
  }

  public act(): void {
    this.move(PageActivityState.Acting);
  }

  public aim(box: PageBox, point: PagePoint | null): void {
    if (this.state === PageActivityState.Ended)
      return;
    this.box = box;
    this.point = point;
    this.send();
  }

  public follow(box: PageBox | null): void {
    if (this.state !== PageActivityState.Asking || PageActivity.isSameBox(this.box, box))
      return;
    this.box = box;
    this.send();
  }

  public refuse(refusal: PageRefusal): void {
    this.refusal = refusal;
  }

  public handOver(): void {
    this.isHandedOver = true;
  }

  public [Symbol.dispose](): void {
    this.move(PageActivityState.Ended);
  }

  public toPayload(): JsonObject {
    return new PageActivityMessage(this.page.instance, this.id, this.page.agentName, this.action, this.state, this.box, this.point, this.refusal, this.isHandedOver)
      .toJson();
  }

  private static isSameBox(was: PageBox | null, box: PageBox | null): boolean {
    if (was === null || box === null)
      return was === box;
    return was.isSame(box);
  }

  private move(state: PageActivityState): void {
    if (this.state === state || this.state === PageActivityState.Ended)
      return;
    this.state = state;
    this.send();
  }

  private send(): void {
    this.publish(this.toPayload());
  }
}
