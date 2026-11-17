/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { isDeepStrictEqual } from "node:util";

import { RuntimePart } from "@noldova/browser/runtime";
import { TypedAddressAllowed, TypedAddressRequest } from "@noldova/browser.protocol";
import { type JsonObject, JsonReader, type JsonValue } from "@noldova/context.json";
import { QualifiedName, ShellClients, WebViewEvent, WebViewEventKind, WebViewInfo, WebViewPane } from "@noldova/desktop.protocol";
import { EventChannel, type IMethodHandler, type IRuntimePart, Registration, RequestContext } from "@noldova/desktop.runtime";
import { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";

import { InstalledPackageException } from "../../exceptions/installed-package.exception.ts";
import { Resources } from "../../resources.ts";

function expect(actual: unknown, expected: unknown, message: string): void {
  if (!isDeepStrictEqual(JSON.parse(JSON.stringify(actual ?? null)), expected))
    throw new InstalledPackageException(`${message} ${JSON.stringify(actual)}`);
}

const require: NodeJS.Require = createRequire(import.meta.url);
console.log(Resources.formatInstalledRuntimePart(require.resolve(Resources.installedRuntimePackage)));
console.log(Resources.formatInstalledWindowPart(require.resolve(Resources.installedWindowPackage)));
for (const file of Resources.installedDeclarations) {
  const declaration: string = path.join(process.cwd(), Resources.modulesFolder, ...Resources.modulePackageName.split("/"), file);
  if (!existsSync(declaration))
    throw new InstalledPackageException(Resources.formatInstalledDeclarationMissing(file, declaration));
}

const pane: WebViewPane = new WebViewPane(new QualifiedName(Resources.installedModuleId, Resources.installedPaneName));
const part: IRuntimePart = new RuntimePart();
const connection: DatabaseSync = new DatabaseSync(":memory:");
for (const migration of part.migrations ?? [])
  for (const statement of migration.statements)
    connection.exec(statement);

const context: FakeRuntimePartContext = new FakeRuntimePartContext();
const views: WebViewInfo[] = [];
const methods: Map<string, IMethodHandler> = new Map<string, IMethodHandler>();
const tools: string[] = [];
const { promise: originsGiven, resolve: giveOrigins } = Promise.withResolvers<readonly string[]>();
context.database.answer("read", (statement, ...values) => connection.prepare(statement).get(...values));
context.database.answer("readAll", (statement, ...values) => connection.prepare(statement).all(...values));
context.database.answer("run", (statement, ...values) => connection.prepare(statement).run(...values));
context.database.answer("transaction", <T>(action: () => T): T => {
  connection.exec("BEGIN");
  try {
    const result: T = action();
    connection.exec("COMMIT");
    return result;
  }
  catch (error) {
    connection.exec("ROLLBACK");
    throw error;
  }
});
const declared: JsonReader = JsonReader.parse(readFileSync(path.join(process.cwd(), Resources.modulesFolder, ...Resources.modulePackageName.split("/"), Resources.settingsFile), "utf8"));
const defaults: ReadonlyMap<string, JsonValue> = new Map(declared.readObjectArray(Resources.settingsField).map(t => [t.readString(Resources.nameField), t.readValue(Resources.defaultField)]));
context.settings.answer("read", name => defaults.get(name) ?? null);
context.answer("registerMethod", (name, handler) => void methods.set(name, handler));
context.answer("declareEvent", () => new EventChannel(() => undefined, () => undefined));
context.tools.answer("register", descriptor => {
  tools.push(descriptor.name);
  return new Registration(() => undefined);
});
context.webViews.answer("list", () => views);
context.webViews.answer("setAllowedOriginsAsync", (viewId, origins) => {
  if (viewId === Resources.installedView)
    giveOrigins(origins);
  return Promise.resolve();
});
context.webViews.answer("setControlledAsync", () => Promise.resolve());
const following: () => readonly number[] = (): readonly number[] => [context.webViews.activeCallsOf("onViewEvent").length, context.tools.activeCallsOf("onSessionEnded").length];

await part.activateAsync(context);
try {
  expect(following(), [1, 2], Resources.installedNotFollowing);
  expect(tools, Resources.installedTools, Resources.installedWrongTools);
  views.push(new WebViewInfo(Resources.installedView, Resources.installedModuleId, pane, Resources.installedProfileKey));
  context.webViews.raiseViewEvent(new WebViewEvent(Resources.installedModuleId, Resources.installedView, WebViewEventKind.Opened,
    { pane: pane.toJson(), profileKey: Resources.installedProfileKey }));
  await originsGiven;
  console.log(Resources.installedOriginsGiven);
  const handler: IMethodHandler | undefined = methods.get(Resources.installedTypedMethod);
  if (handler === undefined)
    throw new InstalledPackageException(Resources.installedTypedMethodMissing);
  const request: JsonObject = new TypedAddressRequest(Resources.installedProfileKey, Resources.installedTypedUrl).toJson();
  const { promise: originKept, resolve: keepOrigin } = Promise.withResolvers<readonly string[]>();
  context.webViews.answer("setAllowedOriginsAsync", (_viewId, origins) => {
    keepOrigin(origins);
    return Promise.resolve();
  });
  const allowed: JsonObject = new TypedAddressAllowed(Resources.installedTypedOrigin).toJson();
  const answer: unknown = await handler.handleAsync(new RequestContext(ShellClients.mainProcess, { ...request }, new AbortController().signal,
    Resources.installedConnection, Resources.installedWindow));
  expect(answer, allowed, Resources.installedWrongAnswer);
  expect(connection.prepare(Resources.installedKeptOrigins).all(Resources.installedProfileKey), [{ origin: Resources.installedTypedOrigin }], Resources.installedNotKept);
  expect(await originKept, [Resources.installedTypedOrigin], Resources.installedNotGiven);
  console.log(Resources.installedOriginKept);
}
finally {
  await part.deactivateAsync();
  connection.close();
}

const logged: readonly string[] = context.log.callsOf("write").map(([message]) => String(message));
expect(logged, [], Resources.formatInstalledLogged(logged));
expect(following(), [0, 0], Resources.installedStillFollowing);
