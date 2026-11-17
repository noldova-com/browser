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

// One agent's control of a page: from its first call on the page until it closes the page, the person takes over or stops it, or its session
// ends. Each of its calls moves it from Idle to Acting, maybe Asking, and back.
export class PageActivity implements Disposable {
  private readonly id: string = crypto.randomUUID();
  private readonly page: SessionPage;
  private readonly publish: (payload: JsonObject) => void;
  private readonly stopper: AbortController = new AbortController();
  private action: PageAction;
  private state: PageActivityState = PageActivityState.Acting;
  private callSignal: AbortSignal;
  private box: PageBox | null = null;
  private point: PagePoint | null = null;
  private refusal: PageRefusal | null = null;
  private isHandedOver: boolean = false;
  private isReleased: boolean = false;
  public readonly session: string;

  public constructor(page: SessionPage, session: string, action: PageAction, callSignal: AbortSignal, publish: (payload: JsonObject) => void) {
    this.page = page;
    this.session = session;
    this.action = action;
    this.publish = publish;
    this.callSignal = AbortSignal.any([callSignal, this.stopper.signal]);
    this.send();
  }

  public get instance(): string {
    return this.page.instance;
  }

  // The running call's signal, which also aborts when the person stops the agent.
  public get signal(): AbortSignal {
    return this.callSignal;
  }

  public get stopSignal(): AbortSignal {
    return this.stopper.signal;
  }

  public get isCalling(): boolean {
    return this.state === PageActivityState.Acting || this.state === PageActivityState.Asking;
  }

  // Whether the control ends once its running call ends: the person stopped the agent or took the page, or the page or the session is gone.
  public get isOver(): boolean {
    return this.stopper.signal.aborted || this.isHandedOver || this.isReleased;
  }

  public begin(action: PageAction, callSignal: AbortSignal): void {
    this.action = action;
    this.callSignal = AbortSignal.any([callSignal, this.stopper.signal]);
    this.box = null;
    this.point = null;
    this.state = PageActivityState.Acting;
    this.send();
  }

  // The call is over and the control stays: the mark leaves the page, and a refusal the call met is reported once.
  public rest(): void {
    this.box = null;
    this.point = null;
    this.move(PageActivityState.Idle);
    this.refusal = null;
  }

  public stop(): void {
    this.stopper.abort(ToolAbortReason.Stopped);
  }

  public release(): void {
    this.isReleased = true;
  }

  public ask(): void {
    this.move(PageActivityState.Asking);
  }

  public act(): void {
    this.move(PageActivityState.Acting);
  }

  public aim(box: PageBox, point: PagePoint | null): void {
    if (!this.isCalling)
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
