/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TypedAddressRequest, TypedRedirectRequest } from "@noldova/browser.protocol";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TypedRedirectAfterAgentException } from "../../src/exceptions/typed-redirect-after-agent.exception.ts";
import { TypedRedirectPageNotOpenException } from "../../src/exceptions/typed-redirect-page-not-open.exception.ts";
import { DatabaseOriginStore } from "../../src/services/database-origin-store.ts";
import { WorkspaceOrigins } from "../../src/services/workspace-origins.ts";
import { SqliteModuleDatabase } from "../fixtures/desktop-fakes.fixture.ts";
import { ScriptedViews } from "../fixtures/scripted-views.fixture.ts";

class HeldApplies {
  private readonly reaching: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private readonly holding: PromiseWithResolvers<void> = Promise.withResolvers<void>();

  public constructor(surface: ScriptedViews) {
    surface.allowing = () => {
      this.reaching.resolve();
      return this.holding.promise;
    };
  }

  public get reached(): Promise<void> {
    return this.reaching.promise;
  }

  public release(): void {
    this.holding.resolve();
  }
}

describe("WorkspaceOrigins", () => {
  const SETTINGS: readonly string[] = ["https://docs.example", "http://localhost:3000"];
  let surface: ScriptedViews;
  let database: SqliteModuleDatabase;
  let origins: WorkspaceOrigins;

  function keep(profileKey: string, kept: readonly string[]): void {
    kept.forEach((origin, position) => database.run("INSERT INTO allowed_origins (profile_key, origin, position) VALUES (?, ?, ?)", profileKey, origin, position));
  }

  function keptOrigins(profileKey: string): readonly unknown[] {
    return database.readAll("SELECT origin FROM allowed_origins WHERE profile_key = ? ORDER BY position", profileKey).map(t => t["origin"]);
  }

  function writes(): number {
    return database.callsOf("transaction").length;
  }

  function reads(): number {
    return database.callsOf("readAll").length;
  }

  beforeEach(() => {
    surface = new ScriptedViews(["view-1", "view-2", "view-3"]);
    surface.profileKeys.set("view-3", "workspace-2");
    database = new SqliteModuleDatabase(DatabaseOriginStore.migrations);
    origins = new WorkspaceOrigins(surface.webViews, new DatabaseOriginStore(database), SETTINGS);
  });

  afterEach(() => {
    database[Symbol.dispose]();
  });

  it("answers Left and keeps nothing when the typed address is left before its origin is kept", async () => {
    expect(await origins.allowTypedAsync(new TypedAddressRequest("workspace-1", "https://example.com/docs"), () => true)).toEqual({ kind: "Left" });

    expect([writes(), keptOrigins("workspace-1"), [...surface.allowedOrigins]]).toEqual([0, [], []]);
  });

  it("allows a typed address's origin in its workspace, keeps it, and gives every view of that workspace only, the settings' origins first", async () => {
    expect(await origins.allowTypedAsync(new TypedAddressRequest("workspace-1", "https://example.com/docs"))).toEqual({ kind: "Allowed", origin: "https://example.com" });

    expect([writes(), keptOrigins("workspace-1")]).toEqual([1, ["https://example.com"]]);
    expect([...surface.allowedOrigins]).toEqual([
      ["view-1", ["https://docs.example", "http://localhost:3000", "https://example.com"]],
      ["view-2", ["https://docs.example", "http://localhost:3000", "https://example.com"]]
    ]);
  });

  it("keeps an origin once, and keeps none that the app's settings already give", async () => {
    await origins.allowTypedAsync(new TypedAddressRequest("workspace-1", "https://example.com/a"));
    await origins.allowTypedAsync(new TypedAddressRequest("workspace-1", "https://example.com/b"));
    await origins.allowTypedAsync(new TypedAddressRequest("workspace-1", "https://docs.example/guide"));
    await origins.allowTypedAsync(new TypedAddressRequest("workspace-1", "http://localhost:3000/"));

    expect([writes(), keptOrigins("workspace-1")]).toEqual([1, ["https://example.com"]]);
    expect(surface.allowedOrigins.get("view-1")).toEqual(["https://docs.example", "http://localhost:3000", "https://example.com"]);
  });

  it("refuses an address the policy refuses, and keeps and gives nothing", async () => {
    expect(await origins.allowTypedAsync(new TypedAddressRequest("workspace-1", "http://192.168.1.2/"))).toEqual({ kind: "Refused", reason: "Local" });
    expect(await origins.allowTypedAsync(new TypedAddressRequest("workspace-1", "file:///etc/hosts"))).toEqual({ kind: "Refused", reason: "NotWeb" });
    expect(await origins.allowTypedAsync(new TypedAddressRequest("workspace-1", "https://*.com/"))).toEqual({ kind: "Refused", reason: "NotAnAddress" });

    expect([reads(), writes(), surface.allowedOrigins.size]).toEqual([0, 0, 0]);
  });

  it("starts from the origins kept for the workspace, read once", async () => {
    keep("workspace-1", ["https://kept.example"]);

    await origins.allowTypedAsync(new TypedAddressRequest("workspace-1", "https://example.com/"));
    await origins.applyAsync("view-1", "workspace-1");

    expect([reads(), writes(), keptOrigins("workspace-1")]).toEqual([1, 1, ["https://kept.example", "https://example.com"]]);
    expect(surface.allowedOrigins.get("view-1")).toEqual(["https://docs.example", "http://localhost:3000", "https://kept.example", "https://example.com"]);
  });

  it("says an origin is allowed in a workspace when the settings give it or that workspace keeps it", async () => {
    await origins.allowTypedAsync(new TypedAddressRequest("workspace-2", "https://example.com/"));

    expect(await Promise.all([
      origins.isAllowedAsync("workspace-2", "https://example.com"),
      origins.isAllowedAsync("workspace-1", "https://example.com"),
      origins.isAllowedAsync("workspace-1", "https://docs.example"),
      origins.isAllowedAsync("workspace-1", "https://docs.example.evil")
    ])).toEqual([true, false, true, false]);
  });

  it("gives a view that opens its workspace's origins", async () => {
    await origins.allowTypedAsync(new TypedAddressRequest("workspace-2", "https://example.com/"));
    surface.allowedOrigins.clear();

    await origins.applyAsync("view-1", "workspace-1");
    await origins.applyAsync("view-3", "workspace-2");

    expect([...surface.allowedOrigins]).toEqual([
      ["view-1", ["https://docs.example", "http://localhost:3000"]],
      ["view-3", ["https://docs.example", "http://localhost:3000", "https://example.com"]]
    ]);
  });

  it("gives every open view of each workspace the settings' new origins with the ones it keeps, and judges by them from then on", async () => {
    await origins.allowTypedAsync(new TypedAddressRequest("workspace-2", "https://example.com/"));
    surface.allowedOrigins.clear();

    await origins.changeSettingsAsync(["http://127.0.0.1:4173"]);

    expect(surface.allowedOrigins).toEqual(new Map([
      ["view-1", ["http://127.0.0.1:4173"]],
      ["view-2", ["http://127.0.0.1:4173"]],
      ["view-3", ["http://127.0.0.1:4173", "https://example.com"]]
    ]));
    expect([origins.judge("http://127.0.0.1:4173/form"), origins.judge("http://localhost:3000/"), await origins.isAllowedAsync("workspace-1", "https://docs.example")])
      .toEqual([{ kind: "Allowed", origin: "http://127.0.0.1:4173" }, { kind: "Refused", reason: "Local" }, false]);
  });

  it("refuses and keeps no local origin whose setting was removed while its typed address waited for the workspace's turn", async () => {
    const held: HeldApplies = new HeldApplies(surface);
    const first: Promise<unknown> = origins.allowTypedAsync(new TypedAddressRequest("workspace-1", "https://one.example/"));
    const local: Promise<unknown> = origins.allowTypedAsync(new TypedAddressRequest("workspace-1", "http://localhost:3000/"));
    await held.reached;

    const changing: Promise<void> = origins.changeSettingsAsync(["https://docs.example"]);
    held.release();

    expect(await local).toEqual({ kind: "Refused", reason: "Local" });
    await Promise.all([first, changing]);
    expect([keptOrigins("workspace-1"), await origins.isAllowedAsync("workspace-1", "http://localhost:3000")]).toEqual([["https://one.example"], false]);
  });

  it("gives no closed view the origins", async () => {
    surface.close("view-2");

    await origins.allowTypedAsync(new TypedAddressRequest("workspace-1", "https://example.com/"));

    expect([...surface.allowedOrigins.keys()]).toEqual(["view-1"]);
  });

  it("fails when the kept origins can't be read, and reads them again next time", async () => {
    database.failNext("readAll", new Error("The database is closed."));

    await expect(origins.allowTypedAsync(new TypedAddressRequest("workspace-1", "https://example.com/"))).rejects.toThrow("The database is closed.");
    expect(await origins.allowTypedAsync(new TypedAddressRequest("workspace-1", "https://example.com/"))).toEqual({ kind: "Allowed", origin: "https://example.com" });

    expect(reads()).toBe(2);
  });

  it("fails and allows nothing when the origin can't be kept, and keeps it the next time", async () => {
    database.failNext("transaction", new Error("The disk is full."));

    await expect(origins.allowTypedAsync(new TypedAddressRequest("workspace-1", "https://example.com/"))).rejects.toThrow("The disk is full.");
    expect([await origins.isAllowedAsync("workspace-1", "https://example.com"), keptOrigins("workspace-1"), surface.allowedOrigins.size]).toEqual([false, [], 0]);
    await origins.allowTypedAsync(new TypedAddressRequest("workspace-1", "https://example.com/"));

    expect(keptOrigins("workspace-1")).toEqual(["https://example.com"]);
  });

  it("writes one at a time, each with the whole set, the next only once the one before it was given to the views", async () => {
    const held: HeldApplies = new HeldApplies(surface);

    const first: Promise<unknown> = origins.allowTypedAsync(new TypedAddressRequest("workspace-1", "https://one.example/"));
    const second: Promise<unknown> = origins.allowTypedAsync(new TypedAddressRequest("workspace-1", "https://two.example/"));
    await held.reached;
    const whileHeld: readonly unknown[] = [writes(), keptOrigins("workspace-1")];
    held.release();
    await Promise.all([first, second]);

    expect(whileHeld).toEqual([1, ["https://one.example"]]);
    expect([writes(), keptOrigins("workspace-1")]).toEqual([2, ["https://one.example", "https://two.example"]]);
  });

  it("writes again after a write failed before it, and keeps only what that write kept", async () => {
    database.failNext("transaction", new Error("The disk is full."));

    const first: Promise<unknown> = origins.allowTypedAsync(new TypedAddressRequest("workspace-1", "https://one.example/"));
    const second: Promise<unknown> = origins.allowTypedAsync(new TypedAddressRequest("workspace-1", "https://two.example/"));

    await expect(first).rejects.toThrow("The disk is full.");
    expect(await second).toEqual({ kind: "Allowed", origin: "https://two.example" });
    expect(keptOrigins("workspace-1")).toEqual(["https://two.example"]);
    expect(surface.allowedOrigins.get("view-1")).toEqual(["https://docs.example", "http://localhost:3000", "https://two.example"]);
  });

  it("gives a view that opens while the views are being given a kept origin that origin, once they have it", async () => {
    const held: HeldApplies = new HeldApplies(surface);

    const allowing: Promise<unknown> = origins.allowTypedAsync(new TypedAddressRequest("workspace-1", "https://example.com/"));
    const applying: Promise<void> = origins.applyAsync("view-2", "workspace-1");
    await held.reached;
    const whileHeld: number = surface.allowedOrigins.size;
    held.release();
    await Promise.all([allowing, applying]);

    expect(whileHeld).toBe(0);
    expect(surface.allowedOrigins.get("view-2")).toEqual(["https://docs.example", "http://localhost:3000", "https://example.com"]);
  });

  it("lets a page's view alone follow a typed address's redirect, keeps nothing, and gives it back its workspace's origins once the load ends", async () => {
    surface.instances.set("view-1", "page-1");
    const pass = (url: string): Promise<unknown> => origins.passTypedAsync(new TypedRedirectRequest("page-1", "workspace-1", url));

    expect([await pass("https://www.example.com/"), await pass("https://consent.example.net/a")])
      .toEqual([{ kind: "Allowed", origin: "https://www.example.com" }, { kind: "Allowed", origin: "https://consent.example.net" }]);
    expect([writes(), [...surface.allowedOrigins], origins.isPassing("view-1"), await origins.isAllowedAsync("workspace-1", "https://www.example.com")]).toEqual([0,
      [["view-1", [...SETTINGS, "https://www.example.com", "https://consent.example.net"]]], true, false]);
    await origins.allowTypedAsync(new TypedAddressRequest("workspace-1", "https://consent.example.net/"));
    expect([...surface.allowedOrigins]).toEqual([["view-1", [...SETTINGS, "https://consent.example.net", "https://www.example.com"]], ["view-2", [...SETTINGS, "https://consent.example.net"]]]);
    await origins.endPassingAsync("page-1");

    expect([surface.allowedOrigins.get("view-1"), origins.isPassing("view-1")]).toEqual([[...SETTINGS, "https://consent.example.net"], false]);
    surface.allowedOrigins.clear();
    await origins.endPassingAsync("page-1");
    await origins.stopPassingAsync("view-1", "workspace-1");
    expect(surface.allowedOrigins.size).toBe(0);
  });

  it("follows none of a typed load's redirects once an agent's call started before the first one, until the person types an address in that page again", async () => {
    surface.instances.set("view-1", "page-1");
    surface.instances.set("view-2", "page-2");
    const pass = (): Promise<unknown> => origins.passTypedAsync(new TypedRedirectRequest("page-1", "workspace-1", "https://www.example.com/"));

    origins.stopRedirects("view-1");

    await expect(pass()).rejects.toThrow(TypedRedirectAfterAgentException);
    expect([surface.allowedOrigins.get("view-1"), origins.isPassing("view-1")]).toEqual([undefined, false]);
    await origins.allowTypedAsync(new TypedAddressRequest("workspace-2", "https://example.com/", "page-2"));
    await origins.allowTypedAsync(new TypedAddressRequest("workspace-1", "https://192.168.1.2/", "page-1"));
    await expect(pass()).rejects.toThrow(TypedRedirectAfterAgentException);
    await origins.allowTypedAsync(new TypedAddressRequest("workspace-1", "https://example.com/", "page-1"));
    expect(await pass()).toEqual({ kind: "Allowed", origin: "https://www.example.com" });
  });

  it("keeps a page's redirects stopped when the address the person typed there is left before its turn keeps it", async () => {
    surface.instances.set("view-1", "page-1");
    origins.stopRedirects("view-1");

    const answer: unknown = await origins.allowTypedAsync(new TypedAddressRequest("workspace-1", "https://example.com/", "page-1"), () => true);

    expect(answer).toEqual({ kind: "Left" });
    await expect(origins.passTypedAsync(new TypedRedirectRequest("page-1", "workspace-1", "https://www.example.com/"))).rejects.toThrow(TypedRedirectAfterAgentException);
  });

  it("keeps a page's redirects stopped when an agent's call starts there while the turn of the address the person typed waits", async () => {
    surface.instances.set("view-1", "page-1");
    const held: HeldApplies = new HeldApplies(surface);

    const first: Promise<unknown> = origins.allowTypedAsync(new TypedAddressRequest("workspace-1", "https://one.example/"));
    const typed: Promise<unknown> = origins.allowTypedAsync(new TypedAddressRequest("workspace-1", "https://example.com/", "page-1"));
    await held.reached;
    origins.stopRedirects("view-1");
    held.release();

    expect(await Promise.all([first, typed])).toEqual([{ kind: "Allowed", origin: "https://one.example" }, { kind: "Allowed", origin: "https://example.com" }]);
    await expect(origins.passTypedAsync(new TypedRedirectRequest("page-1", "workspace-1", "https://www.example.com/"))).rejects.toThrow(TypedRedirectAfterAgentException);
  });

  it("refuses a redirect the policy refuses, fails one for a page that isn't open in its workspace, and gives nothing", async () => {
    surface.instances.set("view-3", "page-3");

    expect(await origins.passTypedAsync(new TypedRedirectRequest("page-3", "workspace-2", "http://192.168.1.2/"))).toEqual({ kind: "Refused", reason: "Local" });
    expect(await origins.passTypedAsync(new TypedRedirectRequest("page-3", "workspace-2", "https://*.com/"))).toEqual({ kind: "Refused", reason: "NotAnAddress" });
    await expect(origins.passTypedAsync(new TypedRedirectRequest("page-3", "workspace-1", "https://example.com/"))).rejects.toThrow(TypedRedirectPageNotOpenException);
    await expect(origins.passTypedAsync(new TypedRedirectRequest("page-9", "workspace-2", "https://example.com/"))).rejects.toThrow(TypedRedirectPageNotOpenException);
    expect([writes(), surface.allowedOrigins.size, origins.isPassing("view-3")]).toEqual([0, 0, false]);
  });

  it("ends a redirect whose end the window sent before the view got its origin", async () => {
    surface.instances.set("view-1", "page-1");

    const passing: Promise<unknown> = origins.passTypedAsync(new TypedRedirectRequest("page-1", "workspace-1", "https://www.example.com/"));
    await origins.endPassingAsync("page-1");
    await passing;

    expect([surface.allowedOrigins.get("view-1"), origins.isPassing("view-1")]).toEqual([SETTINGS, false]);
  });

  it("follows none of a typed load's redirects once an agent's call ended them, until the window ends that load", async () => {
    surface.instances.set("view-1", "page-1");
    const pass = (): Promise<unknown> => origins.passTypedAsync(new TypedRedirectRequest("page-1", "workspace-1", "https://www.example.com/"));
    await pass();

    await origins.stopPassingAsync("view-1", "workspace-1");

    expect(surface.allowedOrigins.get("view-1")).toEqual(SETTINGS);
    await expect(pass()).rejects.toThrow(TypedRedirectAfterAgentException);
    expect([surface.allowedOrigins.get("view-1"), origins.isPassing("view-1")]).toEqual([SETTINGS, false]);
    await origins.endPassingAsync("page-1");
    expect(await pass()).toEqual({ kind: "Allowed", origin: "https://www.example.com" });
  });

  it("forgets the redirects of a view that closed, and that an agent acted on it", async () => {
    surface.instances.set("view-1", "page-1");
    const pass = (): Promise<unknown> => origins.passTypedAsync(new TypedRedirectRequest("page-1", "workspace-1", "https://www.example.com/"));
    await pass();
    await origins.stopPassingAsync("view-1", "workspace-1");
    await pass().catch(() => null);

    origins.forgetView("view-1");

    expect([origins.isPassing("view-1"), await pass()]).toEqual([false, { kind: "Allowed", origin: "https://www.example.com" }]);
  });

  it("refuses a link to a host that holds a star, and keeps and gives nothing", async () => {
    expect(await origins.allowTypedAsync(new TypedAddressRequest("links", "https://*.com/"))).toEqual({ kind: "Refused", reason: "NotAnAddress" });

    expect([keptOrigins("links"), writes(), surface.allowedOrigins.size]).toEqual([[], 0, 0]);
  });

  it("allows an origin in a workspace that no open view has yet, as a link's first page needs, and gives it to that workspace's first view", async () => {
    expect(await origins.allowTypedAsync(new TypedAddressRequest("links", "https://example.com/"))).toEqual({ kind: "Allowed", origin: "https://example.com" });

    expect([keptOrigins("links"), surface.allowedOrigins.size]).toEqual([["https://example.com"], 0]);
    surface.open("view-9", "links");
    await origins.applyAsync("view-9", "links");
    expect(surface.allowedOrigins.get("view-9")).toEqual(["https://docs.example", "http://localhost:3000", "https://example.com"]);
  });
});
