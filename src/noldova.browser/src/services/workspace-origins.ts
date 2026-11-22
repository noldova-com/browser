/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type TypedAddressAllowed, type TypedAddressAnswer, TypedAddressAnswerKind, TypedAddressLeft, type TypedAddressRefused, type TypedAddressRequest,
  type TypedRedirectRequest } from "@noldova/browser.protocol";
import type { WebViewInfo } from "@noldova/desktop.protocol";
import type { IRuntimeWebViews } from "@noldova/desktop.runtime";

import { TypedRedirectAfterAgentException } from "../exceptions/typed-redirect-after-agent.exception.ts";
import { TypedRedirectPageNotOpenException } from "../exceptions/typed-redirect-page-not-open.exception.ts";
import { Resources } from "../resources.ts";
import type { DatabaseOriginStore } from "./database-origin-store.ts";
import { TypedAddressPolicy } from "./typed-address-policy.ts";

export class WorkspaceOrigins {
  private readonly views: IRuntimeWebViews;
  private readonly store: DatabaseOriginStore;
  private settingsOrigins: readonly string[];
  private readonly kept: Map<string, Promise<ReadonlySet<string>>> = new Map<string, Promise<ReadonlySet<string>>>();
  private readonly turns: Map<string, Promise<void>> = new Map<string, Promise<void>>();
  private readonly passing: Map<string, ReadonlySet<string>> = new Map<string, ReadonlySet<string>>();
  // Each page whose redirects an agent's call stopped, with the number of that stop, counted across the pages.
  private readonly stopped: Map<string, number> = new Map<string, number>();
  private stops: number = 0;

  public constructor(views: IRuntimeWebViews, store: DatabaseOriginStore, settingsOrigins: readonly string[]) {
    this.views = views;
    this.store = store;
    this.settingsOrigins = settingsOrigins;
  }

  public async allowTypedAsync(request: TypedAddressRequest, isLeft: () => boolean = () => false): Promise<TypedAddressAnswer> {
    const answer: TypedAddressAllowed | TypedAddressRefused = TypedAddressPolicy.judge(request.url, this.settingsOrigins);
    if (answer.kind === TypedAddressAnswerKind.Refused)
      return answer;
    const stopsBefore: number = this.stops;
    return this.inTurnAsync(request.profileKey, async () => {
      const origins: ReadonlySet<string> = await this.readAsync(request.profileKey);
      if (isLeft())
        return new TypedAddressLeft();
      // The settings may have changed while the address waited for its turn, so a local origin they no longer name is refused, never kept.
      const judged: TypedAddressAllowed | TypedAddressRefused = TypedAddressPolicy.judge(request.url, this.settingsOrigins);
      if (judged.kind === TypedAddressAnswerKind.Refused)
        return judged;
      if (!origins.has(judged.origin) && !this.settingsOrigins.includes(judged.origin)) {
        const next: ReadonlySet<string> = new Set([...origins, judged.origin]);
        await this.store.writeAsync(request.profileKey, [...next]);
        this.kept.set(request.profileKey, Promise.resolve(next));
      }
      // A kept address the person typed in a page starts a typed load there, whose redirects pass again until an agent's call starts on it;
      // one left or refused starts none, so the mark stays, and so does a mark of a call that started after the person typed.
      if (!Object.isNull(request.instance))
        for (const view of this.viewsOf(request.instance)) {
          const stop: number | undefined = this.stopped.get(view.id);
          if (!Object.isUndefined(stop) && stop <= stopsBefore)
            this.stopped.delete(view.id);
        }
      await this.applyToWorkspaceAsync(request.profileKey);
      return judged;
    });
  }

  public async passTypedAsync(request: TypedRedirectRequest): Promise<TypedAddressAnswer> {
    const answer: TypedAddressAllowed | TypedAddressRefused = TypedAddressPolicy.judge(request.url, this.settingsOrigins);
    if (answer.kind === TypedAddressAnswerKind.Refused)
      return answer;
    const view: WebViewInfo | undefined = this.viewsOf(request.instance).find(t => t.profileKey === request.profileKey);
    if (Object.isUndefined(view))
      throw new TypedRedirectPageNotOpenException(request.instance, request.profileKey);
    if (this.stopped.has(view.id))
      throw new TypedRedirectAfterAgentException(request.instance);
    this.passing.set(view.id, new Set([...this.passing.get(view.id) ?? [], answer.origin]));
    return this.inTurnAsync(request.profileKey, async () => {
      await this.views.setAllowedOriginsAsync(view.id, await this.originsOfViewAsync(view.id, request.profileKey));
      return answer;
    });
  }

