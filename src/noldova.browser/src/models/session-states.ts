/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { StaleReferenceException } from "../exceptions/stale-reference.exception.ts";
import { UnknownReferenceException } from "../exceptions/unknown-reference.exception.ts";
import type { SessionReference } from "../types/session-reference.ts";
import { SessionState } from "./session-state.ts";

export class SessionStates {
  private readonly states: Map<string, SessionState> = new Map();

  public issueReference(session: string, reference: SessionReference): string {
    return this.readState(session).issue(reference);
  }

  public resolveReference(session: string, id: string, viewId: string, documentId: string): SessionReference {
    const state: SessionState | undefined = this.states.get(session);
    if (state === undefined || !state.wasIssued(id))
      throw new UnknownReferenceException();
    const reference: SessionReference | undefined = state.referenceOf(id);
    if (reference === undefined || reference.viewId !== viewId || reference.documentId !== documentId)
      throw new StaleReferenceException();
    return reference;
  }

  public dropReferences(viewId: string): void {
    for (const state of this.states.values())
      state.dropReferences(viewId);
  }

  public dropView(viewId: string): void {
    for (const state of this.states.values()) {
      state.dropReferences(viewId);
      state.dropCursor(viewId);
    }
  }

  public readCursor(session: string, viewId: string): number {
    return this.states.get(session)?.cursorOf(viewId) ?? 0;
  }

  public writeCursor(session: string, viewId: string, cursor: number): void {
    this.readState(session).moveCursor(viewId, cursor);
  }

  public end(session: string): void {
    this.states.delete(session);
  }

  private readState(session: string): SessionState {
    const existing: SessionState | undefined = this.states.get(session);
    if (existing !== undefined)
      return existing;

    const created: SessionState = new SessionState();
    this.states.set(session, created);
    return created;
  }
}
