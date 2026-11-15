/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { MalformedReplyException } from "../../src/exceptions/malformed-reply.exception.ts";
import { LayoutMetrics } from "../../src/models/layout-metrics.ts";
import { LayoutMetricsReader } from "../../src/services/layout-metrics.reader.ts";
import type { JsonObject } from "../../src/types/json-value.ts";

const VIEWPORT: JsonObject = { pageX: 0, pageY: 300, clientWidth: 800, clientHeight: 600 };
const CONTENT: JsonObject = { width: 800, height: 2400 };
const CSS: JsonObject = { cssVisualViewport: VIEWPORT, cssContentSize: CONTENT, visualViewport: { clientWidth: 800 } };

describe("LayoutMetricsReader", () => {
  it("reads the viewport's place and size and the page's size in CSS pixels, and the device scale from the device-pixel viewport", () => {
    expect(LayoutMetricsReader.read({ ...CSS, visualViewport: { clientWidth: 1600 } }))
      .toStrictEqual(new LayoutMetrics(0, 300, 800, 600, 800, 2400, 2));
  });

  it("takes a device scale of one when either viewport has no width to divide by", () => {
    expect(LayoutMetricsReader.read(CSS).deviceScale).toBe(1);
    expect(LayoutMetricsReader.read({ ...CSS, visualViewport: { clientWidth: 0 } }).deviceScale).toBe(1);
    expect(LayoutMetricsReader.read({ ...CSS, cssVisualViewport: { pageX: 0, pageY: 0, clientWidth: 0, clientHeight: 0 }, visualViewport: { clientWidth: 10 } }).deviceScale).toBe(1);
  });

  it("fails as malformed without the CSS viewport, the page's size, the device-pixel viewport or one of their numbers", () => {
    const replies: readonly JsonObject[] = [{ cssContentSize: CONTENT, visualViewport: { clientWidth: 800 } }, { cssVisualViewport: VIEWPORT, visualViewport: { clientWidth: 800 } },
      { ...CSS, cssContentSize: { width: 800 } }, { cssVisualViewport: VIEWPORT, cssContentSize: CONTENT }, { ...CSS, visualViewport: [] }, { ...CSS, visualViewport: { clientWidth: "800" } }];
    for (const reply of replies)
      expect(() => LayoutMetricsReader.read(reply), JSON.stringify(reply)).toThrow(MalformedReplyException);
  });

  it("fails as malformed on a negative size, and takes a negative place", () => {
    const replies: readonly JsonObject[] = [{ ...CSS, cssVisualViewport: { ...VIEWPORT, clientWidth: -1 } }, { ...CSS, cssVisualViewport: { ...VIEWPORT, clientHeight: -1 } },
      { ...CSS, cssContentSize: { width: -1, height: 2400 } }, { ...CSS, cssContentSize: { width: 800, height: -1 } }, { ...CSS, visualViewport: { clientWidth: -1 } }];
    for (const reply of replies)
      expect(() => LayoutMetricsReader.read(reply), JSON.stringify(reply)).toThrow(MalformedReplyException);
    expect(LayoutMetricsReader.read({ ...CSS, cssVisualViewport: { ...VIEWPORT, pageX: -20 } }).pageX).toBe(-20);
  });
});
