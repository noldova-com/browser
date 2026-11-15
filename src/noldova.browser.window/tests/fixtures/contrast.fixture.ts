/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

type Rgba = readonly [red: number, green: number, blue: number, alpha: number];

export class ContrastFixture {
  private static readonly NUMBER: RegExp = /-?\d+(\.\d+)?(e-?\d+)?/gu;

  public static ofText(element: Element, property: string = "color"): number {
    const under = ContrastFixture.backgroundOf(element);
    return ContrastFixture.ratio(ContrastFixture.over(ContrastFixture.colorOf(element, property), under), under);
  }

  public static ofEdge(element: Element, property: string): number {
    const under = element.parentElement === null ? ContrastFixture.white() : ContrastFixture.backgroundOf(element.parentElement);
    return ContrastFixture.ratio(ContrastFixture.over(ContrastFixture.colorOf(element, property), under), under);
  }

  public static ofOutline(element: Element): number {
    return Number.parseFloat(getComputedStyle(element).outlineOffset) < 0 ? ContrastFixture.ofText(element, "outline-color") : ContrastFixture.ofEdge(element, "outline-color");
  }

  public static ofFills(front: Element, back: Element): number {
    return ContrastFixture.ratio(ContrastFixture.backgroundOf(front), ContrastFixture.backgroundOf(back));
  }

  public static backgroundOf(element: Element): Rgba {
    const chain: Element[] = [];
    for (let current: Element | null = element; current !== null; current = current.parentElement)
      chain.unshift(current);
    return chain.reduce((under, t) => ContrastFixture.over(ContrastFixture.parse(getComputedStyle(t).backgroundColor), under), ContrastFixture.white());
  }

  public static parse(color: string): Rgba {
    if (color === "transparent")
      return [0, 0, 0, 0];
    const isSrgb = color.startsWith("color(srgb ");
    if (!isSrgb && !color.startsWith("rgb(") && !color.startsWith("rgba("))
      throw new Error(`The color ${color} isn't in a form the fixture reads.`);
    const numbers = (color.match(ContrastFixture.NUMBER) ?? []).map(Number);
    const [red = 0, green = 0, blue = 0] = numbers.slice(0, 3).map(t => isSrgb ? t * 255 : t);
    return [red, green, blue, numbers[3] ?? 1];
  }

  public static over(front: Rgba, back: Rgba): Rgba {
    const alpha = front[3] + back[3] * (1 - front[3]);
    if (alpha === 0)
      return [0, 0, 0, 0];
    const mix = (top: number, bottom: number): number => (top * front[3] + bottom * back[3] * (1 - front[3])) / alpha;
    return [mix(front[0], back[0]), mix(front[1], back[1]), mix(front[2], back[2]), alpha];
  }

  public static ratio(first: Rgba, second: Rgba): number {
    const channel = (value: number): number => {
      const share = value / 255;
      return share <= 0.04045 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (color: Rgba): number => 0.2126 * channel(color[0]) + 0.7152 * channel(color[1]) + 0.0722 * channel(color[2]);
    const [one, other] = [luminance(first), luminance(second)];
    return (Math.max(one, other) + 0.05) / (Math.min(one, other) + 0.05);
  }

  private static colorOf(element: Element, property: string): Rgba {
    const value: string = getComputedStyle(element).getPropertyValue(property);
    if (value === "")
      throw new Error(`The element has no ${property}.`);
    return ContrastFixture.parse(value);
  }

  private static white(): Rgba {
    return [255, 255, 255, 1];
  }
}
