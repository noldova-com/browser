/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewFailure, WebViewFailureKind } from "@noldova/desktop.protocol";
import { type IToolDescriptor, type Registration, ToolAbortReason, type ToolCall, ToolContent, type ToolFailure, type ToolResult, type ToolSession,
  WebViewFailureException } from "@noldova/desktop.runtime";
import { FakeModuleLog, FakeModuleSettings, FakeToolsContext } from "@noldova/desktop.runtime/testing";
import { describe, expect, it } from "vitest";

import { PageAnswerTimedOutException } from "../../src/exceptions/page-answer-timed-out.exception.ts";
import { PageChangedAfterGrantException } from "../../src/exceptions/page-changed-after-grant.exception.ts";
import { ShortcutRefusedException } from "../../src/exceptions/shortcut-refused.exception.ts";
import { StaleReferenceException } from "../../src/exceptions/stale-reference.exception.ts";
import type { IBrowserTool } from "../../src/interfaces/i-browser-tool.ts";
import type { ActionProgress } from "../../src/models/action-progress.ts";
import { SessionStates } from "../../src/models/session-states.ts";
import { ShownPage } from "../../src/models/shown-page.ts";
import { ToolDescriptors } from "../../src/models/tool-descriptors.ts";
import { PageOrigin } from "../../src/services/page-origin.ts";
import { ToolFailures } from "../../src/services/tool-failures.ts";
import { ToolHost } from "../../src/services/tool-host.ts";
import { ToolResults } from "../../src/services/tool-results.ts";
import { answerThroughRegistry } from "../fixtures/desktop-fakes.fixture.ts";

// A tool with the descriptor of a real one, whose call runs the test's own work.
class ScriptedTool implements IBrowserTool {
  public readonly descriptor: IToolDescriptor;
  private readonly work: (call: ToolCall, progress: ActionProgress) => Promise<ToolResult>;

  public constructor(descriptor: IToolDescriptor, work: (call: ToolCall, progress: ActionProgress) => Promise<ToolResult>) {
    this.descriptor = descriptor;
    this.work = work;
  }

  public callAsync(call: ToolCall, progress: ActionProgress): Promise<ToolResult> {
    return this.work(call, progress);
  }
}

// Whether a failing action sent its input, and the code its call ends with.
class SentCase {
  public readonly isSent: boolean;
  public readonly code: string;

  public constructor(isSent: boolean, code: string) {
    this.isSent = isSent;
    this.code = code;
  }
}

// Whether the one input an action sent before its element was lost was the focus, and the code its call ends with.
class FocusCase {
  public readonly isFocus: boolean;
  public readonly code: string;

  public constructor(isFocus: boolean, code: string) {
    this.isFocus = isFocus;
    this.code = code;
  }
}

function tool(name: "click" | "snapshot", work: (call: ToolCall, progress: ActionProgress) => Promise<ToolResult>): IBrowserTool {
  return new ScriptedTool(ToolDescriptors[name], work);
}

class HostBench {
  public readonly tools: FakeToolsContext;
  public readonly sessions: SessionStates = new SessionStates();
  public readonly settings: FakeModuleSettings = new FakeModuleSettings();
  public readonly host: ToolHost;
  public readonly session: ToolSession;

  public constructor(isOn: () => boolean = () => true) {
    const log: FakeModuleLog = new FakeModuleLog();
    this.tools = new FakeToolsContext(log);
    answerThroughRegistry(this.tools, log);
    this.settings.answer("read", () => isOn());
    this.host = new ToolHost(this.tools, this.sessions, this.settings);
    this.session = this.tools.openSession("conversation-1", {});
  }
}

const PAGE: ShownPage = new ShownPage("https://shop.test/", "Shop");

