/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TypedAddressRefusal } from "@noldova/browser.protocol";
import { describe, expect, it } from "vitest";

import { AddressReading } from "../../../src/app/models/address-reading.ts";
import { AddressReader } from "../../../src/app/services/address-reader.ts";

// A text typed in the address field and the web address it reads as.
class ReadCase {
  public readonly text: string;
  public readonly url: string;

  public constructor(text: string, url: string) {
    this.text = text;
    this.url = url;
  }
}

describe("AddressReader", () => {
  it.each([
    new ReadCase("example.com", "https://example.com/"),
    new ReadCase("  Example.COM/Docs?q=1#top  ", "https://example.com/Docs?q=1#top"),
    new ReadCase("https://example.com/path", "https://example.com/path"),
    new ReadCase("HTTP://example.com", "http://example.com/"),
    new ReadCase("http:example.com", "http://example.com/"),
    new ReadCase("localhost:3000", "http://localhost:3000/"),
    new ReadCase("app.localhost:4200/x", "http://app.localhost:4200/x"),
    new ReadCase("127.0.0.1:8080", "http://127.0.0.1:8080/"),
    new ReadCase("127.1:9000", "http://127.0.0.1:9000/"),
    new ReadCase("localhost:443", "http://localhost:443/"),
    new ReadCase("https://localhost:3000", "https://localhost:3000/"),
    new ReadCase("example.com:8080/app", "https://example.com:8080/app"),
    new ReadCase("localhost", "http://localhost/"),
    new ReadCase("192.168.1.2", "http://192.168.1.2/"),
    new ReadCase("192.168.1.10:8080", "http://192.168.1.10:8080/"),
    new ReadCase("10.0.0.5/admin", "http://10.0.0.5/admin"),
    new ReadCase("[fd00::1]:3000", "http://[fd00::1]:3000/"),
    new ReadCase("printer.local:631/jobs", "http://printer.local:631/jobs"),
    new ReadCase("printer.local.:631/jobs", "http://printer.local.:631/jobs"),
    new ReadCase("local.example.com", "https://local.example.com/"),
    new ReadCase("169.254.1.1", "https://169.254.1.1/"),
    new ReadCase("[::1]:8443", "http://[::1]:8443/"),
    new ReadCase("[::ffff:127.0.0.1]:3000", "http://[::ffff:7f00:1]:3000/"),
    new ReadCase("localhost.:5173", "http://localhost.:5173/"),
    new ReadCase("[::2]", "https://[::2]/"),
    new ReadCase("localhost.example.com", "https://localhost.example.com/"),
    new ReadCase("user@example.com", "https://user@example.com/"),
    new ReadCase("//example.com/a", "https://example.com/a")
  ])("reads $text as the web address $url", (row: ReadCase) => {
    expect(AddressReader.read(row.text, [])).toStrictEqual(new AddressReading(row.url, null));
  });

  it.each([
    new ReadCase("192.168.1.5:8006", "https://192.168.1.5:8006/"),
    new ReadCase("192.168.1.5:8006/ui", "https://192.168.1.5:8006/ui"),
    new ReadCase("192.168.1.5", "http://192.168.1.5/"),
    new ReadCase("192.168.1.6:8006", "http://192.168.1.6:8006/"),
    new ReadCase("10.0.0.2", "https://10.0.0.2/"),
    new ReadCase("10.0.0.3", "http://10.0.0.3/"),
    new ReadCase("10.0.0.3:443", "https://10.0.0.3/")
  ])("reads $text as $url with the scheme of the single site the settings name at its host and port", (row: ReadCase) => {
    const sites: readonly string[] = ["https://192.168.1.5:8006", "https://10.0.0.2", "http://10.0.0.3", "https://10.0.0.3"];

    expect(AddressReader.read(row.text, sites)).toStrictEqual(new AddressReading(row.url, null));
  });

  it.each(["", "   ", "release notes", "notes", "https://", "http://exa mple.com", "\texample.com\nnext"])("reads %j as no address", (text: string) => {
    expect(AddressReader.read(text, [])).toStrictEqual(new AddressReading(text.trim(), TypedAddressRefusal.NotAnAddress));
  });

  it.each(["file:///etc/hosts", "javascript:alert(1)", "data:text/html,hi", "about:blank", "mailto:a@example.com", "ftp://example.com", "localhost:admin"])(
    "reads %j as an address that isn't on the web",
    (text: string) => {
      expect(AddressReader.read(text, [])).toStrictEqual(new AddressReading(text.trim(), TypedAddressRefusal.NotWeb));
    });
});
