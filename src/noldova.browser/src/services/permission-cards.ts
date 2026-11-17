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
import type { ShownElement } from "../models/shown-element.ts";
import { Resources } from "../resources.ts";
import { RiskClassifier } from "./risk-classifier.ts";

export class PermissionCards {
  public static clickTitle(facts: ElementFacts, shown: ShownElement, origin: string): string {
    const host: string = Resources.formatHost(origin);
    return RiskClassifier.submitsClick(facts.path)
      ? PermissionCards.submitTitle(facts, host)
      : PermissionCards.fit(shown.name, t => Resources.formatClickTitle(t, shown.role, host));
  }

  public static typeTitle(facts: ElementFacts, shown: ShownElement, isSubmitting: boolean, origin: string): string {
    const host: string = Resources.formatHost(origin);
    return isSubmitting && RiskClassifier.submitsEnter(facts.path)
      ? PermissionCards.submitTitle(facts, host)
      : PermissionCards.fit(shown.name, t => Resources.formatTypeTitle(t, shown.role, host));
  }

  public static keyTitle(facts: ElementFacts | null, key: string, chord: string, origin: string): string {
    const host: string = Resources.formatHost(origin);
    return facts !== null && RiskClassifier.submitsKey(key, facts.path)
      ? PermissionCards.submitTitle(facts, host)
      : Resources.formatPressKeyTitle(chord, host);
  }

  public static page(url: string, title: string): IPermissionDetail {
    return PermissionCards.text(Resources.pageLabel, Resources.formatPage(url, PermissionCards.fromPage(title, Resources.maximumPageTitleLength)));
  }

  public static element(facts: ElementFacts, shown: ShownElement): readonly IPermissionDetail[] {
    const target: NodeFacts | undefined = facts.path?.at(-1);
    if (target === undefined)
      return [PermissionCards.text(Resources.elementLabel, Resources.unknownElement)];
    const name: string = PermissionCards.fromPage(shown.name, Resources.maximumNameLength);
    const details: IPermissionDetail[] = [PermissionCards.text(PermissionCards.labelOf(shown.role), Resources.formatNamed(name, shown.role))];
    const href: string | undefined = target.attributes.get(Resources.hrefAttribute);
    const destination: URL | null = href === undefined ? null : URL.parse(href, facts.page.baseUrl);
    if (destination !== null)
      details.push(PermissionCards.text(Resources.destinationLabel, destination.href));
    return details;
  }

  public static typed(text: string, isHidden: boolean): IPermissionDetail {
    return isHidden
      ? PermissionCards.text(Resources.textLabel, Resources.formatHidden([...text].length))
      : { label: Resources.textLabel, kind: PermissionDetailKind.AgentText, value: text };
  }

  public static sends(facts: ElementFacts): readonly IPermissionDetail[] {
    const names: readonly string[] = facts.form.flatMap(t => {
      const name: string | undefined = t.attributes.get(Resources.nameAttribute);
      return name !== undefined && PermissionCards.isSent(t) ? [PermissionCards.fromPage(name, Resources.maximumNameLength)] : [];
    });
    return [PermissionCards.text(Resources.sendsLabel, names.length === 0 ? Resources.noNamedFields : names.join(", "))];
  }

  public static move(from: string, to: string): readonly IPermissionDetail[] {
    return [PermissionCards.text(Resources.fromLabel, from), PermissionCards.text(Resources.toLabel, to)];
  }

  private static submitTitle(facts: ElementFacts, host: string): string {
    return PermissionCards.fit(facts.formName, t => Resources.formatSubmitTitle(t, host));
  }

  private static fit(name: string, format: (name: string) => string): string {
    const room: number = Resources.maximumTitleLength - format(Resources.shownCut).length;
    return format(PermissionCards.fromPage(name, Math.max(1, Math.min(Resources.maximumNameLength, room + 1))));
  }

  private static labelOf(role: string): string {
    if (role === Resources.linkRole)
      return Resources.linkLabel;
    if (role === Resources.buttonRole)
      return Resources.buttonLabel;
    return Resources.typedRoles.has(role) ? Resources.fieldLabel : Resources.elementLabel;
  }

  private static isSent(node: NodeFacts): boolean {
    const type: string = (node.attributes.get(Resources.typeAttribute) ?? "").trim().toLowerCase();
    return Resources.sentElements.includes(node.nodeName) && !Resources.unsentInputs.includes(type);
  }

  private static text(label: string, value: string): IPermissionDetail {
    return { label, kind: PermissionDetailKind.Text, value: PermissionCards.cut(value, Resources.maximumDetailLength) };
  }

  private static fromPage(text: string, maximum: number): string {
    return PermissionCards.cut(text.replace(/\p{Cf}/gu, "").replace(/\s+/g, " ").trim(), maximum);
  }

  private static cut(text: string, maximum: number): string {
    if (text.length <= maximum)
      return text;
    let kept: string = "";
    for (const character of text) {
      if (kept.length + character.length > maximum - Resources.shownCut.length)
        break;
      kept += character;
    }
    return `${kept}${Resources.shownCut}`;
  }
}
