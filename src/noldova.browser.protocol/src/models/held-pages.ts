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
import { PageAgent } from "./page-agent.ts";

export class HeldPages {
  private static readonly FIELDS: readonly string[] = [Resources.refusedField, Resources.agentsField];

  public readonly refused: readonly string[];
  public readonly agents: readonly PageAgent[];

  public constructor(refused: readonly string[], agents: readonly PageAgent[]) {
    this.refused = refused;
    this.agents = agents;
  }

  public static fromJson(value: unknown, path?: string): HeldPages {
    const reader: JsonReader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, HeldPages.FIELDS);
    const refused: readonly string[] = reader.readStringArray(Resources.refusedField);
    return new HeldPages(refused, reader.readObjectArray(Resources.agentsField).map(t => PageAgent.fromJson(t.toJson(), t.path)));
  }

  public toJson(): JsonObject {
    return { [Resources.refusedField]: this.refused, [Resources.agentsField]: this.agents.map(t => t.toJson()) };
  }
}
