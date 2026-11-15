/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IPermissionRequest, type IToolCallPermissions, type IToolDescriptor, PermissionDecision, type PermissionOutcome, ToolCall, type ToolResult } from "@noldova/desktop.runtime";
import { FakeModuleLog } from "@noldova/desktop.runtime/testing";
import { vi } from "vitest";

import { PageChangesContextMissingException } from "../../src/exceptions/page-changes-context-missing.exception.ts";
import type { IBrowserTool } from "../../src/interfaces/i-browser-tool.ts";
import { ActionProgress } from "../../src/models/action-progress.ts";
import { SessionStates } from "../../src/models/session-states.ts";
import { ToolKit } from "../../src/models/tool-kit.ts";
import { DatabaseOriginStore } from "../../src/services/database-origin-store.ts";
import { WorkspaceOrigins } from "../../src/services/workspace-origins.ts";
import type { JsonObject } from "../../src/types/json-value.ts";
import { CorePermissionRequests } from "./core-permission-requests.fixture.ts";
import { SqliteModuleDatabase } from "./desktop-fakes.fixture.ts";
import { PermissionAnswers } from "./permission-answers.fixture.ts";
import { ScriptedViews } from "./scripted-views.fixture.ts";

export class ToolBench implements Disposable {
  public static readonly VIEW: string = "view-1";
  public static readonly SESSION: string = "session-1";
  public static readonly BINDINGS: JsonObject = { page: "page-1", profileKey: "workspace-1", agentName: "Builder" };
  private checked: CorePermissionRequests | null = null;
  private readonly requests: IToolCallPermissions = {
    requestAsync: (request: IPermissionRequest, signal: AbortSignal): Promise<PermissionOutcome> =>
      this.checked === null ? Promise.reject(new Error("No tool runs, so no declaration checks the request.")) : this.checked.requestAsync(request, signal)
  };
  public readonly surface: ScriptedViews = new ScriptedViews([ToolBench.VIEW, "view-2"]);
  public readonly database: SqliteModuleDatabase = new SqliteModuleDatabase(DatabaseOriginStore.migrations);
  public readonly sessions: SessionStates = new SessionStates();
  public readonly permissions: PermissionAnswers = new PermissionAnswers();
  public readonly kit: ToolKit;
  public readonly activities: JsonObject[] = [];
  public readonly agents: (readonly [string, string])[] = [];
  public readonly log: FakeModuleLog = new FakeModuleLog();
  public sendingMarks: number = 0;

  public constructor() {
    this.surface.serveWorlds();
    this.surface.instances.set(ToolBench.VIEW, "page-1");
    this.surface.acknowledge(...ScriptedViews.emptyReplies);
    this.surface.answer("Accessibility.getFullAXTree", { nodes: [{ nodeId: "1", role: { value: "RootWebArea" }, name: { value: "Cart" } }] });
    this.permissions.automaticDecision = PermissionDecision.AllowedOnce;
    this.kit = new ToolKit(this.surface.webViews, this.sessions, new WorkspaceOrigins(this.surface.webViews, new DatabaseOriginStore(this.database), []), t => this.activities.push(t),
      t => this.agents.push([t.instance, t.agentName]), this.log);
  }

  public get methods(): readonly string[] {
    return this.surface.calls.map(t => t.method);
  }

  public static settleAsync(): Promise<void> {
    return new Promise<void>(resolve => setImmediate(resolve));
  }

  public keep(profileKey: string, origins: readonly string[]): void {
    this.database.run("DELETE FROM allowed_origins WHERE profile_key = ?", profileKey);
    origins.forEach((origin, position) => this.database.run("INSERT INTO allowed_origins (profile_key, origin, position) VALUES (?, ?, ?)", profileKey, origin, position));
  }

  public keptOrigins(profileKey: string): readonly unknown[] {
    return this.database.readAll("SELECT origin FROM allowed_origins WHERE profile_key = ? ORDER BY position", profileKey).map(t => t["origin"]);
  }

  public failHearing(): void {
    vi.spyOn(this.kit.changes, "hearAsync").mockRejectedValue(new PageChangesContextMissingException(ToolBench.VIEW, "main"));
  }

  public checkAs(descriptor: IToolDescriptor): CorePermissionRequests {
    const core: CorePermissionRequests = new CorePermissionRequests(descriptor, this.permissions, ToolBench.SESSION);
    this.checked = core;
    return core;
  }

  public call(input: JsonObject, controller: AbortController = new AbortController(), session: string = ToolBench.SESSION, milliseconds: number = 5_000): ToolCall {
    return new ToolCall(session, "conversation-1", ToolBench.BINDINGS, input, Date.now() + milliseconds, controller.signal, this.requests);
  }

  public runAsync(tool: IBrowserTool, call: ToolCall): Promise<ToolResult> {
    if (this.checked?.name !== tool.descriptor.name)
      this.checkAs(tool.descriptor);
    return tool.callAsync(call, new ActionProgress(() => this.sendingMarks += 1));
  }

  public [Symbol.dispose](): void {
    this.database[Symbol.dispose]();
  }
}
