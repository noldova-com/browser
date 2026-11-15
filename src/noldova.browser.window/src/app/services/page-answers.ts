/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { HeldPages, PageActivity, PageClaim, PageRecord, type TypedAddressAnswer, TypedAddressAnswerReader } from "@noldova/browser.protocol";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { JsonException, type JsonObject, type JsonValue } from "@noldova/context.json";

import { Resources } from "../../resources.ts";
import { AppNameAnswerMalformedException } from "../exceptions/app-name-answer-malformed.exception.ts";
import { HeldPagesAnswerMalformedException } from "../exceptions/held-pages-answer-malformed.exception.ts";
import { PageActivitiesAnswerMalformedException } from "../exceptions/page-activities-answer-malformed.exception.ts";
import { PageActivityEventMalformedException } from "../exceptions/page-activity-event-malformed.exception.ts";
import { PageClaimAnswerMalformedException } from "../exceptions/page-claim-answer-malformed.exception.ts";
import { PageRecordAnswerMalformedException } from "../exceptions/page-record-answer-malformed.exception.ts";
import type { RuntimeAnswerMalformedException } from "../exceptions/runtime-answer-malformed.exception.ts";
import { TypedAddressAnswerMalformedException } from "../exceptions/typed-address-answer-malformed.exception.ts";

export class PageAnswers {
  public static readTypedAddress(answer: JsonValue): TypedAddressAnswer {
    return PageAnswers.read(() => TypedAddressAnswerReader.read(answer), (path, options) => new TypedAddressAnswerMalformedException(path, options));
  }

  public static readRecord(answer: JsonValue): PageRecord | null {
    return answer === null ? null : PageAnswers.read(() => PageRecord.fromJson(answer), (path, options) => new PageRecordAnswerMalformedException(path, options));
  }

  public static readClaim(answer: JsonValue): PageClaim {
    return PageAnswers.read(() => PageClaim.fromJson(answer), (path, options) => new PageClaimAnswerMalformedException(path, options));
  }

  public static readHeldPages(answer: JsonValue): HeldPages {
    return PageAnswers.read(() => HeldPages.fromJson(answer), (path, options) => new HeldPagesAnswerMalformedException(path, options));
  }

  public static readActivity(payload: JsonValue): PageActivity {
    return PageAnswers.read(() => PageActivity.fromJson(payload), (path, options) => new PageActivityEventMalformedException(path, options));
  }

  public static readActivities(answer: JsonValue): readonly PageActivity[] {
    if (!Array.isArray(answer))
      throw new PageActivitiesAnswerMalformedException(Resources.answerRootPath);
    return answer.map((t, index) => PageAnswers.read(() => PageActivity.fromJson(t, Resources.formatAnswerItemPath(index)),
      (path, options) => new PageActivitiesAnswerMalformedException(path, options)));
  }

  public static readAppName(answer: JsonValue): string {
    if (typeof answer !== "string" || answer.trim() === "")
      throw new AppNameAnswerMalformedException(Resources.answerRootPath);
    return answer;
  }

  public static isObject(value: JsonValue): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private static read<T>(parse: () => T, malformed: (path: string, options: ExceptionOptions) => RuntimeAnswerMalformedException): T {
    try {
      return parse();
    }
    catch (error) {
      if (!(error instanceof JsonException))
        throw error;
      throw malformed(error.path, new ExceptionOptions(error));
    }
  }
}
