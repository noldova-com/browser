/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/context.json";

import { TypedAddressAnswerKind } from "../enums/typed-address-answer-kind.ts";
import { TypedAddressAllowed } from "../models/typed-address-allowed.ts";
import { TypedAddressRefused } from "../models/typed-address-refused.ts";
import { Resources } from "../resources.ts";
import type { TypedAddressAnswer } from "../types/typed-address-answer.ts";

export class TypedAddressAnswerReader {
  private static readonly KINDS: readonly TypedAddressAnswerKind[] = Object.values(TypedAddressAnswerKind);

  public static read(value: unknown, path?: string): TypedAddressAnswer {
    const kind: TypedAddressAnswerKind = JsonReader.fromValue(value, path).readOneOf(Resources.kindField, TypedAddressAnswerReader.KINDS);
    return kind === TypedAddressAnswerKind.Allowed ? TypedAddressAllowed.fromJson(value, path) : TypedAddressRefused.fromJson(value, path);
  }
}
