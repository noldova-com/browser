/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { BrowsingDataRequest, OpenPagesRequest, PageRecord, PageRequest, PageStopRequest, type TypedAddressRequest, TypedRedirectRequest } from "@noldova/browser.protocol";

import { PageInstanceInvalidException } from "../exceptions/page-instance-invalid.exception.ts";
import { PageUrlInvalidException } from "../exceptions/page-url-invalid.exception.ts";
import { BrowserLimits } from "../models/browser-limits.ts";
import { Resources } from "../resources.ts";
import type { JsonValue } from "../types/json-value.ts";
import { TypedAddressRequests } from "./typed-address-requests.ts";
import { WindowRequests } from "./window-requests.ts";

export class PageRequests {
  public static readRecord(params: JsonValue): PageRecord {
    const record: PageRecord = WindowRequests.read(() => PageRecord.fromJson(params));
    PageRequests.checkRecord(record.instance, record.profileKey, record.url);
    return record;
  }

  public static readRedirect(params: JsonValue): TypedRedirectRequest {
    const redirect: TypedRedirectRequest = WindowRequests.read(() => TypedRedirectRequest.fromJson(params));
    PageRequests.checkRecord(redirect.instance, redirect.profileKey, redirect.url);
    return redirect;
  }

  public static readTypedAddress(params: JsonValue): TypedAddressRequest {
    const request: TypedAddressRequest = TypedAddressRequests.read(params);
    if (request.instance !== null)
      PageRequests.checkInstance(request.instance);
    return request;
  }

  public static readPage(params: JsonValue): PageRequest {
    const request: PageRequest = WindowRequests.read(() => PageRequest.fromJson(params));
    PageRequests.checkInstance(request.instance);
    return request;
  }

  public static readOpenPages(params: JsonValue): OpenPagesRequest {
    const request: OpenPagesRequest = WindowRequests.read(() => OpenPagesRequest.fromJson(params));
    for (const instance of request.instances)
      PageRequests.checkInstance(instance);
    return request;
  }

  public static readStop(params: JsonValue): PageStopRequest {
    const request: PageStopRequest = WindowRequests.read(() => PageStopRequest.fromJson(params));
    PageRequests.checkInstance(request.instance);
    return request;
  }

  public static readBrowsingData(params: JsonValue): BrowsingDataRequest {
    const request: BrowsingDataRequest = WindowRequests.read(() => BrowsingDataRequest.fromJson(params));
    TypedAddressRequests.checkProfileKey(request.profileKey);
    return request;
  }

  private static checkRecord(instance: string, profileKey: string, url: string): void {
    PageRequests.checkInstance(instance);
    TypedAddressRequests.checkProfileKey(profileKey);
    if (url.length > BrowserLimits.maximumUrlLength)
      throw new PageUrlInvalidException();
  }

  private static checkInstance(instance: string): void {
    if (!Resources.instancePattern.test(instance))
      throw new PageInstanceInvalidException();
  }
}
