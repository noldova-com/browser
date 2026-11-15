/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWebViewRelay, WebViewProtocolEvent } from "@noldova/desktop.runtime";

import type { ConsoleEvent } from "../models/console-event.ts";
import { ConsoleRead } from "../models/console-read.ts";
import { ConsoleRing } from "../models/console-ring.ts";
import { ConsoleEventsReader } from "./console-events.reader.ts";

export class ConsoleBuffers {
  private readonly relay: IWebViewRelay;
  private readonly rings: Map<string, ConsoleRing> = new Map<string, ConsoleRing>();
  private readonly stops: Map<string, () => void> = new Map<string, () => void>();

  public constructor(relay: IWebViewRelay) {
    this.relay = relay;
  }

  public start(viewId: string, origin: string): void {
    if (this.stops.has(viewId))
      return;
    const paused: ConsoleRing | undefined = this.rings.get(viewId);
    paused?.resume(origin);
    const ring: ConsoleRing = paused ?? new ConsoleRing(origin);
    this.rings.set(viewId, ring);
    this.stops.set(viewId, this.relay.onProtocolEvent(viewId, (event: WebViewProtocolEvent) => {
      const heard: ConsoleEvent | null = ConsoleEventsReader.read(event.method, event.params);
      if (heard !== null)
        heard.addTo(ring);
    }));
  }

  public read(viewId: string, cursor: number): ConsoleRead {
    const ring: ConsoleRing | undefined = this.rings.get(viewId);
    if (ring === undefined)
      return new ConsoleRead([], 0, 0, false);
    return ring.read(cursor);
  }

  public pause(viewId: string): void {
    this.stops.get(viewId)?.();
    this.stops.delete(viewId);
  }

  public close(viewId: string): void {
    this.pause(viewId);
    this.rings.delete(viewId);
  }

}
