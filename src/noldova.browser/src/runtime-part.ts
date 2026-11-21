/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { BrowserEvents, BrowserMethods, HeldPages, LocalSites, PageAgent, PageClaim, type PageRecord } from "@noldova/browser.protocol";
import { Failure, FailureCode, ShellClients, WebViewEventKind, type WebViewEvent } from "@noldova/desktop.protocol";
import { type EventChannel, type IModuleLog, type IRuntimePart, type IRuntimePartContext, MethodFailureException, type Migration, ProductInfo, type RequestContext } from "@noldova/desktop.runtime";

import { PageHolders } from "./models/page-holders.ts";
import type { SessionPage } from "./models/session-page.ts";
import { SessionStates } from "./models/session-states.ts";
import { ToolKit } from "./models/tool-kit.ts";
import { Resources } from "./resources.ts";
import { DatabaseOriginStore } from "./services/database-origin-store.ts";
import { DatabasePageStore } from "./services/database-page-store.ts";
import { PageRequests } from "./services/page-requests.ts";
import { ToolHost } from "./services/tool-host.ts";
import { TypedAddressRequests } from "./services/typed-address-requests.ts";
import { WorkspaceOrigins } from "./services/workspace-origins.ts";
import { BrowserTools } from "./tools/browser-tools.ts";
import type { JsonValue } from "./types/json-value.ts";

export class RuntimePart implements IRuntimePart {
  private registrations: readonly Disposable[] = [];
  private stopEvents: (() => void) | null = null;
  // A database's applied migrations must be a prefix of this list, so a new migration goes last.
  public readonly migrations: readonly Migration[] = [...DatabaseOriginStore.migrations, ...DatabasePageStore.migrations, DatabaseOriginStore.dropStarredMigration];

  public activateAsync(context: IRuntimePartContext): Promise<void> {
    const sessions: SessionStates = new SessionStates();
    const host: ToolHost = new ToolHost(context.tools, sessions, context.settings);
    const origins: WorkspaceOrigins = new WorkspaceOrigins(context.webViews, new DatabaseOriginStore(context.database), RuntimePart.readLocalSites(context));
    context.settings.onChanged(Resources.localSitesSetting, () => void origins.changeSettingsAsync(RuntimePart.readLocalSites(context))
      .catch((error: unknown) => context.log.write(Resources.formatLocalSitesNotApplied(String(error)))));
    const pages: DatabasePageStore = new DatabasePageStore(context.database);
    const holders: PageHolders = new PageHolders();
    const registrations: Disposable[] = [host.start()];
    try {
      const activities: EventChannel = context.declareEvent(BrowserEvents.pageActivity);
      registrations.push(activities);
      const kit: ToolKit = new ToolKit(context.webViews, sessions, origins, t => activities.publish(t), t => RuntimePart.recordAgent(pages, t, context.log), context.log);
      registrations.push(context.tools.onSessionEnded(t => kit.stops.endSession(t)));
      for (const tool of BrowserTools.create(kit))
        registrations.push(host.register(tool));
      context.registerMethod(BrowserMethods.allowTypedAddress, {
        handleAsync: async t => (await origins.allowTypedAsync(TypedAddressRequests.read(RuntimePart.fromWindow(t).payload))).toJson()
      });
      context.registerMethod(BrowserMethods.passTypedRedirect, {
        handleAsync: async t => (await origins.passTypedAsync(PageRequests.readRedirect(RuntimePart.fromWindow(t).payload))).toJson()
      });
      context.registerMethod(BrowserMethods.endTypedRedirects, {
        handleAsync: async t => {
          await origins.endPassingAsync(PageRequests.readPage(RuntimePart.fromWindow(t).payload).instance);
          return null;
        }
      });
      context.registerMethod(BrowserMethods.readyPage, {
        handleAsync: async t => {
          const instance: string = PageRequests.readPage(RuntimePart.fromWindow(t).payload).instance;
          if (!await origins.readyAsync(instance))
            context.log.write(Resources.formatNoViewToReady(instance));
          return null;
        }
      });
      context.registerMethod(BrowserMethods.rememberPage, {
        handleAsync: t => RuntimePart.answer(() => {
          const record: PageRecord = PageRequests.readRecord(RuntimePart.fromWindow(t).payload);
          if (holders.claim(record.instance, t).isClaimed)
            pages.write(record);
          return null;
        })
      });
      context.registerMethod(BrowserMethods.readPage, {
        handleAsync: t => RuntimePart.answer(() => {
          const record: PageRecord | null = pages.read(PageRequests.readPage(RuntimePart.fromWindow(t).payload).instance);
          return record === null ? null : record.toJson();
        })
      });
      context.registerMethod(BrowserMethods.forgetPage, {
        handleAsync: t => RuntimePart.answer(() => {
          const instance: string = PageRequests.readPage(RuntimePart.fromWindow(t).payload).instance;
          if (!holders.isHeldElsewhere(instance, t)) {
            pages.delete(instance);
            holders.letGo(instance);
            kit.stops.close(instance);
          }
          return null;
        })
      });
      context.registerMethod(BrowserMethods.claimPage, {
        handleAsync: t => RuntimePart.answer(() => {
          const instance: string = PageRequests.readPage(RuntimePart.fromWindow(t).payload).instance;
          const { isClaimed, isHere } = holders.claim(instance, t);
          const record: PageRecord | null = isClaimed ? pages.read(instance) : null;
          return new PageClaim(isClaimed, isHere, record, isClaimed ? pages.readAgent(instance) : null).toJson();
        })
      });
      context.registerMethod(BrowserMethods.holdPages, {
        handleAsync: t => RuntimePart.answer(() => {
          const instances: readonly string[] = PageRequests.readOpenPages(RuntimePart.fromWindow(t).payload).instances;
          const held: readonly string[] = instances.filter(u => holders.claim(u, t).isClaimed);
          const agents: readonly PageAgent[] = held.flatMap(u => {
            const agentName: string | null = pages.readAgent(u);
            return agentName === null ? [] : [new PageAgent(u, agentName)];
          });
          return new HeldPages(instances.filter(u => !held.includes(u)), agents).toJson();
        })
      });
      context.registerMethod(BrowserMethods.letGoPage, {
        handleAsync: t => RuntimePart.answer(() => {
          const instance: string = PageRequests.readPage(RuntimePart.fromWindow(t).payload).instance;
          if (!holders.isHeldElsewhere(instance, t))
            holders.letGo(instance);
          return null;
        })
      });
      context.registerMethod(BrowserMethods.clearBrowsingData, {
        handleAsync: async t => {
          await context.webViews.clearProfileAsync(PageRequests.readBrowsingData(RuntimePart.fromWindow(t).payload).profileKey);
          return null;
        }
      });
      context.registerMethod(BrowserMethods.stopPage, {
        handleAsync: t => RuntimePart.answer(() => {
          const { instance, isTakingOver } = PageRequests.readStop(RuntimePart.fromWindow(t).payload);
          kit.stops.stop(instance, isTakingOver);
          return null;
        })
      });
      context.registerMethod(BrowserMethods.readActivities, {
        handleAsync: t => RuntimePart.answer(() => {
          RuntimePart.fromWindow(t);
          return kit.stops.activities();
        })
      });
      context.registerMethod(BrowserMethods.readAppName, { handleAsync: () => RuntimePart.answer(() => ProductInfo.current.name) });
      context.onClientClosed(t => holders.close(t));
      this.stopEvents = context.webViews.onViewEvent(t => RuntimePart.follow(t, sessions, kit, origins, context.log));
      for (const view of context.webViews.list())
        kit.letGoUnheld(view.id);
    }
    catch (error) {
      RuntimePart.dispose(registrations);
      return Promise.reject(error);
    }
    this.registrations = registrations;
    for (const view of context.webViews.list())
      RuntimePart.apply(origins, view.id, view.profileKey, context.log);
    return Promise.resolve();
  }

