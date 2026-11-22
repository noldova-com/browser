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
    return !Object.isNull(OpenPageArguments.tryRead(commandArguments));
  }

  public static read(commandArguments: JsonValue): PageOpening {
    const opening: PageOpening | null = OpenPageArguments.tryRead(commandArguments);
    if (Object.isNull(opening))
      throw new OpenPageArgumentsInvalidException();
    return opening;
  }

  private static tryRead(commandArguments: JsonValue): PageOpening | null {
    if (!PageAnswers.isObject(commandArguments))
      return null;
    const { profileKey, url, instance } = commandArguments;
    if (Object.isUndefined(profileKey))
      return Object.isUndefined(instance) ? OpenPageArguments.tryReadUrl(Resources.linkProfile, url, null) : null;
    if (!Object.isString(profileKey) || !Resources.profileKeyPattern.test(profileKey) || profileKey === Resources.linkProfile)
      return null;
    if (!Object.isUndefined(instance) && (!Object.isString(instance) || !Resources.instancePattern.test(instance)))
      return null;
    return OpenPageArguments.tryReadUrl(profileKey, url, instance ?? null);
  }

  private static tryReadUrl(profileKey: string, url: JsonValue | undefined, instance: string | null): PageOpening | null {
    if (!Object.isUndefined(url) && !Object.isString(url))
      return null;
    return new PageOpening(profileKey, Object.isUndefined(url) || url.trim() === "" ? null : url, instance);
  }
}
