/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IToolDeadline, type IToolHints } from "@noldova/desktop.runtime";

import { Resources } from "../resources.ts";
import type { JsonObject } from "../types/json-value.ts";
import { BrowserLimits } from "./browser-limits.ts";

export class ToolSchemas {
  public static readonly acting: IToolHints = { isReadOnly: false, isDestructive: true, isOpenWorld: true };
  public static readonly reading: IToolHints = { isReadOnly: true, isDestructive: false, isOpenWorld: true };
  public static readonly reference: JsonObject = { type: Resources.stringSchemaType, minLength: 1 };
  public static readonly output: JsonObject = ToolSchemas.objectSchema({
    page: ToolSchemas.objectSchema({
      url: { type: Resources.stringSchemaType, maxLength: BrowserLimits.maximumShownUrlLength },
      title: { type: Resources.stringSchemaType, maxLength: BrowserLimits.maximumShownTextLength }
    }, [Resources.urlField, Resources.titleField]),
    element: ToolSchemas.objectSchema({
      role: { type: Resources.stringSchemaType, maxLength: BrowserLimits.maximumShownTextLength },
      name: { type: Resources.stringSchemaType, maxLength: BrowserLimits.maximumShownTextLength },
      isSecret: { type: Resources.booleanSchemaType }
    }, [Resources.roleField, Resources.nameField, Resources.isSecretField])
  }, [Resources.pageField]);
  public static readonly stepDeadline: IToolDeadline = { default: Resources.stepDeadlineMilliseconds, maximum: Resources.maximumDeadlineMilliseconds };
  public static readonly waitDeadline: IToolDeadline = {
    default: BrowserLimits.maximumWaitMilliseconds + Resources.waitAnswerMarginMilliseconds,
    maximum: Resources.maximumDeadlineMilliseconds
  };

  public static objectSchema(properties: JsonObject, required: readonly string[]): JsonObject {
    return { type: Resources.objectSchemaType, properties, required: [...required], additionalProperties: false };
  }
}
