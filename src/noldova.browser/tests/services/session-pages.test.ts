/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ToolCall } from "@noldova/desktop.runtime";
import { beforeEach, describe, expect, it } from "vitest";

import { PageNotOpenException } from "../../src/exceptions/page-not-open.exception.ts";
import { PageUnboundException } from "../../src/exceptions/page-unbound.exception.ts";
import { SessionPage } from "../../src/models/session-page.ts";
import { SessionPages } from "../../src/services/session-pages.ts";
import type { JsonObject } from "../../src/types/json-value.ts";
import { ScriptedViews } from "../fixtures/scripted-views.fixture.ts";

function call(bindings: JsonObject): ToolCall {
  return new ToolCall("session-1", "conversation-1", bindings, {}, Date.now() + 5_000, new AbortController().signal);
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
    expect(() => pages.find(call({}))).toThrow(PageUnboundException);
    expect(() => pages.find(call({ page: "page-a" }))).toThrow(PageUnboundException);
    expect(() => pages.find(call({ profileKey: "workspace-1" }))).toThrow(PageUnboundException);
    expect(() => pages.find(call({ page: 7, profileKey: "workspace-1" }))).toThrow(PageUnboundException);
    expect(() => pages.find(call({ page: "page-a", profileKey: null }))).toThrow(PageUnboundException);
  });

  it("fails as unbound when the app bound the links workspace, the person's own browsing, even to a link's page open there", () => {
    surface.profileKeys.set("view-2", "links");

    expect(() => pages.find(call({ page: "page-a", profileKey: "links" }))).toThrow(PageUnboundException);
  });

  it("fails as unbound when two windows' views show the bound page, rather than guess which one the app meant", () => {
    surface.instances.set("view-1", "page-a");

    expect(() => pages.find(call({ page: "page-a", profileKey: "workspace-1" }))).toThrow(PageUnboundException);
  });

  it("fails as closed when no open view shows the bound page, the pane without an instance included", () => {
    expect(() => pages.find(call({ page: "page-c", profileKey: "workspace-1" }))).toThrow(PageNotOpenException);
    expect(() => pages.find(call({ page: "", profileKey: "workspace-1" }))).toThrow(PageNotOpenException);
  });

  it("refuses a page of another workspace than the bound one", () => {
    expect(() => pages.find(call({ page: "page-b", profileKey: "workspace-1" }))).toThrow(PageUnboundException);
  });
});
