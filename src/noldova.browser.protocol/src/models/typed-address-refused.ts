/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/context.json";

import { TypedAddressAnswerKind } from "../enums/typed-address-answer-kind.ts";
import { TypedAddressRefusal } from "../enums/typed-address-refusal.ts";
import { Resources } from "../resources.ts";
import { WireContract } from "../services/wire-contract.ts";

export class TypedAddressRefused {
  private static readonly FIELDS: readonly string[] = [Resources.kindField, Resources.reasonField];
  private static readonly KINDS: readonly (typeof TypedAddressAnswerKind.Refused)[] = [TypedAddressAnswerKind.Refused];
  private static readonly REASONS: readonly TypedAddressRefusal[] = Object.values(TypedAddressRefusal);

  public readonly kind: typeof TypedAddressAnswerKind.Refused;
  public readonly reason: TypedAddressRefusal;

  public constructor(reason: TypedAddressRefusal) {
    this.kind = TypedAddressAnswerKind.Refused;
    this.reason = reason;
  }

  public static fromJson(value: unknown, path?: string): TypedAddressRefused {
    const reader: JsonReader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, TypedAddressRefused.FIELDS);
    reader.readOneOf(Resources.kindField, TypedAddressRefused.KINDS);
    return new TypedAddressRefused(reader.readOneOf(Resources.reasonField, TypedAddressRefused.REASONS));
  }

  public toJson(): JsonObject {
    return { [Resources.kindField]: this.kind, [Resources.reasonField]: this.reason };
  }
}
