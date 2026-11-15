/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "../types/json-value.ts";
import type { PageActivity } from "./page-activity.ts";

export class PageStops {
  private readonly running: Map<string, Set<PageActivity>> = new Map<string, Set<PageActivity>>();
  private readonly last: Map<string, string> = new Map<string, string>();
  private readonly takenOver: Map<string, Set<string>> = new Map<string, Set<string>>();
  private readonly stopped: Map<string, number> = new Map<string, number>();

  public generationOf(instance: string): number {
    return this.stopped.get(instance) ?? 0;
  }

  public activities(): JsonObject[] {
    return [...this.running.values()].flatMap(t => [...t].map(activity => activity.toPayload()));
  }

  public isTakenOver(instance: string, session: string): boolean {
    return this.takenOver.get(instance)?.has(session) === true;
  }

  public add(activity: PageActivity): void {
    const activities: Set<PageActivity> = this.running.get(activity.instance) ?? new Set<PageActivity>();
    activities.add(activity);
    this.running.set(activity.instance, activities);
    this.last.set(activity.instance, activity.session);
  }

  public remove(activity: PageActivity): void {
    const activities: Set<PageActivity> | undefined = this.running.get(activity.instance);
    activities?.delete(activity);
    if (activities?.size === 0)
      this.running.delete(activity.instance);
  }

  public stop(instance: string, isTakingOver: boolean): void {
    this.stopped.set(instance, this.generationOf(instance) + 1);
    for (const activity of [...this.running.get(instance) ?? []])
      activity.stop();
    const session: string | undefined = this.last.get(instance);
    if (!isTakingOver || session === undefined)
      return;
    const sessions: Set<string> = this.takenOver.get(instance) ?? new Set<string>();
    sessions.add(session);
    this.takenOver.set(instance, sessions);
  }

  public endSession(session: string): void {
    for (const [instance, sessions] of this.takenOver) {
      sessions.delete(session);
      if (sessions.size === 0)
        this.takenOver.delete(instance);
    }
    for (const [instance, last] of this.last)
      if (last === session)
        this.last.delete(instance);
  }
}
