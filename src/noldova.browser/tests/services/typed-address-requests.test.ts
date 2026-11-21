/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { ProfileKeyInvalidException } from "../../src/exceptions/profile-key-invalid.exception.ts";
import { WindowRequestUnreadException } from "../../src/exceptions/window-request-unread.exception.ts";
import { TypedAddressRequests } from "../../src/services/typed-address-requests.ts";

describe("TypedAddressRequests", () => {
  it("reads the profile key and the address, whatever the address's text", () => {
    expect([
      TypedAddressRequests.read({ profileKey: "folder-1", url: "https://example.com/" }),
      TypedAddressRequests.read({ profileKey: "0", url: "" })
    ]).toEqual([{ profileKey: "folder-1", url: "https://example.com/", instance: null }, { profileKey: "0", url: "", instance: null }]);
  });

  it("fails a request that isn't an object, or has a field it doesn't name", () => {
    for (const params of [null, "folder-1", 1, [{ profileKey: "folder-1", url: "" }], { profileKey: "folder-1", url: "", extra: true }])
      expect(() => TypedAddressRequests.read(params)).toThrow(WindowRequestUnreadException);
  });

  it("fails a profile key the base wouldn't take", () => {
    for (const params of [{ url: "" }, { profileKey: 7, url: "" }])
      expect(() => TypedAddressRequests.read(params)).toThrow(WindowRequestUnreadException);
    for (const profileKey of ["", "-folder", "Folder", "folder_1", "a".repeat(65)])
      expect(() => TypedAddressRequests.read({ profileKey, url: "" })).toThrow(ProfileKeyInvalidException);
    expect(TypedAddressRequests.read({ profileKey: "a".repeat(64), url: "" }).profileKey).toHaveLength(64);
  });

  it("fails an address that isn't text", () => {
    for (const params of [{ profileKey: "folder-1" }, { profileKey: "folder-1", url: 1 }, { profileKey: "folder-1", url: null }])
      expect(() => TypedAddressRequests.read(params)).toThrow(WindowRequestUnreadException);
  });
});
