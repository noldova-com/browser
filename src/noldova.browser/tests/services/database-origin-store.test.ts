/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { DatabaseOriginStore } from "../../src/services/database-origin-store.ts";
import { SqliteModuleDatabase } from "../fixtures/desktop-fakes.fixture.ts";

describe("DatabaseOriginStore", () => {
  it("reads no origins for a workspace it never kept any for", async () => {
    using database: SqliteModuleDatabase = new SqliteModuleDatabase(DatabaseOriginStore.migrations);

    expect(await new DatabaseOriginStore(database).readAsync("workspace-1")).toEqual([]);
  });

  it("keeps each workspace's origins apart, in the order they were written, and a write replaces them", async () => {
    using database: SqliteModuleDatabase = new SqliteModuleDatabase(DatabaseOriginStore.migrations);
    const store: DatabaseOriginStore = new DatabaseOriginStore(database);

    await store.writeAsync("workspace-1", ["https://b.example", "https://a.example"]);
    await store.writeAsync("workspace-2", ["https://c.example"]);
    await store.writeAsync("workspace-1", ["https://b.example", "https://a.example", "https://d.example"]);

    expect(await store.readAsync("workspace-1")).toEqual(["https://b.example", "https://a.example", "https://d.example"]);
    expect(await store.readAsync("workspace-2")).toEqual(["https://c.example"]);
    expect(await new DatabaseOriginStore(database).readAsync("workspace-1")).toEqual(["https://b.example", "https://a.example", "https://d.example"]);
  });

  it("drops, when it upgrades, each kept origin whose host holds a star or a percent sign, and keeps the others in their order", async () => {
    using database: SqliteModuleDatabase = new SqliteModuleDatabase(DatabaseOriginStore.migrations);
    const store: DatabaseOriginStore = new DatabaseOriginStore(database);
    await store.writeAsync("workspace-1", ["https://b.example", "https://*.com", "https://a.example", "http://*.localhost:3000"]);
    await store.writeAsync("workspace-2", ["https://a%2a.example", "https://c.example"]);

    DatabaseOriginStore.dropStarredMigration.statements.forEach(t => database.run(t));

    expect([await store.readAsync("workspace-1"), await store.readAsync("workspace-2")]).toEqual([["https://b.example", "https://a.example"], ["https://c.example"]]);
  });

  it("rejects a write that fails and leaves the origins the workspace had", async () => {
    using database: SqliteModuleDatabase = new SqliteModuleDatabase(DatabaseOriginStore.migrations);
    const store: DatabaseOriginStore = new DatabaseOriginStore(database);
    await store.writeAsync("workspace-1", ["https://kept.example"]);

    await expect(store.writeAsync("workspace-1", ["https://new.example", "https://new.example"])).rejects.toThrow(/UNIQUE/u);

    expect(await store.readAsync("workspace-1")).toEqual(["https://kept.example"]);
  });

  it("rejects a read that fails", async () => {
    using database: SqliteModuleDatabase = new SqliteModuleDatabase();

    await expect(new DatabaseOriginStore(database).readAsync("workspace-1")).rejects.toThrow(/no such table/u);
  });
});
