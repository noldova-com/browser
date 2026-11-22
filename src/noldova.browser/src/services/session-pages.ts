/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { WebViewInfo } from "@noldova/desktop.protocol";
import type { IRuntimeWebViews, ToolCall } from "@noldova/desktop.runtime";

import { PageNotOpenException } from "../exceptions/page-not-open.exception.ts";
import { PageUnboundException } from "../exceptions/page-unbound.exception.ts";
import { SessionPage } from "../models/session-page.ts";
import { Resources } from "../resources.ts";
import type { JsonValue } from "../types/json-value.ts";

export class SessionPages {
  private readonly webViews: IRuntimeWebViews;

  public constructor(webViews: IRuntimeWebViews) {
    this.webViews = webViews;
  }

  public find(call: ToolCall): SessionPage {
    const instance: JsonValue | undefined = call.bindings[Resources.pageBinding];
    const profileKey: JsonValue | undefined = call.bindings[Resources.profileKeyBinding];
    if (!Object.isString(instance) || !Object.isString(profileKey) || profileKey === Resources.linkProfile)
      throw new PageUnboundException();
    const views: readonly WebViewInfo[] = this.webViews.list().filter(t => t.pane.name.text === Resources.pageDocument && t.pane.instance === instance);
    const view: WebViewInfo | undefined = views[0];
    if (Object.isUndefined(view))
      throw new PageNotOpenException(instance);
    if (views.length > 1 || view.profileKey !== profileKey)
      throw new PageUnboundException();
    const agentName: JsonValue | undefined = call.bindings[Resources.agentNameBinding];
    return new SessionPage(view.id, instance, profileKey, Object.isString(agentName) ? agentName : "");
  }
}
