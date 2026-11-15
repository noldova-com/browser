/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { SessionPage } from "../../src/models/session-page.ts";

describe("SessionPage", () => {
  it("keeps its fields", () => {
    const sessionPage: SessionPage = new SessionPage("view-1", "page-1", "workspace-1", "Scout");

    expect([sessionPage.viewId, sessionPage.instance, sessionPage.profileKey, sessionPage.agentName]).toEqual(["view-1", "page-1", "workspace-1", "Scout"]);
  });
});
