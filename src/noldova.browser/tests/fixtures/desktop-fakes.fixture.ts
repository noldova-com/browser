/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import { BrowserToolNames } from "@noldova/browser.protocol";
import { QualifiedName, SettingChange, SettingDefinition, SettingKey } from "@noldova/desktop.protocol";
import { type ClientClosure, EventChannel, EventDeclaredException, type IMethodHandler, type IModuleLog, type Migration, MethodRegisteredException, PermissionCenter,
  SettingUnknownException, ToolDescriptor, ToolRegistry } from "@noldova/desktop.runtime";
import { FakeModuleDatabase, type FakeModuleLog, FakeRuntimePartContext, type FakeRuntimeWebViews, type FakeToolsContext } from "@noldova/desktop.runtime/testing";

import { DatabaseOriginStore } from "../../src/services/database-origin-store.ts";
import { DatabasePageStore } from "../../src/services/database-page-store.ts";
import type { JsonValue } from "../../src/types/json-value.ts";
import { ScriptedViews } from "./scripted-views.fixture.ts";

export type DatabaseCall = "read" | "readAll" | "run" | "transaction";

const DECLARED: unknown = JSON.parse(readFileSync(new URL("../../settings.json", import.meta.url), "utf8"));

function readDefaults(): ReadonlyMap<string, JsonValue> {
  const settings: unknown = typeof DECLARED === "object" && DECLARED !== null && "settings" in DECLARED ? DECLARED.settings : null;
  if (!Array.isArray(settings))
    throw new TypeError("settings.json has no list of settings.");
  return new Map(settings.map((t: unknown): [string, JsonValue] => {
    const definition: SettingDefinition = SettingDefinition.fromJson(t);
    return [definition.name.text, definition.defaultValue];
  }));
}

export function writtenTo(log: FakeModuleLog): readonly string[] {
  return log.callsOf("write").map(([message]) => String(message));
}

export function linesAsync(log: FakeModuleLog, count: number): Promise<readonly string[]> {
  const { promise, resolve }: PromiseWithResolvers<readonly string[]> = Promise.withResolvers<readonly string[]>();
  log.answer("write", () => {
    if (writtenTo(log).length === count)
      resolve(writtenTo(log));
  });
  return promise;
}

export function answerThroughRegistry(tools: FakeToolsContext, log: IModuleLog): ToolRegistry {
  let sessions: number = 0;
  const registry: ToolRegistry = new ToolRegistry(() => `session-${++sessions}`, undefined, new PermissionCenter());
  tools.answer("register", (descriptor, handler) => registry.register("browser", new ToolDescriptor(descriptor, BrowserToolNames.all), handler, BrowserToolNames.all, log));
  tools.answer("openSession", (scope, bindings) => registry.openSession(scope, bindings));
  tools.answer("onSessionEnded", listener => registry.onSessionEnded(listener, log));
  tools.answer("stopAll", reason => registry.stopAll(reason));
  tools.answer("stopSession", (session, reason) => registry.stopSession("browser", session, reason));
  tools.answer("onSessionStopped", listener => registry.onSessionStopped(listener, log));
  tools.answer("resumeAll", () => registry.resumeAll("browser"));
  tools.answer("onStopped", listener => registry.onStopped(listener, log));
  tools.answer("onResumed", listener => registry.onResumed(listener, log));
  return registry;
}

export class SqliteModuleDatabase extends FakeModuleDatabase implements Disposable {
  private readonly connection: DatabaseSync = new DatabaseSync(":memory:");
  private readonly failures: Map<DatabaseCall, Error> = new Map<DatabaseCall, Error>();

  public constructor(migrations: readonly Migration[] = []) {
    super();
    for (const migration of migrations)
      for (const statement of migration.statements)
        this.connection.exec(statement);
    this.answer("read", (statement, ...values) => {
      this.throwIfFailing("read");
      return this.connection.prepare(statement).get(...values);
    });
    this.answer("readAll", (statement, ...values) => {
      this.throwIfFailing("readAll");
      return this.connection.prepare(statement).all(...values);
    });
    this.answer("run", (statement, ...values) => {
      this.throwIfFailing("run");
      return this.connection.prepare(statement).run(...values);
    });
    this.answer("transaction", <T>(action: () => T): T => {
      this.throwIfFailing("transaction");
      this.connection.exec("BEGIN");
      try {
        const result: T = action();
        this.connection.exec("COMMIT");
        return result;
      }
      catch (error) {
        this.connection.exec("ROLLBACK");
        throw error;
      }
    });
  }

  public failNext(call: DatabaseCall, error: Error): void {
    this.failures.set(call, error);
  }

  public [Symbol.dispose](): void {
    this.connection.close();
  }

  private throwIfFailing(call: DatabaseCall): void {
    const error: Error | undefined = this.failures.get(call);
    if (error === undefined)
      return;
    this.failures.delete(call);
    throw error;
  }
}

export class BrowserContext extends FakeRuntimePartContext {
  public override readonly webViews: FakeRuntimeWebViews;
  public override readonly database: SqliteModuleDatabase;
  public readonly views: ScriptedViews;
  public readonly registry: ToolRegistry;
  public readonly settingValues: Map<string, JsonValue> = new Map<string, JsonValue>(readDefaults());
  public readonly methods: Map<string, IMethodHandler> = new Map<string, IMethodHandler>();
  public readonly events: Map<string, JsonValue[]> = new Map<string, JsonValue[]>();

  public constructor(views: ScriptedViews = new ScriptedViews([]), database: SqliteModuleDatabase = new SqliteModuleDatabase([...DatabaseOriginStore.migrations, ...DatabasePageStore.migrations])) {
    super();
    this.views = views;
    this.webViews = views.webViews;
    this.database = database;
    this.registry = answerThroughRegistry(this.tools, this.log);
    this.settings.answer("read", name => {
      const value: JsonValue | undefined = this.settingValues.get(name);
      if (value === undefined)
        throw new SettingUnknownException(name);
      return value;
    });
    this.answer("registerMethod", (name, handler) => {
      if (this.methods.has(name))
        throw new MethodRegisteredException(name);
      this.methods.set(name, handler);
    });
    this.answer("declareEvent", name => {
      if (this.events.has(name))
        throw new EventDeclaredException(name);
      const published: JsonValue[] = [];
      this.events.set(name, published);
      return new EventChannel(t => published.push(t), () => this.events.delete(name));
    });
  }

  public changeSetting(name: string, value: JsonValue): void {
    this.settingValues.set(name, value);
    this.settings.raiseChanged(name, new SettingChange(new SettingKey(QualifiedName.parse(name)), value, true));
  }

  public close(closure: ClientClosure): Promise<void> {
    return this.raiseClientClosedAsync(closure);
  }
}
