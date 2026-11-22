/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MalformedReplyException } from "../../src/exceptions/malformed-reply.exception.ts";
import { ActionProgress } from "../../src/models/action-progress.ts";
import { CallOptions } from "../../src/models/call-options.ts";
import { OriginPage } from "../../src/models/origin-page.ts";
import { ShownPage } from "../../src/models/shown-page.ts";
import { HistoryPageReader } from "../../src/services/history-page.reader.ts";
import type { JsonObject } from "../../src/types/json-value.ts";
import { ToolBench } from "../fixtures/tool-bench.fixture.ts";

// A history the engine answers, by what is wrong with it.
class MalformedCase {
  public readonly flaw: string;
  public readonly history: JsonObject;

  public constructor(flaw: string, history: JsonObject) {
    this.flaw = flaw;
    this.history = history;
  }
}

describe("HistoryPageReader", () => {
  let bench: ToolBench;

  beforeEach(() => {
    bench = new ToolBench();
  });

  afterEach(() => {
    bench[Symbol.dispose]();
  });

  async function readAsync(history: JsonObject): Promise<OriginPage> {
    bench.surface.answer("Page.getNavigationHistory", history);
    return HistoryPageReader.readAsync(bench.kit.calls, ToolBench.VIEW, new CallOptions(new AbortController().signal, Date.now() + 60_000, 100_000, true, new ActionProgress(() => undefined)));
  }

  it("reads the current entry's address, title and origin", async () => {
    const history: JsonObject = { currentIndex: 1, entries: [{ url: "https://docs.example/", title: "Docs" }, { url: "https://docs.example/guide#setup", title: "Guide" }] };

    expect(await readAsync(history)).toStrictEqual(new OriginPage("https://docs.example", new ShownPage("https://docs.example/guide#setup", "Guide")));
  });

  it("reads a blank page's and an unreadable address's origin as the module's opaque origin", async () => {
    const origins: readonly string[] = [(await readAsync({ currentIndex: 0, entries: [{ url: "about:blank", title: "" }] })).origin,
      (await readAsync({ currentIndex: 0, entries: [{ url: "no address", title: "" }] })).origin];

    expect(origins).toEqual(["browser:opaque", "browser:opaque"]);
  });

  it.each([
    new MalformedCase("no current index", { entries: [{ url: "https://docs.example/", title: "Docs" }] }),
    new MalformedCase("entries that aren't a list", { currentIndex: 0, entries: {} }),
    new MalformedCase("an index past the entries", { currentIndex: 1, entries: [{ url: "https://docs.example/", title: "Docs" }] }),
    new MalformedCase("an entry that isn't an object", { currentIndex: 0, entries: ["https://docs.example/"] }),
    new MalformedCase("an entry with no URL", { currentIndex: 0, entries: [{ title: "Docs" }] }),
    new MalformedCase("an entry with no title", { currentIndex: 0, entries: [{ url: "https://docs.example/" }] })
  ])("fails as a malformed reply with $flaw", async (row: MalformedCase) => {
    await expect(readAsync(row.history)).rejects.toThrow(MalformedReplyException);
  });
});
