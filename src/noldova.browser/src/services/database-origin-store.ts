/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IModuleDatabase, Migration } from "@noldova/desktop.runtime";

import { Resources } from "../resources.ts";

export class DatabaseOriginStore {
  public static readonly migrations: readonly Migration[] = [
    { id: Resources.originsMigrationId, statements: [Resources.createOriginsTable] }
  ];
  public static readonly dropStarredMigration: Migration = { id: Resources.dropStarredOriginsMigrationId, statements: [Resources.dropStarredOrigins] };

  private readonly database: IModuleDatabase;

  public constructor(database: IModuleDatabase) {
    this.database = database;
  }

  public readAsync(profileKey: string): Promise<readonly string[]> {
    try {
      return Promise.resolve(this.database.readAll(Resources.readOriginsStatement, profileKey)
        .map(t => String(t[Resources.originColumn])));
    }
    catch (error: unknown) {
      return Promise.reject(error);
    }
  }

  public writeAsync(profileKey: string, origins: readonly string[]): Promise<void> {
    try {
      this.database.transaction(() => {
        this.database.run(Resources.deleteOriginsStatement, profileKey);
        origins.forEach((origin, position) =>
          this.database.run(Resources.insertOriginStatement, profileKey, origin, position));
      });
      return Promise.resolve();
    }
    catch (error: unknown) {
      return Promise.reject(error);
    }
  }
}
