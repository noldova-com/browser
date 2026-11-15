/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ToolCall, ToolFailureCode } from "@noldova/desktop.runtime";
import { beforeEach, describe, expect, it } from "vitest";

import { CallFailureException } from "../../src/exceptions/call-failure.exception.ts";
import { PageNotOpenException } from "../../src/exceptions/page-not-open.exception.ts";
import { PageUnboundException } from "../../src/exceptions/page-unbound.exception.ts";
import { SessionPage } from "../../src/models/session-page.ts";
import { SessionPages } from "../../src/services/session-pages.ts";
import type { JsonObject } from "../../src/types/json-value.ts";
import { ScriptedViews } from "../fixtures/scripted-views.fixture.ts";

function call(bindings: JsonObject): ToolCall {
  return new ToolCall("session-1", "conversation-1", bindings, {}, Date.now() + 5_000, new AbortController().signal);
}

function failureOf(pages: SessionPages, bindings: JsonObject): readonly [unknown, ToolFailureCode, string, string | null] {
  try {
    pages.find(call(bindings));
  } catch (error: unknown) {
    if (error instanceof CallFailureException)
      return [error.constructor, error.reason, error.message, error.moduleCode];
    throw error;
  }
  throw new Error("find returned a page.");
}

describe("SessionPages", () => {
  let surface: ScriptedViews;
  let pages: SessionPages;

  beforeEach(() => {
    surface = new ScriptedViews(["view-1", "view-2", "view-3"]);
    surface.instances.set("view-2", "page-a");
    surface.instances.set("view-3", "page-b");
    surface.profileKeys.set("view-3", "workspace-2");
    pages = new SessionPages(surface.webViews);
  });

  it("finds the open view whose pane is the bound page, in the bound workspace, with the agent's name the app binds", () => {
    expect(pages.find(call({ page: "page-a", profileKey: "workspace-1", agentName: "Scout" })))
      .toStrictEqual(new SessionPage("view-2", "page-a", "workspace-1", "Scout"));
    expect(pages.find(call({ page: "page-b", profileKey: "workspace-2" }))).toStrictEqual(new SessionPage("view-3", "page-b", "workspace-2", ""));
  });

  it("takes an agent's name bound as other than text as none", () => {
    expect(pages.find(call({ page: "page-a", profileKey: "workspace-1", agentName: 7 })).agentName).toBe("");
  });

  it("fails as unbound when the app bound no page or no workspace, or bound them as other than text", () => {
    const unbound: readonly [unknown, ToolFailureCode, string, string] = [PageUnboundException, ToolFailureCode.Unavailable, "The app bound this session to no page of its workspace.", "browser.unbound"];

    expect(failureOf(pages, {})).toEqual(unbound);
    expect(failureOf(pages, { page: "page-a" })).toEqual(unbound);
    expect(failureOf(pages, { profileKey: "workspace-1" })).toEqual(unbound);
    expect(failureOf(pages, { page: 7, profileKey: "workspace-1" })).toEqual(unbound);
    expect(failureOf(pages, { page: "page-a", profileKey: null })).toEqual(unbound);
  });

  it("fails as unbound when two windows' views show the bound page, rather than guess which one the app meant", () => {
    surface.instances.set("view-1", "page-a");

    expect(failureOf(pages, { page: "page-a", profileKey: "workspace-1" })).toEqual([PageUnboundException, ToolFailureCode.Unavailable, "The app bound this session to no page of its workspace.", "browser.unbound"]);
  });

  it("fails as closed when no open view shows the bound page, the pane without an instance included", () => {
    const closed: readonly [unknown, ToolFailureCode, string, string] = [PageNotOpenException, ToolFailureCode.Unavailable, "The session's page isn't open; ask the person to open it again.", "browser.viewClosed"];

    expect(failureOf(pages, { page: "page-c", profileKey: "workspace-1" })).toEqual(closed);
    expect(failureOf(pages, { page: "", profileKey: "workspace-1" })).toEqual(closed);
  });

  it("refuses a page of another workspace than the bound one", () => {
    expect(failureOf(pages, { page: "page-b", profileKey: "workspace-1" })).toEqual([PageUnboundException, ToolFailureCode.Unavailable, "The app bound this session to no page of its workspace.", "browser.unbound"]);
  });
});
