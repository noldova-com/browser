/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PageChangeScript {
  public static readonly worldName: string = "noldova-browser-changes";
  public static readonly bindingName: string = "noldovaBrowserChanged";
  public static readonly functionDeclaration: string = `function (isOn) {
  const key = "noldovaBrowserChanges";
  const report = globalThis.noldovaBrowserChanged;
  if (typeof isOn !== "boolean" || typeof report !== "function")
    return false;
  let state = globalThis[key];
  if (state === undefined) {
    state = { isPending: false, stop: null };
    globalThis[key] = state;
  }
  if (!isOn && state.stop !== null) {
    state.stop();
    state.stop = null;
  }
  if (!isOn || state.stop !== null)
    return true;
  const changed = () => {
    if (state.isPending)
      return;
    state.isPending = true;
    requestAnimationFrame(() => {
      state.isPending = false;
      if (state.stop !== null)
        report("");
    });
  };
  const options = { capture: true, passive: true };
  const targets = [[document, ["scroll", "load", "transitionend", "animationend"]], [window, ["resize"]], [visualViewport, ["resize", "scroll"]],
    [document.fonts, ["loadingdone"]]];
  for (const [target, names] of targets)
    for (const name of names)
      target.addEventListener(name, changed, options);
  const observer = new MutationObserver(changed);
  observer.observe(document, { childList: true, subtree: true, attributes: true, characterData: true });
  state.stop = () => {
    observer.disconnect();
    for (const [target, names] of targets)
      for (const name of names)
        target.removeEventListener(name, changed, options);
  };
  return true;
}`;
}
