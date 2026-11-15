/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { WireContract } from "../services/wire-contract.ts";
import { PageRecord } from "./page-record.ts";

export class PageClaim {
  private static readonly FIELDS: readonly string[] = [Resources.isClaimedField, Resources.isHereField, Resources.recordField, Resources.agentNameField];

  public readonly isClaimed: boolean;
  public readonly isHere: boolean;
  public readonly record: PageRecord | null;
  public readonly agentName: string | null;

  public constructor(isClaimed: boolean, isHere: boolean, record: PageRecord | null, agentName: string | null) {
    this.isClaimed = isClaimed;
    this.isHere = isHere;
    this.record = record;
    this.agentName = agentName;
  }

  public static fromJson(value: unknown, path?: string): PageClaim {
    const reader: JsonReader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, PageClaim.FIELDS);
    const isClaimed: boolean = reader.readBoolean(Resources.isClaimedField);
    const isHere: boolean = reader.readBoolean(Resources.isHereField);
    const record: JsonReader | null = reader.readNullableObject(Resources.recordField);
    return new PageClaim(isClaimed, isHere, record === null ? null : PageRecord.fromJson(record.toJson(), record.path), reader.readNullableString(Resources.agentNameField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.isClaimedField]: this.isClaimed,
      [Resources.isHereField]: this.isHere,
      [Resources.recordField]: this.record === null ? null : this.record.toJson(),
      [Resources.agentNameField]: this.agentName
    };
  }
}
