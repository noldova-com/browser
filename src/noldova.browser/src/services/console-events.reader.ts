/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ConsoleLevel } from "../enums/console-level.ts";
import { ConsoleEntryEvent } from "../models/console-entry-event.ts";
import type { ConsoleEvent } from "../models/console-event.ts";
import { ConsoleNavigationEvent } from "../models/console-navigation-event.ts";
import { Resources } from "../resources.ts";
import type { JsonObject, JsonValue } from "../types/json-value.ts";
import { JsonShapes } from "./json-shapes.ts";
import { PageOrigin } from "./page-origin.ts";

export class ConsoleEventsReader {
  public static read(method: string, params: JsonObject): ConsoleEvent | null {
    switch (method) {
      case Resources.consoleAPICalledEvent:
        return ConsoleEventsReader.readConsole(params);
      case Resources.exceptionThrownEvent:
        return ConsoleEventsReader.readException(params);
      case Resources.entryAddedEvent:
        return ConsoleEventsReader.readLog(params[Resources.entryField]);
      case Resources.frameNavigatedEvent:
        return ConsoleEventsReader.readNavigation(params[Resources.frameField]);
      default:
        return null;
    }
  }

  private static readConsole(params: JsonObject): ConsoleEvent | null {
    const { type, args, timestamp, stackTrace } = params;
    if (typeof type !== "string" || !JsonShapes.isArray(args) || typeof timestamp !== "number")
      return null;
    const frames: JsonValue | undefined = JsonShapes.isObject(stackTrace) ? stackTrace[Resources.callFramesField] : undefined;
    const top: JsonValue | undefined = JsonShapes.isArray(frames) ? frames[0] : undefined;
    const where: string | null = JsonShapes.isObject(top) ? ConsoleEventsReader.readPlace(top[Resources.urlField], top[Resources.lineNumberField]) : null;
    return new ConsoleEntryEvent(
      Resources.consoleLevelsByType.get(type) ?? ConsoleLevel.Info,
      where === null ? Resources.consoleSource : Resources.formatConsoleSource(where),
      args.map(t => ConsoleEventsReader.readValue(t)).join(Resources.consoleArgumentSeparator),
      timestamp
    );
  }

  private static readException(params: JsonObject): ConsoleEvent | null {
    const { timestamp, exceptionDetails: details } = params;
    if (typeof timestamp !== "number" || !JsonShapes.isObject(details))
      return null;
    const text: JsonValue | undefined = details[Resources.textField];
    if (typeof text !== "string")
      return null;
    const exception: JsonValue | undefined = details[Resources.exceptionField];
    const description: JsonValue | undefined = JsonShapes.isObject(exception) ? exception[Resources.descriptionField] : undefined;
    const where: string | null = ConsoleEventsReader.readPlace(details[Resources.urlField], details[Resources.lineNumberField]);
    return new ConsoleEntryEvent(
      ConsoleLevel.Error,
      where === null ? Resources.exceptionSource : Resources.formatExceptionSource(where),
      typeof description === "string" ? description : text,
      timestamp
    );
  }

  private static readLog(entry: JsonValue | undefined): ConsoleEvent | null {
    if (!JsonShapes.isObject(entry))
      return null;
    const { source, level, text, timestamp } = entry;
    if (typeof source !== "string" || typeof level !== "string" || typeof text !== "string" || typeof timestamp !== "number")
      return null;
    const where: string | null = ConsoleEventsReader.readPlace(entry[Resources.urlField], entry[Resources.lineNumberField]);
    return new ConsoleEntryEvent(Resources.consoleLevelsByType.get(level) ?? ConsoleLevel.Info, where === null ? source : Resources.formatLogSource(source, where), text,
      timestamp);
  }

  private static readNavigation(frame: JsonValue | undefined): ConsoleEvent | null {
    if (!JsonShapes.isObject(frame) || frame[Resources.parentIdField] !== undefined)
      return null;
    const { url, securityOrigin: origin } = frame;
    return typeof url === "string" && typeof origin === "string" ? new ConsoleNavigationEvent(url, PageOrigin.of(origin)) : null;
  }

  private static readPlace(url: JsonValue | undefined, line: JsonValue | undefined): string | null {
    if (typeof url !== "string" || url === "")
      return null;
    return typeof line === "number" ? Resources.formatPlace(url, line + 1) : url;
  }

  private static readValue(argument: JsonValue): string {
    if (!JsonShapes.isObject(argument))
      return "";
    const { value, unserializableValue, description, type } = argument;
    if (typeof value === "string")
      return value;
    if (value !== undefined)
      return JSON.stringify(value);
    for (const shown of [unserializableValue, description, type])
      if (typeof shown === "string")
        return shown;
    return "";
  }
}