  public deactivateAsync(): Promise<void> {
    this.stopEvents?.();
    this.stopEvents = null;
    RuntimePart.dispose(this.registrations);
    this.registrations = [];
    return Promise.resolve();
  }

  // Noldova Desktop keeps a view's control mark through a restart of the runtime part, whose controls end with it, and lists or reports the
  // views again after it, so each that no control holds stops being marked.
  private static follow(event: WebViewEvent, sessions: SessionStates, kit: ToolKit, origins: WorkspaceOrigins, log: IModuleLog): void {
    switch (event.kind) {
      case WebViewEventKind.Opened:
        RuntimePart.apply(origins, event.view, String(event.details[Resources.profileKeyField]), log);
        kit.letGoUnheld(event.view);
        break;
      case WebViewEventKind.Closed:
        sessions.dropView(event.view);
        origins.forgetView(event.view);
        kit.domains.close(event.view);
        break;
      case WebViewEventKind.Crashed:
        sessions.dropReferences(event.view);
        kit.domains.drop(event.view);
        break;
      case WebViewEventKind.ProfileCleared:
        sessions.dropReferences(event.view);
        break;
      default:
        break;
    }
  }

  private static recordAgent(pages: DatabasePageStore, page: SessionPage, log: IModuleLog): void {
    try {
      pages.writeAgent(page.instance, page.agentName);
    }
    catch (error) {
      log.write(Resources.formatAgentNotRecorded(String(error)));
    }
  }

  private static readLocalSites(context: IRuntimePartContext): readonly string[] {
    const sites: LocalSites = LocalSites.read(String(context.settings.read(Resources.localSitesSetting)));
    if (sites.ignored.length > 0)
      context.log.write(Resources.formatIgnoredLocalSites(sites.ignored));
    return sites.origins;
  }

  private static apply(origins: WorkspaceOrigins, viewId: string, profileKey: string, log: IModuleLog): void {
    void origins.applyAsync(viewId, profileKey).catch((error: unknown) => log.write(Resources.formatOriginsNotApplied(viewId, String(error))));
  }

  private static fromWindow(request: RequestContext): RequestContext {
    if (request.window === null || request.client !== ShellClients.mainProcess)
      throw new MethodFailureException(new Failure(FailureCode.Unauthorized, Resources.requestNotFromWindow));
    return request;
  }

  private static answer(run: () => JsonValue): Promise<JsonValue> {
    try {
      return Promise.resolve(run());
    }
    catch (error: unknown) {
      return Promise.reject(error);
    }
  }

  private static dispose(registrations: readonly Disposable[]): void {
    for (const registration of registrations)
      registration[Symbol.dispose]();
  }
}
