/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { ConsoleEntryEvent } from "../../src/models/console-entry-event.ts";
import type { ConsoleEvent } from "../../src/models/console-event.ts";
import { ConsoleNavigationEvent } from "../../src/models/console-navigation-event.ts";
import { ConsoleEventsReader } from "../../src/services/console-events.reader.ts";

const AT: number = Date.UTC(2026, 10, 7, 12, 0, 0);

describe("ConsoleEventsReader", () => {
  it("reads a console call's level, its arguments as text and where the page made it, counting lines from one", () => {
    expect(ConsoleEventsReader.read("Runtime.consoleAPICalled", {
      type: "warning",
      args: [{ type: "string", value: "Low stock:" }, { type: "number", value: 3 }, { type: "object", value: { left: 3 } }],
      timestamp: AT,
      stackTrace: { callFrames: [{ url: "https://shop.test/app.js", lineNumber: 41 }] }
    })).toStrictEqual(new ConsoleEntryEvent("Warning", "console at https://shop.test/app.js:42", "Low stock: 3 {\"left\":3}", AT));
  });

  it("shows an argument without a value by its printable value, its description or its type, and nothing for one that isn't an object", () => {
    const read: ConsoleEvent | null = ConsoleEventsReader.read("Runtime.consoleAPICalled", { type: "log", timestamp: AT, args: [
      { type: "number", unserializableValue: "NaN" }, { type: "object", description: "Window" }, { type: "undefined" }, { subtype: "null" }, "loose"
    ] });

    expect(read).toStrictEqual(new ConsoleEntryEvent("Info", "console", "NaN Window undefined  ", AT));
  });

  it.each([["debug", "Debug"], ["trace", "Debug"], ["error", "Error"], ["assert", "Error"], ["table", "Info"]])("reads console.%s at the level %s", (type: string, level: string) => {
    expect(ConsoleEventsReader.read("Runtime.consoleAPICalled", { type, args: [], timestamp: AT })).toMatchObject({ level });
  });

  it("leaves out where a call came from when its stack has no frame with an address", () => {
    for (const stackTrace of [{ callFrames: [] }, { callFrames: [{ url: "" }] }, { callFrames: "none" }, "none"])
      expect(ConsoleEventsReader.read("Runtime.consoleAPICalled", { type: "log", args: [], timestamp: AT, stackTrace })).toMatchObject({ source: "console" });
    expect(ConsoleEventsReader.read("Runtime.consoleAPICalled", { type: "log", args: [], timestamp: AT, stackTrace: { callFrames: [{ url: "https://shop.test/a.js" }] } }))
      .toMatchObject({ source: "console at https://shop.test/a.js" });
  });

  it("reads a page error as an error, by its exception's description or else its text", () => {
    expect(ConsoleEventsReader.read("Runtime.exceptionThrown", { timestamp: AT, exceptionDetails: {
      text: "Uncaught", url: "https://shop.test/app.js", lineNumber: 0, exception: { description: "TypeError: cart is undefined" }
    } })).toStrictEqual(new ConsoleEntryEvent("Error", "exception at https://shop.test/app.js:1", "TypeError: cart is undefined", AT));
    expect(ConsoleEventsReader.read("Runtime.exceptionThrown", { timestamp: AT, exceptionDetails: { text: "Uncaught", exception: { type: "object" } } }))
      .toStrictEqual(new ConsoleEntryEvent("Error", "exception", "Uncaught", AT));
    expect(ConsoleEventsReader.read("Runtime.exceptionThrown", { timestamp: AT, exceptionDetails: { text: "Script error." } })).toMatchObject({ text: "Script error." });
  });

  it("reads a log entry's source, level and text", () => {
    expect(ConsoleEventsReader.read("Log.entryAdded", { entry: { source: "network", level: "error", text: "Failed to load", timestamp: AT, url: "https://shop.test/a.png" } }))
      .toStrictEqual(new ConsoleEntryEvent("Error", "network at https://shop.test/a.png", "Failed to load", AT));
    expect(ConsoleEventsReader.read("Log.entryAdded", { entry: { source: "violation", level: "verbose", text: "Slow", timestamp: AT } }))
      .toStrictEqual(new ConsoleEntryEvent("Debug", "violation", "Slow", AT));
    expect(ConsoleEventsReader.read("Log.entryAdded", { entry: { source: "other", level: "info", text: "Hi", timestamp: AT } })).toMatchObject({ level: "Info" });
  });

  it("reads a navigation of the top frame, and none of a frame inside it", () => {
    expect(ConsoleEventsReader.read("Page.frameNavigated", { frame: { id: "F1", url: "https://shop.test/cart", securityOrigin: "https://shop.test" } }))
      .toStrictEqual(new ConsoleNavigationEvent("https://shop.test/cart", "https://shop.test"));
    expect(ConsoleEventsReader.read("Page.frameNavigated", { frame: { id: "F2", parentId: "F1", url: "https://ads.test/", securityOrigin: "https://ads.test" } })).toBeNull();
  });

  it("reads a navigation to a page with an opaque origin as the module's opaque origin", () => {
    expect([
      ConsoleEventsReader.read("Page.frameNavigated", { frame: { id: "F1", url: "about:blank", securityOrigin: "://" } }),
      ConsoleEventsReader.read("Page.frameNavigated", { frame: { id: "F1", url: "data:text/html,<p>Hi</p>", securityOrigin: "null" } })
    ]).toStrictEqual([
      new ConsoleNavigationEvent("about:blank", "browser:opaque"),
      new ConsoleNavigationEvent("data:text/html,<p>Hi</p>", "browser:opaque")
    ]);
  });

  it("reads nothing from another event, or one without the fields the engine always sends", () => {
    expect([
      ConsoleEventsReader.read("Page.loadEventFired", {}),
      ConsoleEventsReader.read("Runtime.consoleAPICalled", { type: "log", args: "x", timestamp: AT }),
      ConsoleEventsReader.read("Runtime.consoleAPICalled", { type: 1, args: [], timestamp: AT }),
      ConsoleEventsReader.read("Runtime.consoleAPICalled", { type: "log", args: [] }),
      ConsoleEventsReader.read("Runtime.exceptionThrown", { exceptionDetails: { text: "x" } }),
      ConsoleEventsReader.read("Runtime.exceptionThrown", { timestamp: AT, exceptionDetails: "x" }),
      ConsoleEventsReader.read("Runtime.exceptionThrown", { timestamp: AT, exceptionDetails: {} }),
      ConsoleEventsReader.read("Log.entryAdded", { entry: "x" }),
      ConsoleEventsReader.read("Log.entryAdded", {}),
      ConsoleEventsReader.read("Log.entryAdded", { entry: { source: 1, level: "info", text: "x", timestamp: AT } }),
      ConsoleEventsReader.read("Log.entryAdded", { entry: { source: "x", level: 1, text: "x", timestamp: AT } }),
      ConsoleEventsReader.read("Log.entryAdded", { entry: { source: "x", level: "info", text: 1, timestamp: AT } }),
      ConsoleEventsReader.read("Log.entryAdded", { entry: { source: "x", level: "info", text: "x" } }),
      ConsoleEventsReader.read("Page.frameNavigated", {}),
      ConsoleEventsReader.read("Page.frameNavigated", { frame: { url: "https://shop.test/" } }),
      ConsoleEventsReader.read("Page.frameNavigated", { frame: { securityOrigin: "https://shop.test" } })
    ]).toEqual(Array.from({ length: 16 }, () => null));
  });
});
