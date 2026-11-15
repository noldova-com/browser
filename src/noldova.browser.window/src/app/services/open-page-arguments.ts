/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";

import { Resources } from "../../resources.ts";
import { OpenPageArgumentsInvalidException } from "../exceptions/open-page-arguments-invalid.exception.ts";
import { PageOpening } from "../models/page-opening.ts";
import { PageAnswers } from "./page-answers.ts";

export class OpenPageArguments {
  public static isValid(commandArguments: JsonValue): boolean {
    return OpenPageArguments.tryRead(commandArguments) !== null;
  }

  public static read(commandArguments: JsonValue): PageOpening {
    const opening: PageOpening | null = OpenPageArguments.tryRead(commandArguments);
    if (opening === null)
      throw new OpenPageArgumentsInvalidException();
    return opening;
  }

  private static tryRead(commandArguments: JsonValue): PageOpening | null {
    if (!PageAnswers.isObject(commandArguments))
      return null;
    const { profileKey, url, instance } = commandArguments;
    if (typeof profileKey !== "string" || !Resources.profileKeyPattern.test(profileKey))
      return null;
    if (instance !== undefined && (typeof instance !== "string" || !Resources.instancePattern.test(instance)))
      return null;
    if (url !== undefined && typeof url !== "string")
      return null;
    return new PageOpening(profileKey, url === undefined || url.trim() === "" ? null : url, instance ?? null);
  }
}