  public isPassing(viewId: string): boolean {
    return this.passing.has(viewId);
  }

  public async endPassingAsync(instance: string): Promise<void> {
    await Promise.all(this.viewsOf(instance).map(t => {
      this.stopped.delete(t.id);
      return this.endViewPassingAsync(t.id, t.profileKey);
    }));
  }

  public stopRedirects(viewId: string): void {
    this.stops += 1;
    this.stopped.set(viewId, this.stops);
  }

  public stopPassingAsync(viewId: string, profileKey: string): Promise<void> {
    this.stopRedirects(viewId);
    if (!this.passing.has(viewId))
      return Promise.resolve();
    return this.endViewPassingAsync(viewId, profileKey);
  }

  public forgetView(viewId: string): void {
    this.passing.delete(viewId);
    this.stopped.delete(viewId);
  }

  public judge(url: string): TypedAddressAllowed | TypedAddressRefused {
    return TypedAddressPolicy.judge(url, this.settingsOrigins);
  }

  public async isAllowedAsync(profileKey: string, origin: string): Promise<boolean> {
    return (await this.originsOfAsync(profileKey)).includes(origin);
  }

  public async changeSettingsAsync(settingsOrigins: readonly string[]): Promise<void> {
    this.settingsOrigins = settingsOrigins;
    const workspaces: ReadonlySet<string> = new Set(this.views.list().map(t => t.profileKey));
    await Promise.all([...workspaces].map(t => this.inTurnAsync(t, async () => this.applyToWorkspaceAsync(t))));
  }

  public async readyAsync(instance: string): Promise<boolean> {
    const views: readonly WebViewInfo[] = this.viewsOf(instance);
    await Promise.all(views.map(t => this.applyAsync(t.id, t.profileKey)));
    return views.length > 0;
  }

  public applyAsync(viewId: string, profileKey: string): Promise<void> {
    return this.inTurnAsync(profileKey, async () => this.views.setAllowedOriginsAsync(viewId, await this.originsOfViewAsync(viewId, profileKey)));
  }

  private async applyToWorkspaceAsync(profileKey: string): Promise<void> {
    const views: readonly WebViewInfo[] = this.views.list().filter(t => t.profileKey === profileKey);
    await Promise.all(views.map(async t => this.views.setAllowedOriginsAsync(t.id, await this.originsOfViewAsync(t.id, profileKey))));
  }

  private async originsOfAsync(profileKey: string): Promise<readonly string[]> {
    return [...new Set([...this.settingsOrigins, ...await this.readAsync(profileKey)])];
  }

  private async originsOfViewAsync(viewId: string, profileKey: string): Promise<readonly string[]> {
    return [...new Set([...await this.originsOfAsync(profileKey), ...this.passing.get(viewId) ?? []])];
  }

  private endViewPassingAsync(viewId: string, profileKey: string): Promise<void> {
    return this.passing.delete(viewId) ? this.applyAsync(viewId, profileKey) : Promise.resolve();
  }

  private viewsOf(instance: string): readonly WebViewInfo[] {
    return this.views.list().filter(t => t.pane.name.text === Resources.pageDocument && t.pane.instance === instance);
  }

  private inTurnAsync<T>(profileKey: string, work: () => Promise<T>): Promise<T> {
    const result: Promise<T> = (this.turns.get(profileKey) ?? Promise.resolve()).then(work);
    this.turns.set(profileKey, result.then(() => undefined, () => undefined));
    return result;
  }

  private readAsync(profileKey: string): Promise<ReadonlySet<string>> {
    let origins: Promise<ReadonlySet<string>> | undefined = this.kept.get(profileKey);
    if (Object.isUndefined(origins)) {
      origins = this.store.readAsync(profileKey).then(t => new Set(t), error => {
        this.kept.delete(profileKey);
        throw error;
      });
      this.kept.set(profileKey, origins);
    }
    return origins;
  }
}
