/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PermissionDecision, RememberedPermission } from "@noldova/desktop.runtime";
import { describe, expect, it } from "vitest";

import { MemoryRememberedPermissions } from "./memory-remembered-permissions.fixture.ts";

describe("MemoryRememberedPermissions", () => {
  it("finds, lists and forgets what it remembered", () => {
    const store: MemoryRememberedPermissions = new MemoryRememberedPermissions();
    store.remember("browser", "browser.click", "https://shop.test", "conversation-1", PermissionDecision.AllowedAlways);
    store.remember("browser", "browser.type", null, "conversation-1", PermissionDecision.AllowedAlways);

    const found: readonly (PermissionDecision | null)[] = [
      store.find("browser", "browser.click", "https://shop.test", "conversation-1"), store.find("browser", "browser.click", "https://pay.test", "conversation-1")];
    const listed: readonly RememberedPermission[] = store.list();
    const forgotten: readonly (RememberedPermission | null)[] = [store.forget("remembered-1"), store.forget("remembered-1")];

    expect(found).toEqual([PermissionDecision.AllowedAlways, null]);
    expect(listed).toEqual([
      new RememberedPermission("remembered-1", "browser", "browser.click", "https://shop.test", "conversation-1", PermissionDecision.AllowedAlways, new Date(1)),
      new RememberedPermission("remembered-2", "browser", "browser.type", null, "conversation-1", PermissionDecision.AllowedAlways, new Date(2))
    ]);
    expect(forgotten).toEqual([listed[0], null]);
    expect([store.list(), store.find("browser", "browser.click", "https://shop.test", "conversation-1")]).toEqual([[listed[1]], null]);
  });

  it("lists a match it remembers again as its latest answer, after the older ones, as Noldova Desktop lists oldest first", () => {
    const store: MemoryRememberedPermissions = new MemoryRememberedPermissions();
    store.remember("browser", "browser.click", "https://shop.test", "conversation-1", PermissionDecision.AllowedAlways);
    store.remember("browser", "browser.type", null, "conversation-1", PermissionDecision.AllowedAlways);

    store.remember("browser", "browser.click", "https://shop.test", "conversation-1", PermissionDecision.DeniedAlways);

    expect(store.list().map(t => [t.id, t.action, t.decision])).toEqual([["remembered-2", "browser.type", PermissionDecision.AllowedAlways],
      ["remembered-3", "browser.click", PermissionDecision.DeniedAlways]]);
    expect(store.find("browser", "browser.click", "https://shop.test", "conversation-1")).toBe(PermissionDecision.DeniedAlways);
  });
});
