/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ClientClosure, RequestContext } from "@noldova/desktop.runtime";

import { PageClaim } from "./page-claim.ts";
import { PageHolder } from "./page-holder.ts";

export class PageHolders {
  private readonly holders: Map<string, PageHolder> = new Map<string, PageHolder>();

  public claim(instance: string, request: RequestContext): PageClaim {
    if (this.isHeldElsewhere(instance, request))
      return new PageClaim(false, false);
    const isHere: boolean = this.holders.has(instance);
    this.holders.set(instance, new PageHolder(request));
    return new PageClaim(true, isHere);
  }

  public isHeldElsewhere(instance: string, request: RequestContext): boolean {
    const holder: PageHolder | undefined = this.holders.get(instance);
    return holder !== undefined && !holder.isOf(request);
  }

  public letGo(instance: string): void {
    this.holders.delete(instance);
  }

  public close(closure: ClientClosure): void {
    for (const [instance, holder] of this.holders)
      if (holder.isClosedBy(closure))
        this.holders.delete(instance);
  }
}
