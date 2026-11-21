/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { PageInstanceInvalidException } from "../../src/exceptions/page-instance-invalid.exception.ts";
import { PageUrlInvalidException } from "../../src/exceptions/page-url-invalid.exception.ts";
import { ProfileKeyInvalidException } from "../../src/exceptions/profile-key-invalid.exception.ts";
import type { WindowRequestMalformedException } from "../../src/exceptions/window-request-malformed.exception.ts";
import { WindowRequestUnreadException } from "../../src/exceptions/window-request-unread.exception.ts";
import { PageRequests } from "../../src/services/page-requests.ts";
import type { JsonValue } from "../../src/types/json-value.ts";

type Failure = new (...args: never[]) => WindowRequestMalformedException;

describe("PageRequests", () => {
  const instance: string = "0f8fad5b-d9cb-469f-a165-70867728950e";

  it("reads a page's record, its instance and a workspace's profile key", () => {
    expect(PageRequests.readRecord({ instance, profileKey: "workspace-1", url: "https://docs.example.com/" }))
      .toEqual({ instance, profileKey: "workspace-1", url: "https://docs.example.com/" });
    expect(PageRequests.readRecord({ instance, profileKey: "workspace-1", url: "" })).toEqual({ instance, profileKey: "workspace-1", url: "" });
    expect(PageRequests.readRedirect({ instance, profileKey: "workspace-1", url: "https://www.example.com/" }))
      .toEqual({ instance, profileKey: "workspace-1", url: "https://www.example.com/" });
    expect(PageRequests.readPage({ instance })).toEqual({ instance });
    expect([PageRequests.readTypedAddress({ profileKey: "workspace-1", url: "https://example.com/", instance }), PageRequests.readTypedAddress({ profileKey: "workspace-1", url: "" })])
      .toEqual([{ profileKey: "workspace-1", url: "https://example.com/", instance }, { profileKey: "workspace-1", url: "", instance: null }]);
    expect([PageRequests.readOpenPages({ instances: [instance] }), PageRequests.readOpenPages({ instances: [] })]).toEqual([{ instances: [instance] }, { instances: [] }]);
    expect(PageRequests.readBrowsingData({ profileKey: "workspace-1" })).toEqual({ profileKey: "workspace-1" });
    expect([PageRequests.readStop({ instance, isTakingOver: true }), PageRequests.readStop({ instance, isTakingOver: false })])
      .toEqual([{ instance, isTakingOver: true }, { instance, isTakingOver: false }]);
  });

  it("takes an address of the longest length a view takes, and fails a longer one", () => {
    const longest: string = `https://a.example/${"a".repeat(32_768 - 18)}`;

    expect(PageRequests.readRecord({ instance, profileKey: "workspace-1", url: longest }).url).toBe(longest);
    expect(() => PageRequests.readRecord({ instance, profileKey: "workspace-1", url: `${longest}a` })).toThrow(PageUrlInvalidException);
  });

  it("fails a request that isn't an object, lacks a field, has one of the wrong kind or one it doesn't name", () => {
    const records: readonly JsonValue[] = [null, "page", [instance], { profileKey: "workspace-1", url: "" }, { instance, url: "" }, { instance, profileKey: "workspace-1" },
      { instance, profileKey: "workspace-1", url: 1 }, { instance, profileKey: "workspace-1", url: "", extra: true }];
    for (const params of records) {
      expect(() => PageRequests.readRecord(params), JSON.stringify(params)).toThrow(WindowRequestUnreadException);
      expect(() => PageRequests.readRedirect(params), JSON.stringify(params)).toThrow(WindowRequestUnreadException);
    }
    for (const params of [null, 1, {}, { instance: 1 }, { instance, extra: true }])
      expect(() => PageRequests.readPage(params), JSON.stringify(params)).toThrow(WindowRequestUnreadException);
    for (const params of [null, true, {}, { profileKey: 1 }, { profileKey: "workspace-1", instance }])
      expect(() => PageRequests.readBrowsingData(params), JSON.stringify(params)).toThrow(WindowRequestUnreadException);
    for (const params of [null, { isTakingOver: true }, { instance }, { instance, isTakingOver: "yes" }, { instance, isTakingOver: true, url: "" }])
      expect(() => PageRequests.readStop(params), JSON.stringify(params)).toThrow(WindowRequestUnreadException);
    for (const params of [null, [], {}, { instances: "page" }, { instances: [1] }, { instances: [], instance }])
      expect(() => PageRequests.readOpenPages(params), JSON.stringify(params)).toThrow(WindowRequestUnreadException);
  });

  it("names the field it doesn't read", () => {
    expect(() => PageRequests.readPage({ instance, extra: true })).toThrow(expect.objectContaining({ path: "$.extra" }));
  });

  it("fails an instance or a profile key the runtime doesn't take", () => {
    const records: readonly (readonly [JsonValue, Failure])[] = [
      [{ instance: instance.toUpperCase(), profileKey: "workspace-1", url: "" }, PageInstanceInvalidException],
      [{ instance: "1", profileKey: "workspace-1", url: "" }, PageInstanceInvalidException], [{ instance, profileKey: "Workspace", url: "" }, ProfileKeyInvalidException]
    ];
    for (const [params, failure] of records) {
      expect(() => PageRequests.readRecord(params), JSON.stringify(params)).toThrow(failure);
      expect(() => PageRequests.readRedirect(params), JSON.stringify(params)).toThrow(failure);
    }
    expect(() => PageRequests.readPage({ instance: "page" })).toThrow(PageInstanceInvalidException);
    expect(() => PageRequests.readTypedAddress({ profileKey: "workspace-1", url: "", instance: "page" })).toThrow(PageInstanceInvalidException);
    expect(() => PageRequests.readTypedAddress({ profileKey: "Workspace", url: "", instance })).toThrow(ProfileKeyInvalidException);
    expect(() => PageRequests.readBrowsingData({ profileKey: "-workspace" })).toThrow(ProfileKeyInvalidException);
    expect(() => PageRequests.readStop({ instance: "page", isTakingOver: true })).toThrow(PageInstanceInvalidException);
    expect(() => PageRequests.readOpenPages({ instances: [instance, "page"] })).toThrow(PageInstanceInvalidException);
  });
});
