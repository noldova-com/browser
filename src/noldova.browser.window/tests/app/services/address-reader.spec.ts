/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { ReadAddress } from "../../../src/app/models/read-address.ts";
import { AddressReader } from "../../../src/app/services/address-reader.ts";

describe("AddressReader", () => {
  it.each([
    ["example.com", "https://example.com/"],
    ["  Example.COM/Docs?q=1#top  ", "https://example.com/Docs?q=1#top"],
    ["https://example.com/path", "https://example.com/path"],
    ["HTTP://example.com", "http://example.com/"],
    ["http:example.com", "http://example.com/"],
    ["localhost:3000", "http://localhost:3000/"],
    ["app.localhost:4200/x", "http://app.localhost:4200/x"],
    ["127.0.0.1:8080", "http://127.0.0.1:8080/"],
    ["127.1:9000", "http://127.0.0.1:9000/"],
    ["localhost:443", "http://localhost:443/"],
    ["https://localhost:3000", "https://localhost:3000/"],
    ["example.com:8080/app", "https://example.com:8080/app"],
    ["localhost", "http://localhost/"],
    ["192.168.1.2", "https://192.168.1.2/"],
    ["[::1]:8443", "http://[::1]:8443/"],
    ["[::ffff:127.0.0.1]:3000", "http://[::ffff:7f00:1]:3000/"],
    ["localhost.:5173", "http://localhost.:5173/"],
    ["[::2]", "https://[::2]/"],
    ["localhost.example.com", "https://localhost.example.com/"],
    ["user@example.com", "https://user@example.com/"],
    ["//example.com/a", "https://example.com/a"]
  ])("reads %j as the web address %s", (text, url) => {
    expect(AddressReader.read(text)).toStrictEqual(new ReadAddress(url));
  });

  it.each(["", "   ", "release notes", "notes", "https://", "http://exa mple.com", "\texample.com\nnext"])("reads %j as no address", text => {
    expect(AddressReader.read(text)).toEqual({ kind: "Refused", reason: "NotAnAddress" });
  });

  it.each(["file:///etc/hosts", "javascript:alert(1)", "data:text/html,hi", "about:blank", "mailto:a@example.com", "ftp://example.com", "localhost:admin"])(
    "reads %j as an address that isn't on the web",
    text => {
      expect(AddressReader.read(text)).toEqual({ kind: "Refused", reason: "NotWeb" });
    });
});
