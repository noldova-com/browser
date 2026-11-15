/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { ConsoleEvent } from "./console-event.ts";
import type { ConsoleRing } from "./console-ring.ts";

export class ConsoleNavigationEvent extends ConsoleEvent {
  public readonly url: string;
  public readonly origin: string;

  public constructor(url: string, origin: string) {
    super();
    this.url = url;
    this.origin = origin;
  }

  public addTo(ring: ConsoleRing): void {
    ring.navigate(this.origin);
    ring.add(null, Resources.consoleNavigationSource, ConsoleEvent.cut(this.url), Date.now());
  }
}
