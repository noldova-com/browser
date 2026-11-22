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
    if (Object.isNull(path))
      return false;
    const control: NodeFacts | undefined = path.findLast(t => RiskClassifier.isActivating(t));
    return !Object.isUndefined(control) && RiskClassifier.isSubmitControl(control, path.slice(0, path.lastIndexOf(control)));
  }

  public static classifyTyping(path: readonly NodeFacts[] | null, isSubmitting: boolean, form: readonly NodeFacts[]): ToolRisk {
    if (RiskClassifier.isSecretField(path))
      return ToolRisk.High;
    return isSubmitting && RiskClassifier.submitsEnter(path) ? RiskClassifier.submitRisk(form) : ToolRisk.Medium;
  }

  public static submitsEnter(path: readonly NodeFacts[] | null): boolean {
    if (Object.isNull(path))
      return false;
    const field: NodeFacts | undefined = path.at(-1);
    return !Object.isUndefined(field) && RiskClassifier.isEnterSubmitting(field) && RiskClassifier.isInForm(field, path.slice(0, -1));
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
    return !Object.isUndefined(field) && RiskClassifier.isSecret(field);
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

  // The engine submits a form for Enter in any of its controls, a checkbox, a radio button and a select included, on some platforms or with
  // some sizes, but a textarea, where Enter types a line, and a button or a reset button, whose Enter clicks it.
  private static isEnterSubmitting(node: NodeFacts): boolean {
    if (node.nodeName === Resources.inputElement)
      return !Resources.enterClickedInputs.includes(RiskClassifier.readLower(node, Resources.typeAttribute));
    return Resources.enterSubmittingControls.includes(node.nodeName);
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
