/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PageRecord } from "@noldova/browser.protocol";
import { describe, expect, it } from "vitest";

import { DatabasePageStore } from "../../src/services/database-page-store.ts";
import { SqliteModuleDatabase } from "../fixtures/desktop-fakes.fixture.ts";

describe("DatabasePageStore", () => {
  const instance: string = "0f8fad5b-d9cb-469f-a165-70867728950e";

  it("reads no record for an instance it never kept", () => {
    using database: SqliteModuleDatabase = new SqliteModuleDatabase(DatabasePageStore.migrations);

    expect(new DatabasePageStore(database).read(instance)).toBeNull();
  });

  it("keeps each instance's workspace and address, a later write replaces them, and another store on the database reads them", () => {
    using database: SqliteModuleDatabase = new SqliteModuleDatabase(DatabasePageStore.migrations);
    const store: DatabasePageStore = new DatabasePageStore(database);
    const other: string = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

    store.write(new PageRecord(instance, "workspace-1", ""));
    store.write(new PageRecord(other, "workspace-2", "https://status.example.com/"));
    store.write(new PageRecord(instance, "workspace-1", "https://docs.example.com/pricing"));

    expect(new DatabasePageStore(database).read(instance)).toEqual({ instance, profileKey: "workspace-1", url: "https://docs.example.com/pricing" });
    expect(store.read(other)).toEqual({ instance: other, profileKey: "workspace-2", url: "https://status.example.com/" });
  });

  it("forgets a deleted instance and keeps the others, and deleting one it doesn't keep does nothing", () => {
    using database: SqliteModuleDatabase = new SqliteModuleDatabase(DatabasePageStore.migrations);
    const store: DatabasePageStore = new DatabasePageStore(database);
    const other: string = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
    store.write(new PageRecord(instance, "workspace-1", ""));
    store.write(new PageRecord(other, "workspace-1", ""));

    store.delete(instance);
    store.delete(instance);

    expect([store.read(instance), store.read(other)]).toEqual([null, { instance: other, profileKey: "workspace-1", url: "" }]);
  });

  it("records the agent whose call last acted on a kept page, keeps it through a later write of the record, and records none for a page it doesn't keep", () => {
    using database: SqliteModuleDatabase = new SqliteModuleDatabase(DatabasePageStore.migrations);
    const store: DatabasePageStore = new DatabasePageStore(database);
    const other: string = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
    store.write(new PageRecord(instance, "workspace-1", ""));
    const before: string | null = store.readAgent(instance);

    store.writeAgent(instance, "Scout");
    store.writeAgent(instance, "Helper");
    store.write(new PageRecord(instance, "workspace-1", "https://docs.example.com/pricing"));
    store.writeAgent(other, "Scout");

    expect([before, new DatabasePageStore(database).readAgent(instance), store.readAgent(other)]).toEqual([null, "Helper", null]);
  });

  it("keeps the agent of a call that acts before the page's record is written, and writes it with the record, but not after the page is deleted", () => {
    using database: SqliteModuleDatabase = new SqliteModuleDatabase(DatabasePageStore.migrations);
    const store: DatabasePageStore = new DatabasePageStore(database);
    const other: string = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

    store.writeAgent(instance, "Scout");
    store.writeAgent(instance, "Helper");
    const before: string | null = store.readAgent(instance);
    store.write(new PageRecord(instance, "workspace-1", ""));
    store.writeAgent(other, "Scout");
    store.delete(other);
    store.write(new PageRecord(other, "workspace-1", ""));

    expect([before, new DatabasePageStore(database).readAgent(instance), store.readAgent(other)]).toEqual([null, "Helper", null]);
  });

  it("adds the agent to the records an earlier version kept, with none recorded", () => {
    using database: SqliteModuleDatabase = new SqliteModuleDatabase(DatabasePageStore.migrations.slice(0, 1));
    database.run("INSERT INTO pages (instance, profile_key, url) VALUES (?, ?, ?)", instance, "workspace-1", "");
    for (const statement of DatabasePageStore.migrations.slice(1).flatMap(t => t.statements))
      database.run(statement);

    expect([new DatabasePageStore(database).readAgent(instance), new DatabasePageStore(database).read(instance)])
      .toEqual([null, { instance, profileKey: "workspace-1", url: "" }]);
  });

  it("throws when the database fails", () => {
    using database: SqliteModuleDatabase = new SqliteModuleDatabase();
    const store: DatabasePageStore = new DatabasePageStore(database);

    expect(() => store.read(instance)).toThrow(/no such table/u);
    expect(() => store.write(new PageRecord(instance, "workspace-1", ""))).toThrow(/no such table/u);
    expect(() => store.delete(instance)).toThrow(/no such table/u);
    expect(() => store.readAgent(instance)).toThrow(/no such table/u);
    expect(() => store.writeAgent(instance, "Scout")).toThrow(/no such table/u);
  });
});
