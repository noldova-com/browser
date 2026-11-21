/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PageAction } from "@noldova/browser.protocol";

import type { JsonObject } from "../types/json-value.ts";
import { PageActivity } from "./page-activity.ts";
import type { SessionPage } from "./session-page.ts";

// Each page's control by an agent, and the sessions the person took a page from. A page's calls run one at a time, so a page has one control.
export class PageStops {
  private static readonly MOVING: ReadonlySet<PageAction> = new Set<PageAction>([PageAction.Navigating, PageAction.Clicking, PageAction.Typing, PageAction.PressingKey]);

  private readonly controls: Map<string, PageActivity> = new Map<string, PageActivity>();
  private readonly last: Map<string, string> = new Map<string, string>();
  private readonly takenOver: Map<string, Set<string>> = new Map<string, Set<string>>();
  private readonly stopped: Map<string, number> = new Map<string, number>();
  private readonly begun: Map<string, number> = new Map<string, number>();
  private readonly publish: (payload: JsonObject) => void;
  private readonly release: (viewId: string) => void;

  // Release hears each control's end with the view it marked, as the view stops being controlled.
  public constructor(publish: (payload: JsonObject) => void, release: (viewId: string) => void) {
    this.publish = publish;
    this.release = release;
  }

  public generationOf(instance: string): number {
    return this.stopped.get(instance) ?? 0;
  }

  public movesOn(instance: string): number {
    return this.begun.get(instance) ?? 0;
  }

  public activities(): JsonObject[] {
    return [...this.controls.values()].map(t => t.toPayload());
  }

  public controlsView(viewId: string): boolean {
    return [...this.controls.values()].some(t => t.viewId === viewId || t.markedViewId === viewId);
  }

  public isTakenOver(instance: string, session: string): boolean {
    return this.takenOver.get(instance)?.has(session) === true;
  }

  // Starts a call on the page: the session's control goes on, and another session's control of the page ends.
  public begin(page: SessionPage, session: string, action: PageAction, callSignal: AbortSignal): PageActivity {
    this.last.set(page.instance, session);
    if (PageStops.MOVING.has(action))
      this.begun.set(page.instance, this.movesOn(page.instance) + 1);
    const control: PageActivity | undefined = this.controls.get(page.instance);
    if (control?.session === session) {
      control.begin(page, action, callSignal);
      return control;
    }
    if (control !== undefined)
      this.end(control);
    const started: PageActivity = new PageActivity(page, session, action, callSignal, this.publish);
    this.controls.set(page.instance, started);
    return started;
  }

  public finish(control: PageActivity): void {
    if (control.isOver)
      this.end(control);
    else
      control.rest();
  }

  public stop(instance: string, isTakingOver: boolean): void {
    this.stopped.set(instance, this.generationOf(instance) + 1);
    const control: PageActivity | undefined = this.controls.get(instance);
    if (control !== undefined) {
      control.stop();
      this.endIdle(control);
    }
    const session: string | undefined = this.last.get(instance);
    if (!isTakingOver || session === undefined)
      return;
    const sessions: Set<string> = this.takenOver.get(instance) ?? new Set<string>();
    sessions.add(session);
    this.takenOver.set(instance, sessions);
  }

  // The page closed: its control ends, at once or when its running call ends.
  public close(instance: string): void {
    const control: PageActivity | undefined = this.controls.get(instance);
    if (control === undefined)
      return;
    control.release();
    this.endIdle(control);
  }

  public endSession(session: string): void {
    for (const control of [...this.controls.values()])
      if (control.session === session) {
        control.release();
        this.endIdle(control);
      }
    for (const [instance, sessions] of this.takenOver) {
      sessions.delete(session);
      if (sessions.size === 0)
        this.takenOver.delete(instance);
    }
    for (const [instance, last] of this.last)
      if (last === session)
        this.last.delete(instance);
  }

  private endIdle(control: PageActivity): void {
    if (!control.isCalling)
      this.end(control);
  }

  private end(control: PageActivity): void {
    this.controls.delete(control.instance);
    control[Symbol.dispose]();
    const marked: string | null = control.markedViewId;
    if (marked !== null)
      this.release(marked);
  }
}
