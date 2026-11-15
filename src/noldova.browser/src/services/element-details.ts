/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IPermissionDetail, PermissionDetailKind } from "@noldova/desktop.runtime";

import type { ElementFacts } from "../models/element-facts.ts";
import type { NodeFacts } from "../models/node-facts.ts";
import { Resources } from "../resources.ts";

export class ElementDetails {
  public static describe(element: ElementFacts): readonly IPermissionDetail[] {
    const target: NodeFacts | undefined = element.path?.at(-1);
    if (target === undefined)
      return [{ label: Resources.elementLabel, kind: PermissionDetailKind.Text, value: Resources.unknownElement }];
    const details: IPermissionDetail[] = [{ label: Resources.elementLabel, kind: PermissionDetailKind.Text, value: Resources.formatTag(target.nodeName) }];
    const href: string | undefined = target.attributes.get(Resources.hrefAttribute);
    const destination: URL | null = href === undefined ? null : URL.parse(href, element.page.baseUrl);
    if (destination !== null)
      details.push({ label: Resources.destinationLabel, kind: PermissionDetailKind.Text, value: destination.href });
    return details;
  }
}
