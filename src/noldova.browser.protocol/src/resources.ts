/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Resources {
  public static readonly ipv4Pattern: RegExp = /^\d{1,3}(?:\.\d{1,3}){3}$/u;
  public static readonly ipv4PartSeparator: string = ".";
  public static readonly ipv4PartMaximum: number = 255;
  public static readonly ipv4LoopbackNetwork: number = 127;
  public static readonly ipv4PrivateRanges: readonly (readonly [number, number, number])[] = [[10, 0, 255], [172, 16, 31], [192, 168, 168], [100, 64, 127]];
  public static readonly ipv4LinkLocalRange: readonly [number, number, number] = [169, 254, 254];
  public static readonly ipv6Opening: string = "[";
  public static readonly ipv6ZeroRun: string = "::";
  public static readonly ipv6PieceSeparator: string = ":";
  public static readonly loopbackName: string = "localhost";
  public static readonly loopbackSuffix: string = ".localhost";
  public static readonly trailingDotsPattern: RegExp = /\.+$/u;
  public static readonly ipv4Bits: bigint = 32n;
  public static readonly ipv4Mask: bigint = 0xffff_ffffn;
  public static readonly mappedPrefix: bigint = 0xffffn;
  public static readonly nat64Prefix: bigint = 0x0064_ff9b_0000_0000_0000_0000n;
  public static readonly uniqueLocalPrefix: bigint = 0xfc00n >> 9n;
  public static readonly uniqueLocalShift: bigint = 121n;
  public static readonly linkLocalPrefix: bigint = 0xfe80n >> 6n;
  public static readonly linkLocalShift: bigint = 118n;
  public static readonly localSitesSeparator: string = ",";
  public static readonly webSchemes: readonly string[] = ["http:", "https:"];
  public static readonly wildcardPattern: RegExp = /[*%]/u;
  public static readonly emptyLabelPattern: RegExp = /^\.|\.\./u;
  public static readonly actionField: string = "action";
  public static readonly activityField: string = "activity";
  public static readonly agentNameField: string = "agentName";
  public static readonly agentsField: string = "agents";
  public static readonly boxField: string = "box";
  public static readonly heightField: string = "height";
  public static readonly instanceField: string = "instance";
  public static readonly instancesField: string = "instances";
  public static readonly isClaimedField: string = "isClaimed";
  public static readonly isHandedOverField: string = "isHandedOver";
  public static readonly isHereField: string = "isHere";
  public static readonly isTakingOverField: string = "isTakingOver";
  public static readonly kindField: string = "kind";
  public static readonly originField: string = "origin";
  public static readonly pointField: string = "point";
  public static readonly profileKeyField: string = "profileKey";
  public static readonly reasonField: string = "reason";
  public static readonly recordField: string = "record";
  public static readonly refusalField: string = "refusal";
  public static readonly refusedField: string = "refused";
  public static readonly stateField: string = "state";
  public static readonly urlField: string = "url";
  public static readonly widthField: string = "width";
  public static readonly xField: string = "x";
  public static readonly yField: string = "y";
  public static readonly fieldPathSeparator: string = ".";
  public static readonly unknownField: string = "The field isn't part of the message.";
  public static readonly coordinateNotFinite: string = "The coordinate isn't a finite number.";
  public static readonly sizeNegative: string = "The size isn't a finite number of zero or more.";
  public static readonly refusalUrlNotWeb: string = "The address isn't an http or https address.";
  public static readonly refusalOriginDiffers: string = "The origin isn't the address's origin.";

  public static formatFieldPath(parent: string, name: string): string {
    return `${parent}${Resources.fieldPathSeparator}${name}`;
  }

  public static formatHexPiece(piece: string): string {
    return `0x${piece}`;
  }

  public static formatOriginRoot(origin: string): string {
    return `${origin}/`;
  }
}
