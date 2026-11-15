/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { BrowserToolNames } from "@noldova/browser.protocol";
import { type IToolDescriptor, ToolRisk } from "@noldova/desktop.runtime";

import { Resources } from "../resources.ts";
import { BrowserLimits } from "./browser-limits.ts";
import { ToolSchemas } from "./tool-schemas.ts";

export class ToolDescriptors {
  public static readonly navigateChoices: readonly string[] = [Resources.urlField, Resources.actionField];
  public static readonly waitForChoices: readonly string[] = [Resources.textField, Resources.referenceField, Resources.loadField];

  public static readonly navigate: IToolDescriptor = {
    name: BrowserToolNames.navigate,
    title: Resources.navigateTitle,
    description: Resources.navigateDescription,
    inputSchema: ToolSchemas.objectSchema({
      url: { type: Resources.stringSchemaType, maxLength: BrowserLimits.maximumUrlLength },
      action: { type: Resources.stringSchemaType, enum: [Resources.backAction, Resources.forwardAction, Resources.reloadAction] }
    }, []),
    outputSchema: ToolSchemas.output,
    hints: { isReadOnly: false, isDestructive: false, isOpenWorld: true },
    risk: { default: ToolRisk.Low, maximum: ToolRisk.Medium },
    isResumable: false,
    marksSending: true,
    deadline: ToolSchemas.stepDeadline,
    nextTool: BrowserToolNames.snapshot
  };

  public static readonly snapshot: IToolDescriptor = {
    name: BrowserToolNames.snapshot,
    title: Resources.snapshotTitle,
    description: Resources.snapshotDescription,
    inputSchema: ToolSchemas.objectSchema({}, []),
    outputSchema: ToolSchemas.output,
    hints: ToolSchemas.reading,
    risk: { default: ToolRisk.Low, maximum: ToolRisk.Low },
    isResumable: true,
    marksSending: false,
    deadline: ToolSchemas.stepDeadline
  };

  public static readonly click: IToolDescriptor = {
    name: BrowserToolNames.click,
    title: Resources.clickTitle,
    description: Resources.clickDescription,
    inputSchema: ToolSchemas.objectSchema({
      reference: ToolSchemas.reference,
      button: { type: Resources.stringSchemaType, enum: Object.values(Resources.mouseButtonNames) },
      clickCount: { type: Resources.integerSchemaType, minimum: 1, maximum: Resources.maximumClicks }
    }, [Resources.referenceField]),
    outputSchema: ToolSchemas.output,
    hints: ToolSchemas.acting,
    risk: { default: ToolRisk.Medium, maximum: ToolRisk.High },
    isResumable: false,
    marksSending: true,
    deadline: ToolSchemas.stepDeadline,
    nextTool: BrowserToolNames.snapshot
  };

  public static readonly type: IToolDescriptor = {
    name: BrowserToolNames.type,
    title: Resources.typeTitle,
    description: Resources.typeDescription,
    inputSchema: ToolSchemas.objectSchema({
      reference: ToolSchemas.reference,
      text: { type: Resources.stringSchemaType, maxLength: BrowserLimits.maximumTypedTextLength },
      submit: { type: Resources.booleanSchemaType }
    }, [Resources.referenceField, Resources.textField]),
    outputSchema: ToolSchemas.output,
    hints: ToolSchemas.acting,
    risk: { default: ToolRisk.Medium, maximum: ToolRisk.High },
    isResumable: false,
    marksSending: true,
    deadline: ToolSchemas.stepDeadline,
    nextTool: BrowserToolNames.snapshot
  };

  public static readonly pressKey: IToolDescriptor = {
    name: BrowserToolNames.pressKey,
    title: Resources.pressKeyTitle,
    description: Resources.pressKeyDescription,
    inputSchema: ToolSchemas.objectSchema({
      key: { type: Resources.stringSchemaType, minLength: 1 },
      modifiers: { type: Resources.arraySchemaType, items: { type: Resources.stringSchemaType, enum: [...Resources.keyModifiers] }, maxItems: Resources.keyModifiers.length }
    }, [Resources.keyField]),
    outputSchema: ToolSchemas.output,
    hints: ToolSchemas.acting,
    risk: { default: ToolRisk.Medium, maximum: ToolRisk.High },
    isResumable: false,
    marksSending: true,
    deadline: ToolSchemas.stepDeadline,
    nextTool: BrowserToolNames.snapshot
  };

  public static readonly screenshot: IToolDescriptor = {
    name: BrowserToolNames.screenshot,
    title: Resources.screenshotTitle,
    description: Resources.screenshotDescription,
    inputSchema: ToolSchemas.objectSchema({
      reference: ToolSchemas.reference,
      fullPage: { type: Resources.booleanSchemaType }
    }, []),
    outputSchema: ToolSchemas.output,
    hints: ToolSchemas.reading,
    risk: { default: ToolRisk.Low, maximum: ToolRisk.Low },
    isResumable: true,
    marksSending: false,
    deadline: ToolSchemas.stepDeadline
  };

  public static readonly console: IToolDescriptor = {
    name: BrowserToolNames.console,
    title: Resources.consoleTitle,
    description: Resources.consoleDescription,
    inputSchema: ToolSchemas.objectSchema({
      cursor: { type: Resources.integerSchemaType, minimum: 0 },
      level: { type: Resources.stringSchemaType, enum: Object.values(Resources.consoleLevelNames) }
    }, []),
    outputSchema: ToolSchemas.output,
    hints: ToolSchemas.reading,
    risk: { default: ToolRisk.Low, maximum: ToolRisk.Low },
    isResumable: true,
    marksSending: false,
    deadline: ToolSchemas.stepDeadline
  };

  public static readonly waitFor: IToolDescriptor = {
    name: BrowserToolNames.waitFor,
    title: Resources.waitForTitle,
    description: Resources.waitForDescription,
    inputSchema: ToolSchemas.objectSchema({
      text: { type: Resources.stringSchemaType, minLength: 1, maxLength: BrowserLimits.maximumTypedTextLength },
      reference: ToolSchemas.reference,
      load: { type: Resources.booleanSchemaType, const: true },
      timeoutMilliseconds: { type: Resources.integerSchemaType, minimum: 1, maximum: BrowserLimits.maximumWaitMilliseconds }
    }, [Resources.timeoutMillisecondsField]),
    outputSchema: ToolSchemas.output,
    hints: ToolSchemas.reading,
    risk: { default: ToolRisk.Low, maximum: ToolRisk.Low },
    isResumable: true,
    marksSending: false,
    deadline: ToolSchemas.waitDeadline
  };

  public static readonly all: readonly IToolDescriptor[] = [
    ToolDescriptors.navigate,
    ToolDescriptors.snapshot,
    ToolDescriptors.click,
    ToolDescriptors.type,
    ToolDescriptors.pressKey,
    ToolDescriptors.screenshot,
    ToolDescriptors.console,
    ToolDescriptors.waitFor
  ];
}
