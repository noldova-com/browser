/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { MalformedReplyException } from "../../src/exceptions/malformed-reply.exception.ts";
import { ContentQuads } from "../../src/services/content-quads.ts";
import type { JsonObject } from "../../src/types/json-value.ts";

describe("ContentQuads", () => {
  const TILTED: readonly number[] = [30, 10, 50, 20, 40, 40, 20, 30];

  it("reads the first of the element's quads, and none for an element with no box", () => {
    expect(ContentQuads.readFirst({ quads: [[1, 2, 3, 2, 3, 4, 1, 4], [9, 9, 9, 9, 9, 9, 9, 9]] })).toEqual([1, 2, 3, 2, 3, 4, 1, 4]);
    expect(ContentQuads.readFirst({ quads: [] })).toBeNull();
  });

  it("refuses a reply without a list of quads, a quad of other than four points, and a point that isn't a number", () => {
    const replies: readonly JsonObject[] = [{}, { quads: {} }, { quads: [{}] }, { quads: [[1, 2, 3, 4, 5, 6, 7]] }, { quads: [[1, 2, 3, 4, 5, 6, 7, 8, 9]] },
      { quads: [[1, 2, 3, 4, 5, 6, 7, "8"]] }];

    for (const reply of replies)
      expect(() => ContentQuads.readFirst(reply), JSON.stringify(reply)).toThrow(MalformedReplyException);
  });

  it("bounds a quad with its smallest box, and finds its centre as its points' mean", () => {
    expect([ContentQuads.toBox(TILTED), ContentQuads.toCentre(TILTED)]).toEqual([{ x: 20, y: 10, width: 30, height: 30 }, { x: 35, y: 25 }]);
  });
});
