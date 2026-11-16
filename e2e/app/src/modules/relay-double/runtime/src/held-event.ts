/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import type { EventChannel } from "@noldova/desktop.runtime";

export class HeldEvent {
  private readonly channel: EventChannel;
  private readonly held: JsonValue[] = [];
  private isListened: boolean = false;

  public constructor(channel: EventChannel) {
    this.channel = channel;
  }

  public publish(payload: JsonValue): void {
    if (this.isListened)
      this.channel.publish(payload);
    else
      this.held.push(payload);
  }

  public listen(): void {
    this.isListened = true;
    for (const payload of this.held.splice(0))
      this.channel.publish(payload);
  }

  public [Symbol.dispose](): void {
    this.channel[Symbol.dispose]();
  }
}
