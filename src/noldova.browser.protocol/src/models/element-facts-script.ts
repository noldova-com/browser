/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ElementFactsScript {
  public static readonly functionDeclaration: string = `function () {
  const read = node => [node.nodeName, node.nodeType === 1 ? node.getAttributeNames().flatMap(name => [name, node.getAttribute(name) ?? ""]) : []];
  const isForm = node => node.nodeType === 1 && node.nodeName.toUpperCase() === "FORM";
  const collapse = text => text.replace(/\\s+/g, " ").trim();
  const all = (root, isPierced) => {
    const found = [];
    const pending = [root];
    while (pending.length > 0) {
      const node = pending.pop();
      found.push(node);
      const children = [...node.childNodes];
      if (isPierced && node.nodeType === 1 && node.shadowRoot !== null)
        children.unshift(node.shadowRoot);
      for (let index = children.length - 1; index >= 0; index--)
        pending.push(children[index]);
    }
    return found;
  };
  const path = [];
  for (let node = this; node !== null; node = node instanceof ShadowRoot ? node.host : node.parentNode)
    path.unshift(node);
  if (path[0] !== document)
    return { path: null, form: [], formName: "", title: "", baseUrl: document.baseURI };

  const everything = all(document, true);
  const named = this.nodeType === 1 ? this.getAttribute("form") : null;
  const form = named === null ? path.slice(0, -1).findLast(isForm) : everything.find(t => isForm(t) && t.getAttribute("id") === named);
  const id = form === undefined ? null : form.getAttribute("id");
  const members = form === undefined ? [] : [...all(form, true), ...(id === null ? [] : everything.filter(t => t.nodeType === 1 && t.getAttribute("form") === id))];
  const labels = form === undefined ? "" : (form.getAttribute("aria-labelledby") ?? "").split(/\\s+/).filter(t => t !== "")
    .map(label => everything.find(t => t.nodeType === 1 && t.getAttribute("id") === label))
    .map(t => t === undefined ? "" : t.textContent)
    .join(" ");
  const names = form === undefined ? [] : [labels, form.getAttribute("aria-label") ?? "", form.getAttribute("title") ?? ""].map(collapse);
  const title = all(document, false).find(t => t.nodeName === "TITLE");
  return {
    path: path.map(read),
    form: members.filter(t => t.nodeType === 1).map(read),
    formName: names.find(t => t !== "") ?? "",
    title: title === undefined ? "" : collapse(title.textContent),
    baseUrl: document.baseURI
  };
}`;
}
