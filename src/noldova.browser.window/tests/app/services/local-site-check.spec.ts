/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { LocalSiteCheck } from "../../../src/app/services/local-site-check.ts";

describe("LocalSiteCheck", () => {
  it("passes a list the runtime part reads whole, and an empty one", () => {
    expect([LocalSiteCheck.check("http://127.0.0.1:4173, https://localhost:8443, http://192.168.1.20"), LocalSiteCheck.check(" , ")]).toEqual([null, null]);
  });

  it("names the one entry the runtime part leaves out, as the person wrote it", () => {
    expect(LocalSiteCheck.check("http://127.0.0.1:4173, http://127.0.0.1:4173/form")).toBe(
      "\"http://127.0.0.1:4173/form\" isn't a site's address on this computer or network. Enter addresses with http:// or https://, as localhost or an IP address, and no path, separated by commas, such as http://localhost:4173; for a server on 0.0.0.0, enter http://127.0.0.1:<port>.");
  });

  it.each([
    ["127.0.0.1:4173", "no scheme"],
    ["http://0.0.0.0:3000", "an unspecified host"],
    ["http://169.254.1.1", "a link-local host"],
    ["https://example.com", "a host that isn't local"],
    ["http://user:secret@127.0.0.1", "a user and a password"],
    ["ftp://127.0.0.1", "another scheme"]
  ])("names %j, with %s, among the entries it leaves out", entry => {
    expect(LocalSiteCheck.check(`http://localhost:3000, ${entry}, http://[::1]:5000`)).toBe(
      `"${entry}" isn't a site's address on this computer or network. Enter addresses with http:// or https://, as localhost or an IP address, and no path, separated by commas, such as http://localhost:4173; for a server on 0.0.0.0, enter http://127.0.0.1:<port>.`);
  });

  it("names every entry it leaves out, in their order", () => {
    expect(LocalSiteCheck.check("http://0.0.0.0:3000, http://127.0.0.1, ftp://127.0.0.1")).toBe(
      "\"http://0.0.0.0:3000\", \"ftp://127.0.0.1\" aren't sites' addresses on this computer or network. Enter addresses with http:// or https://, as localhost or an IP address, and no path, separated by commas, such as http://localhost:4173; for a server on 0.0.0.0, enter http://127.0.0.1:<port>.");
  });
});
