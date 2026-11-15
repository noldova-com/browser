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
    if (path === null)
      return ToolRisk.Medium;
    const found: [number, NodeFacts] | undefined = [...path.entries()].findLast(t => RiskClassifier.isActivating(t[1]));
    if (found !== undefined && RiskClassifier.isSubmitControl(found[1], path.slice(0, found[0])))
      return RiskClassifier.submitRisk(form);
    return ToolRisk.Medium;
  }

  public static classifyTyping(path: readonly NodeFacts[] | null, isSubmitting: boolean, form: readonly NodeFacts[]): ToolRisk {
    const field: NodeFacts | undefined = path?.at(-1);
    if (path === null || field === undefined)
      return ToolRisk.Medium;
    if (RiskClassifier.isSecret(field))
      return ToolRisk.High;
    if (isSubmitting && RiskClassifier.isTextInput(field) && RiskClassifier.isInForm(field, path.slice(0, -1)))
      return RiskClassifier.submitRisk(form);
    return ToolRisk.Medium;
  }

  public static isSubmittingKey(key: string): boolean {
    return key === Resources.submittingKey;
  }

  public static classifyKey(key: string, path: readonly NodeFacts[] | null, form: readonly NodeFacts[]): ToolRisk {
    const target: NodeFacts | undefined = path?.at(-1);
    if (path === null || target === undefined)
      return ToolRisk.Medium;
    if (RiskClassifier.isSecret(target))
      return ToolRisk.High;
    if (key === Resources.submittingKey && RiskClassifier.isTextInput(target) && RiskClassifier.isInForm(target, path.slice(0, -1)))
      return RiskClassifier.submitRisk(form);
    if (Resources.activatingKeys.includes(key))
      return RiskClassifier.classifyClick(path, form);
    return ToolRisk.Medium;
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
