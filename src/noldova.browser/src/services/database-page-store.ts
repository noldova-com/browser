/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PageRecord } from "@noldova/browser.protocol";
import type { IModuleDatabase, Migration } from "@noldova/desktop.runtime";

import { Resources } from "../resources.ts";

export class DatabasePageStore {
  public static readonly migrations: readonly Migration[] = [
    { id: Resources.pagesMigrationId, statements: [Resources.createPagesTable] },
    { id: Resources.pageAgentMigrationId, statements: [Resources.addPageAgentColumn] }
  ];

  private readonly database: IModuleDatabase;
  private readonly pendingAgents: Map<string, string> = new Map<string, string>();

  public constructor(database: IModuleDatabase) {
    this.database = database;
  }

  public read(instance: string): PageRecord | null {
    const row: Record<string, unknown> | undefined = this.database.read(Resources.readPageStatement, instance);
    return row === undefined ? null : new PageRecord(instance, String(row[Resources.profileKeyColumn]), String(row[Resources.urlColumn]));
  }

  public write(record: PageRecord): void {
    this.database.run(Resources.writePageStatement, record.instance, record.profileKey, record.url, this.pendingAgents.get(record.instance) ?? null);
    this.pendingAgents.delete(record.instance);
  }

  public readAgent(instance: string): string | null {
    const agentName: unknown = this.database.read(Resources.readPageAgentStatement, instance)?.[Resources.agentNameColumn];
    return typeof agentName === "string" ? agentName : null;
  }

  public writeAgent(instance: string, agentName: string): void {
    if (Number(this.database.run(Resources.writePageAgentStatement, agentName, instance).changes) > 0)
      this.pendingAgents.delete(instance);
    else
      this.pendingAgents.set(instance, agentName);
  }

  public delete(instance: string): void {
    this.database.run(Resources.deletePageStatement, instance);
    this.pendingAgents.delete(instance);
  }
}
