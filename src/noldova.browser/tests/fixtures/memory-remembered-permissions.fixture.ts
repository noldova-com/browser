/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type PermissionDecision, RememberedPermission, type RememberedPermissionStore } from "@noldova/desktop.runtime";

export class MemoryRememberedPermissions implements RememberedPermissionStore {
  private readonly answers: Map<string, RememberedPermission> = new Map<string, RememberedPermission>();
  private remembered: number = 0;

  public find(module: string, action: string, subject: string | null, scope: string): PermissionDecision | null {
    return this.answers.get(JSON.stringify([module, action, subject, scope]))?.decision ?? null;
  }

  public remember(module: string, action: string, subject: string | null, scope: string, decision: PermissionDecision): void {
    const key: string = JSON.stringify([module, action, subject, scope]);
    this.remembered += 1;
    this.answers.delete(key);
    this.answers.set(key, new RememberedPermission(`remembered-${this.remembered}`, module, action, subject, scope, decision, new Date(this.remembered)));
  }

  public list(): readonly RememberedPermission[] {
    return [...this.answers.values()];
  }

  public forget(id: string): RememberedPermission | null {
    const answer: [string, RememberedPermission] | undefined = [...this.answers].find(([, t]) => t.id === id);
    if (answer === undefined)
      return null;
    this.answers.delete(answer[0]);
    return answer[1];
  }
}
