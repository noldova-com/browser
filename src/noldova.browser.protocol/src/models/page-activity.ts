/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/context.json";

import { PageAction } from "../enums/page-action.ts";
import { PageActivityState } from "../enums/page-activity-state.ts";
import { Resources } from "../resources.ts";
import { WireContract } from "../services/wire-contract.ts";
import { PageBox } from "./page-box.ts";
import { PagePoint } from "./page-point.ts";
import { PageRefusal } from "./page-refusal.ts";

export class PageActivity {
  private static readonly FIELDS: readonly string[] = [
    Resources.instanceField, Resources.activityField, Resources.agentNameField, Resources.actionField, Resources.stateField, Resources.boxField, Resources.pointField,
    Resources.refusalField, Resources.isHandedOverField
  ];
  private static readonly ACTIONS: readonly PageAction[] = Object.values(PageAction);
  private static readonly STATES: readonly PageActivityState[] = Object.values(PageActivityState);

  public readonly instance: string;
  public readonly activity: string;
  public readonly agentName: string;
  public readonly action: PageAction;
  public readonly state: PageActivityState;
  public readonly box: PageBox | null;
  public readonly point: PagePoint | null;
  public readonly refusal: PageRefusal | null;
  public readonly isHandedOver: boolean;

  public constructor(
    instance: string,
    activity: string,
    agentName: string,
    action: PageAction,
    state: PageActivityState,
    box: PageBox | null,
    point: PagePoint | null,
    refusal: PageRefusal | null,
    isHandedOver: boolean) {
    this.instance = instance;
    this.activity = activity;
    this.agentName = agentName;
    this.action = action;
    this.state = state;
    this.box = box;
    this.point = point;
    this.refusal = refusal;
    this.isHandedOver = isHandedOver;
  }

  public static fromJson(value: unknown, path?: string): PageActivity {
    const reader: JsonReader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, PageActivity.FIELDS);
    const instance: string = reader.readString(Resources.instanceField);
    const activity: string = reader.readString(Resources.activityField);
    const agentName: string = reader.readString(Resources.agentNameField);
    const action: PageAction = reader.readOneOf(Resources.actionField, PageActivity.ACTIONS);
    const state: PageActivityState = reader.readOneOf(Resources.stateField, PageActivity.STATES);
    const box: JsonReader | null = reader.readNullableObject(Resources.boxField);
    const point: JsonReader | null = reader.readNullableObject(Resources.pointField);
    const refusal: JsonReader | null = reader.readNullableObject(Resources.refusalField);
    return new PageActivity(instance, activity, agentName, action, state, box === null ? null : PageBox.fromJson(box.toJson(), box.path),
      point === null ? null : PagePoint.fromJson(point.toJson(), point.path), refusal === null ? null : PageRefusal.fromJson(refusal.toJson(), refusal.path),
      reader.readBoolean(Resources.isHandedOverField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.instanceField]: this.instance,
      [Resources.activityField]: this.activity,
      [Resources.agentNameField]: this.agentName,
      [Resources.actionField]: this.action,
      [Resources.stateField]: this.state,
      [Resources.boxField]: this.box === null ? null : this.box.toJson(),
      [Resources.pointField]: this.point === null ? null : this.point.toJson(),
      [Resources.refusalField]: this.refusal === null ? null : this.refusal.toJson(),
      [Resources.isHandedOverField]: this.isHandedOver
    };
  }
}
