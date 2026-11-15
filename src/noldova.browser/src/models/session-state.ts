/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import type { ElementReference } from "./element-reference.ts";

export class SessionState {
  private readonly references: Map<string, ElementReference> = new Map();
  private readonly cursors: Map<string, number> = new Map();
  private issued: number = 0;

  public issue(reference: ElementReference): string {
    this.issued += 1;
    const id: string = `${Resources.referencePrefix}${this.issued}`;
    this.references.set(id, reference);
    return id;
  }

  public referenceOf(id: string): ElementReference | undefined {
    return this.references.get(id);
  }

  public dropReferences(viewId: string): void {
    for (const [id, reference] of this.references)
      if (reference.viewId === viewId)
        this.references.delete(id);
  }

  public dropCursor(viewId: string): void {
    this.cursors.delete(viewId);
  }

  public cursorOf(viewId: string): number {
    return this.cursors.get(viewId) ?? 0;
  }

  public moveCursor(viewId: string, cursor: number): void {
    this.cursors.set(viewId, cursor);
  }
}
