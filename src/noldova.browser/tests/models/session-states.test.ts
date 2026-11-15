/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { StaleReferenceException } from "../../src/exceptions/stale-reference.exception.ts";
import { ElementReference } from "../../src/models/element-reference.ts";
import { SessionStates } from "../../src/models/session-states.ts";

const BUTTON: ElementReference = new ElementReference("view", "document-1", 11);
const OTHER_VIEW: ElementReference = new ElementReference("other", "document-9", 12);

describe("SessionStates", () => {
  it("issues short references, counted per session", () => {
    const states: SessionStates = new SessionStates();

    expect(states.issueReference("one", BUTTON)).toBe("e1");
    expect(states.issueReference("one", BUTTON)).toBe("e2");
    expect(states.issueReference("two", BUTTON)).toBe("e1");
  });

  it("resolves a reference in its own session and document", () => {
    const states: SessionStates = new SessionStates();
    const id: string = states.issueReference("one", BUTTON);

    expect(states.resolveReference("one", id, "view", "document-1")).toBe(BUTTON);
  });

  it("refuses a reference from another session, document, view or none at all as stale", () => {
    const states: SessionStates = new SessionStates();
    const id: string = states.issueReference("one", BUTTON);

    expect(() => states.resolveReference("two", id, "view", "document-1")).toThrow(StaleReferenceException);
    expect(() => states.resolveReference("one", id, "view", "document-2")).toThrow(StaleReferenceException);
    expect(() => states.resolveReference("one", id, "other", "document-1")).toThrow(StaleReferenceException);
    expect(() => states.resolveReference("one", "e9", "view", "document-1")).toThrow(StaleReferenceException);
  });

  it("drops one view's references for every session and keeps the others", () => {
    const states: SessionStates = new SessionStates();
    const first: string = states.issueReference("one", BUTTON);
    const second: string = states.issueReference("two", BUTTON);
    const kept: string = states.issueReference("one", OTHER_VIEW);

    states.dropReferences("view");

    expect(() => states.resolveReference("one", first, "view", "document-1")).toThrow(StaleReferenceException);
    expect(() => states.resolveReference("two", second, "view", "document-1")).toThrow(StaleReferenceException);
    expect(states.resolveReference("one", kept, "other", "document-9")).toBe(OTHER_VIEW);
  });

  it("keeps console cursors per session and view", () => {
    const states: SessionStates = new SessionStates();

    expect(states.readCursor("one", "view")).toBe(0);
    states.writeCursor("one", "view", 40);
    states.writeCursor("one", "other", 7);

    expect(states.readCursor("one", "view")).toBe(40);
    expect(states.readCursor("two", "view")).toBe(0);
  });

  it("drops a closed view's references and cursors", () => {
    const states: SessionStates = new SessionStates();
    const id: string = states.issueReference("one", BUTTON);
    states.writeCursor("one", "view", 40);
    states.writeCursor("one", "other", 7);

    states.dropView("view");

    expect(() => states.resolveReference("one", id, "view", "document-1")).toThrow(StaleReferenceException);
    expect(states.readCursor("one", "view")).toBe(0);
    expect(states.readCursor("one", "other")).toBe(7);
  });

  it("forgets everything of an ended session", () => {
    const states: SessionStates = new SessionStates();
    const id: string = states.issueReference("one", BUTTON);
    states.writeCursor("one", "view", 40);

    states.end("one");

    expect(() => states.resolveReference("one", id, "view", "document-1")).toThrow(StaleReferenceException);
    expect(states.readCursor("one", "view")).toBe(0);
    expect(states.issueReference("one", BUTTON)).toBe("e1");
  });
});
