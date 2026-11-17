/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ToolRisk } from "@noldova/desktop.runtime";

import type { NodeFacts } from "../models/node-facts.ts";
import { Resources } from "../resources.ts";

export class RiskClassifier {
  public static classifyClick(path: readonly NodeFacts[] | null, form: readonly NodeFacts[]): ToolRisk {
    return RiskClassifier.submitsClick(path) ? RiskClassifier.submitRisk(form) : ToolRisk.Medium;
  }

  public static submitsClick(path: readonly NodeFacts[] | null): boolean {
    if (path === null)
      return false;
    const found: [number, NodeFacts] | undefined = [...path.entries()].findLast(t => RiskClassifier.isActivating(t[1]));
    return found !== undefined && RiskClassifier.isSubmitControl(found[1], path.slice(0, found[0]));
  }

  public static classifyTyping(path: readonly NodeFacts[] | null, isSubmitting: boolean, form: readonly NodeFacts[]): ToolRisk {
    if (RiskClassifier.isSecretField(path))
      return ToolRisk.High;
    return isSubmitting && RiskClassifier.submitsEnter(path) ? RiskClassifier.submitRisk(form) : ToolRisk.Medium;
  }

  public static submitsEnter(path: readonly NodeFacts[] | null): boolean {
    const field: NodeFacts | undefined = path?.at(-1);
    return path !== null && field !== undefined && RiskClassifier.isTextInput(field) && RiskClassifier.isInForm(field, path.slice(0, -1));
  }

  public static isSubmittingKey(key: string): boolean {
    return key === Resources.submittingKey;
  }

  public static classifyKey(key: string, path: readonly NodeFacts[] | null, form: readonly NodeFacts[]): ToolRisk {
    if (RiskClassifier.isSecretField(path))
      return ToolRisk.High;
    return RiskClassifier.submitsKey(key, path) ? RiskClassifier.submitRisk(form) : ToolRisk.Medium;
  }

  public static submitsKey(key: string, path: readonly NodeFacts[] | null): boolean {
    if (key === Resources.submittingKey && RiskClassifier.submitsEnter(path))
      return true;
    return Resources.activatingKeys.includes(key) && RiskClassifier.submitsClick(path);
  }

  public static isSecretField(path: readonly NodeFacts[] | null): boolean {
    const field: NodeFacts | undefined = path?.at(-1);
    return field !== undefined && RiskClassifier.isSecret(field);
  }

  public static isSecret(field: NodeFacts): boolean {
    if (field.nodeName === Resources.inputElement && RiskClassifier.readLower(field, Resources.typeAttribute) === Resources.passwordInputType)
      return true;
    return RiskClassifier.readLower(field, Resources.autocompleteAttribute)
      .split(Resources.autocompleteTokenSeparator)
      .some(t => Resources.secretAutocomplete.includes(t) || t.startsWith(Resources.cardAutocompletePrefix));
  }

  private static submitRisk(form: readonly NodeFacts[]): ToolRisk {
    return form.some(t => RiskClassifier.isSecret(t)) ? ToolRisk.High : ToolRisk.Medium;
  }

  private static isSubmitControl(control: NodeFacts, ancestors: readonly NodeFacts[]): boolean {
    const type: string = RiskClassifier.readLower(control, Resources.typeAttribute);
    const isSubmitting: boolean = control.nodeName === Resources.buttonElement
      ? !Resources.nonSubmittingButtons.includes(type)
      : control.nodeName === Resources.inputElement && Resources.submittingInputs.includes(type);
    return isSubmitting && RiskClassifier.isInForm(control, ancestors);
  }

  private static isActivating(node: NodeFacts): boolean {
    return RiskClassifier.isLink(node) || node.nodeName === Resources.buttonElement || node.nodeName === Resources.inputElement;
  }

  private static isLink(node: NodeFacts): boolean {
    return (node.nodeName === Resources.anchorElement || node.nodeName === Resources.areaElement) && node.attributes.has(Resources.hrefAttribute);
  }

  private static isTextInput(node: NodeFacts): boolean {
    return node.nodeName === Resources.inputElement && !Resources.nonTextInputs.includes(RiskClassifier.readLower(node, Resources.typeAttribute));
  }

  private static isInForm(node: NodeFacts, ancestors: readonly NodeFacts[]): boolean {
    return node.attributes.has(Resources.formAttribute) || ancestors.some(t => t.nodeName === Resources.formElement);
  }

  private static readLower(node: NodeFacts, name: string): string {
    return RiskClassifier.readAttribute(node, name).trim().toLowerCase();
  }

  private static readAttribute(node: NodeFacts, name: string): string {
    return node.attributes.get(name) ?? "";
  }
}
