/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { MalformedReplyException } from "../../src/exceptions/malformed-reply.exception.ts";
import { FrameFacts } from "../../src/models/frame-facts.ts";
import { FrameTreeReader } from "../../src/services/frame-tree.reader.ts";
import type { JsonObject } from "../../src/types/json-value.ts";

describe("FrameTreeReader", () => {
  it("reads the top frame's URL, origin and loader id, and none of its child frames", () => {
    const reply: JsonObject = { frameTree: {
      frame: { id: "F1", loaderId: "L1", url: "https://docs.example/guide", securityOrigin: "https://docs.example", mimeType: "text/html" },
      childFrames: [{ frame: { id: "F2", loaderId: "L2", url: "https://ads.example/", securityOrigin: "https://ads.example" } }]
    } };

    expect(FrameTreeReader.read(reply)).toStrictEqual(new FrameFacts("https://docs.example/guide", "https://docs.example", "L1", "F1"));
  });

  it("reads a blank tab's and a data URL's origin as the module's opaque origin", () => {
    const read = (url: string, securityOrigin: string): string => FrameTreeReader.read({ frameTree: { frame: { id: "F1", loaderId: "L1", url, securityOrigin } } }).origin;

    expect([read("about:blank", "://"), read("data:text/html,<p>Hi</p>", "null")]).toEqual(["browser:opaque", "browser:opaque"]);
  });

  it.each<[string, JsonObject]>([
    ["no frame tree", {}],
    ["a frame tree that isn't an object", { frameTree: "F1" }],
    ["no top frame", { frameTree: {} }],
    ["no URL", { frameTree: { frame: { loaderId: "L1", securityOrigin: "https://docs.example" } } }],
    ["an origin that isn't text", { frameTree: { frame: { loaderId: "L1", url: "https://docs.example/", securityOrigin: 1 } } }],
    ["no loader id", { frameTree: { frame: { url: "https://docs.example/", securityOrigin: "https://docs.example" } } }],
    ["no frame id", { frameTree: { frame: { loaderId: "L1", url: "https://docs.example/", securityOrigin: "https://docs.example" } } }]
  ])("fails as a malformed reply with %s", (_case: string, reply: JsonObject) => {
    expect(() => FrameTreeReader.read(reply)).toThrow(MalformedReplyException);
  });
});