describe("ToolHost", () => {
  it("registers a tool and passes its result through", async () => {
    const { session, host: toolHost } = new HostBench();
    toolHost.register(tool("snapshot", async () => ToolResults.text("tree", PAGE)));

    expect(session.listTools().map(t => t.name)).toEqual(["browser_snapshot"]);
    expect(session.listTools().map(t => t.risk)).toEqual([ToolDescriptors.snapshot.risk]);
    expect(await session.callAsync("browser_snapshot", {})).toEqual(ToolResults.text("tree", PAGE));
  });

  it("passes the content of a blank tab and a data URL through Noldova Desktop's checks under the module's opaque origin, which the engine's own value fails", async () => {
    const { session, host: toolHost } = new HostBench();
    let origin: string = "";
    toolHost.register(tool("snapshot", async () => ToolResults.page(origin, [ToolContent.fromText("- document", origin)], new ShownPage("about:blank", ""))));

    const outcomes: (ToolResult | ToolFailure)[] = [];
    for (const next of [PageOrigin.of("://"), PageOrigin.of("null"), "://"]) {
      origin = next;
      outcomes.push(await session.callAsync("browser_snapshot", {}));
    }

    expect(outcomes.map(t => t.isFailure)).toEqual([false, false, true]);
    expect(outcomes[2]).toMatchObject({ code: "Unavailable", moduleCode: "browser.malformedResult" });
  });

  it("refuses each call as unavailable while Let agents use the browser is off, before the tool runs, and runs calls again once it's on", async () => {
    let isOn: boolean = false;
    const { session, settings, host: toolHost } = new HostBench(() => isOn);
    const ran: string[] = [];
    toolHost.register(tool("click", async () => {
      ran.push("click");
      return ToolResults.text("clicked", PAGE);
    }));

    const refused: ToolResult | ToolFailure = await session.callAsync("browser_click", { reference: "e1" });
    isOn = true;
    const allowed: ToolResult | ToolFailure = await session.callAsync("browser_click", { reference: "e1" });

    expect(refused).toMatchObject({ isFailure: true, code: "Unavailable", moduleCode: "browser.toolsOff", message: "The person turned the browser's tools off for agents in Settings." });
    expect([allowed, ran, settings.callsOf("read")]).toEqual([ToolResults.text("clicked", PAGE), ["click"], [["browser.agentTools"], ["browser.agentTools"]]]);
  });

  it("withdraws a tool", () => {
    const { session, host: toolHost } = new HostBench();
    const registration: Registration = toolHost.register(tool("snapshot", async () => ToolResults.text("tree", PAGE)));

    registration[Symbol.dispose]();

    expect(session.listTools()).toEqual([]);
  });

  it("turns a thrown failure into Noldova Desktop's failure", async () => {
    const { session, host: toolHost } = new HostBench();
    toolHost.register(tool("snapshot", async () => {
      throw new PageChangedAfterGrantException();
    }));

    const stale: ToolFailure = new PageChangedAfterGrantException().toFailure();
    expect(await session.callAsync("browser_snapshot", {})).toMatchObject({ isFailure: true, code: stale.code, message: stale.message });
  });

  it("turns a bug into an internal failure, never a crash", async () => {
    const { session, host: toolHost } = new HostBench();
    toolHost.register(tool("snapshot", async () => {
      throw new TypeError("bug");
    }));

    expect(await session.callAsync("browser_snapshot", {})).toMatchObject({ isFailure: true, code: "Unavailable", moduleCode: "browser.internal" });
  });

  it.each<SentCase>([new SentCase(false, "TimedOut"), new SentCase(true, "OutcomeUncertain")])(
    "reports an action stopped with its input sent $isSent as $code, uncertain only once it may have sent it", async (row: SentCase) => {
      const { session, host: toolHost } = new HostBench();
      toolHost.register(tool("click", async (_call: ToolCall, progress: ActionProgress) => {
        progress.markGranted();
        if (row.isSent)
          progress.markInputSent();
        throw new PageAnswerTimedOutException();
      }));

      expect(await session.callAsync("browser_click", { reference: "e1" })).toMatchObject({ isFailure: true, code: row.code });
    });

  it("reports a reference lost after the grant as stale", async () => {
    const { session, host: toolHost } = new HostBench();
    toolHost.register(tool("click", async (_call: ToolCall, progress: ActionProgress) => {
      progress.markGranted();
      throw new StaleReferenceException();
    }));

    expect(await session.callAsync("browser_click", { reference: "e1" })).toMatchObject({ isFailure: true, code: "Stale" });
  });

  it.each<FocusCase>([new FocusCase(true, "Stale"), new FocusCase(false, "OutcomeUncertain")])(
    "reports an element gone right after input that was only the focus $isFocus as $code, stale after the focus and uncertain after other input", async (row: FocusCase) => {
      const { session, host: toolHost } = new HostBench();
      toolHost.register(tool("click", async (_call: ToolCall, progress: ActionProgress) => {
        progress.markGranted();
        progress.markInputSent(row.isFocus);
        throw new StaleReferenceException();
      }));

      expect(await session.callAsync("browser_click", { reference: "e1" })).toMatchObject({ isFailure: true, code: row.code });
    });

  it("reports a key Noldova Desktop refused as one of the app's shortcuts as refused, not uncertain, since the page never got it", async () => {
    const { session, host: toolHost } = new HostBench();
    toolHost.register(tool("click", async (_call: ToolCall, progress: ActionProgress) => {
      progress.markGranted();
      progress.markInputSent();
      throw new ShortcutRefusedException(new WebViewFailureException(new WebViewFailure(WebViewFailureKind.ShortcutRefused)));
    }));

    expect(await session.callAsync("browser_click", { reference: "e1" })).toMatchObject({ isFailure: true, code: "Refused", moduleCode: "browser.shortcutRefused" });
  });

  it("never reports an uncertain outcome for a reading tool", async () => {
    const { session, host: toolHost } = new HostBench();
    toolHost.register(tool("snapshot", async (_call: ToolCall, progress: ActionProgress) => {
      progress.markInputSent();
      throw ToolFailures.interrupted(ToolAbortReason.Stopped);
    }));

    expect(await session.callAsync("browser_snapshot", {})).toMatchObject({ isFailure: true, code: "Stopped", message: "The call was stopped." });
  });

  it("reports an action's point of no return to Noldova Desktop once, just before its first input, and a reading tool's never", async () => {
    const { session, host: toolHost } = new HostBench();
    const marks: boolean[] = [];
    toolHost.register(tool("click", async (call: ToolCall, progress: ActionProgress) => {
      marks.push(call.hasMarkedSending);
      progress.markInputSent();
      progress.markInputSent();
      marks.push(call.hasMarkedSending);
      return ToolResults.text("clicked", PAGE);
    }));
    toolHost.register(tool("snapshot", async (call: ToolCall, progress: ActionProgress) => {
      progress.markInputSent();
      marks.push(call.hasMarkedSending);
      return ToolResults.text("read", PAGE);
    }));

    await session.callAsync("browser_click", { reference: "e1" });
    await session.callAsync("browser_snapshot", {});
    expect(marks).toEqual([false, true, false]);
  });

  it("gives each call its own progress", async () => {
    const { session, host: toolHost } = new HostBench();
    const seen: ActionProgress[] = [];
    toolHost.register(tool("click", async (_call: ToolCall, progress: ActionProgress) => {
      seen.push(progress);
      return ToolResults.text("Done.", PAGE);
    }));

    await session.callAsync("browser_click", { reference: "e1" });
    await session.callAsync("browser_click", { reference: "e1" });

    expect(seen[0]).not.toBe(seen[1]);
  });

  it("forgets an ended session's state, until stopped", async () => {
    const { tools, sessions, host: toolHost } = new HostBench();
    const listening: Registration = toolHost.start();
    const firstEnded: PromiseWithResolvers<string> = Promise.withResolvers<string>();
    const watchingFirst: Registration = tools.onSessionEnded(t => firstEnded.resolve(t));
    const first: ToolSession = tools.openSession("conversation-2", {});
    sessions.writeCursor(first.id, "view", 5);

    first.end();
    expect(await firstEnded.promise).toBe(first.id);
    expect(sessions.readCursor(first.id, "view")).toBe(0);
    watchingFirst[Symbol.dispose]();

    const secondEnded: PromiseWithResolvers<string> = Promise.withResolvers<string>();
    tools.onSessionEnded(t => secondEnded.resolve(t));
    const second: ToolSession = tools.openSession("conversation-3", {});
    sessions.writeCursor(second.id, "view", 5);
    listening[Symbol.dispose]();
    second.end();
    expect(await secondEnded.promise).toBe(second.id);
    expect(sessions.readCursor(second.id, "view")).toBe(5);
  });
});
