/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

// The function the snapshot runs in the page changes' isolated world of the main frame; `webViews.json` pins it word for word.
// - Given a request for a snapshot, it walks the page's flat tree once, as its accessibility tree shows it, and returns, by value, only the
//   page's title and its lines: each line's depth, role, name, the value of a field that isn't secret, whether the value is masked, and the
//   index of the element a reference names, with whether the lines were cut at the most bytes, left out below the most depth or start
//   where the page is scrolled to. A secret field's value never leaves the page, nor anything under it. It stops once its lines pass the
//   most bytes. It keeps the elements it gave an index in the world's own global, which the page's script can't see, in place of those of
//   the snapshot before.
//   The runtime part gives it, after the request, the hosts of closed shadow roots, which the page's script can't open; it gives each
//   host its own line, with the host's number in the list, and walks nothing under it, for the runtime part to read from the
//   accessibility tree.
// - Given an element's index, it returns that element, while it is still in the page, for the runtime part to read its node; nothing else.
// Roles follow WAI-ARIA 1.2's explicit roles, with the presentational role's conflict rules, and HTML-AAM's implicit ones, named as
// Chromium's own accessibility tree names them; names follow AccName 1.2, with the text of an element's ::before and ::after.
export class PageSnapshotScript {
  public static readonly functionDeclaration: string = String.raw`function (request, ...marked) {
  const key = "noldovaBrowserSnapshot";
  if (request === null || typeof request !== "object")
    return null;
  if (typeof request.element === "number") {
    const kept = globalThis[key];
    const element = Array.isArray(kept) ? kept[request.element] : undefined;
    return element instanceof Element && element.isConnected ? element : null;
  }
  const actionableRoles = new Set(request.actionableRoles);
  const typedRoles = new Set(request.typedRoles);
  const liftedRoles = new Set(request.liftedRoles);
  const secretTokens = new Set(request.secretAutocomplete);
  const cardPrefix = String(request.cardAutocompletePrefix);
  const maskedValue = String(request.maskedValue);
  const isInteractive = request.interactive === true;
  const mostDepth = typeof request.depth === "number" ? request.depth : Number.POSITIVE_INFINITY;
  const mostBytes = Number(request.maximumBytes);
  const referenceBytes = Number(request.referenceBytes);
  const hosts = new Map(marked.map((t, i) => [t, i]));
  const ariaRoles = new Set(["alert", "alertdialog", "application", "article", "banner", "blockquote", "button", "caption", "cell", "checkbox",
    "code", "columnheader", "combobox", "complementary", "contentinfo", "definition", "deletion", "dialog", "document", "emphasis", "feed",
    "figure", "form", "generic", "grid", "gridcell", "group", "heading", "img", "insertion", "link", "list", "listbox", "listitem", "log",
    "main", "mark", "marquee", "math", "menu", "menubar", "menuitem", "menuitemcheckbox", "menuitemradio", "meter", "navigation", "none", "note",
    "option", "paragraph", "presentation", "progressbar", "radio", "radiogroup", "region", "row", "rowgroup", "rowheader", "scrollbar", "search",
    "searchbox", "separator", "slider", "spinbutton", "status", "strong", "subscript", "superscript", "switch", "tab", "table", "tablist",
    "tabpanel", "term", "textbox", "time", "timer", "toolbar", "tooltip", "tree", "treegrid", "treeitem"]);
  const contentNamedRoles = new Set(["button", "cell", "checkbox", "columnheader", "DisclosureTriangle", "gridcell", "heading", "LabelText",
    "link", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "radio", "row", "rowheader", "StaticText", "switch", "tab", "term",
    "tooltip", "treeitem"]);
  const rangeRoles = new Set(["meter", "progressbar", "scrollbar", "slider", "spinbutton"]);
  const unwalked = new Set(["base", "datalist", "head", "link", "meta", "noscript", "param", "script", "style", "template", "title"]);
  const sectioning = "article, aside, main, nav, section";
  const focusable = "a[href], area[href], button, iframe, input:not([type=hidden]), select, summary, textarea, [tabindex], [contenteditable]:not([contenteditable=false])";
  const globalAttributes = ["aria-atomic", "aria-busy", "aria-controls", "aria-current", "aria-describedby", "aria-details", "aria-dropeffect",
    "aria-flowto", "aria-grabbed", "aria-hidden", "aria-keyshortcuts", "aria-label", "aria-labelledby", "aria-live", "aria-owns", "aria-relevant",
    "aria-roledescription"];
  const collapse = text => text.replace(/[ \t\n\r\f]+/g, " ").trim();
  const utf8Bytes = text => {
    let count = 0;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      count += code < 0x80 ? 1 : code < 0x800 ? 2 : code >= 0xd800 && code < 0xdc00 ? 4 : code >= 0xdc00 && code < 0xe000 ? 0 : 3;
    }
    return count;
  };
  const styleOf = element => getComputedStyle(element);
  const isPresentationalAllowed = element => !element.matches(focusable) && !globalAttributes.some(t => element.hasAttribute(t));
  const isNamed = element => element.hasAttribute("aria-label") || element.hasAttribute("aria-labelledby") || element.hasAttribute("title");
  const inputRole = element => {
    const type = (element.getAttribute("type") ?? "text").toLowerCase();
    const hasList = element.hasAttribute("list");
    switch (type) {
      case "button": case "image": case "reset": case "submit": case "file": return "button";
      case "checkbox": return "checkbox";
      case "radio": return "radio";
      case "range": return "slider";
      case "number": return "spinbutton";
      case "search": return hasList ? "combobox" : "searchbox";
      case "color": return "ColorWell";
      case "date": return "Date";
      case "datetime-local": return "DateTime";
      case "month": case "week": return "DateTime";
      case "time": return "InputTime";
      default: return hasList ? "combobox" : "textbox";
    }
  };
  const cellRole = element => {
    const table = element.closest("table");
    return table !== null && table.getAttribute("role") === "grid" ? "gridcell" : "cell";
  };
  const headerRole = element => {
    const scope = (element.getAttribute("scope") ?? "").toLowerCase();
    if (scope === "row" || scope === "rowgroup")
      return "rowheader";
    if (scope === "col" || scope === "colgroup")
      return "columnheader";
    const row = element.parentElement;
    const isOnlyHeaders = row !== null && [...row.children].every(t => t.localName === "th");
    return isOnlyHeaders ? "columnheader" : "rowheader";
  };
  const implicitRole = element => {
    if (element.namespaceURI === "http://www.w3.org/2000/svg")
      return element.localName === "svg" ? "image" : "none";
    switch (element.localName) {
      case "a": case "area": return element.hasAttribute("href") ? "link" : "generic";
      case "article": return "article";
      case "aside": return "complementary";
      case "blockquote": return "blockquote";
      case "br": return "LineBreak";
      case "button": return "button";
      case "caption": return "caption";
      case "code": return "code";
      case "dd": return "definition";
      case "del": case "s": return "deletion";
      case "details": return "group";
      case "dfn": case "dt": return "term";
      case "dialog": return "dialog";
      case "dl": case "menu": case "ol": case "ul": return "list";
      case "em": return "emphasis";
      case "fieldset": case "optgroup": return "group";
      case "figure": return "figure";
      case "footer": return element.parentElement?.closest(sectioning) ? "generic" : "contentinfo";
      case "form": return "form";
      case "h1": case "h2": case "h3": case "h4": case "h5": case "h6": return "heading";
      case "header": return element.parentElement?.closest(sectioning) ? "generic" : "banner";
      case "hr": return "separator";
      case "iframe": return "Iframe";
      case "img": return element.getAttribute("alt") === "" && isPresentationalAllowed(element) ? "none" : "image";
      case "input": return inputRole(element);
      case "ins": return "insertion";
      case "label": return "LabelText";
      case "li": return "listitem";
      case "main": return "main";
      case "mark": return "mark";
      case "math": return "math";
      case "meter": return "meter";
      case "nav": return "navigation";
      case "option": return "option";
      case "output": return "status";
      case "p": return "paragraph";
      case "progress": return "progressbar";
      case "search": return "search";
      case "section": return isNamed(element) ? "region" : "generic";
      case "select": return element.multiple || element.size > 1 ? "listbox" : "combobox";
      case "strong": return "strong";
      case "sub": return "subscript";
      case "summary": return "DisclosureTriangle";
      case "sup": return "superscript";
      case "table": return "table";
      case "tbody": case "tfoot": case "thead": return "rowgroup";
      case "td": return cellRole(element);
      case "textarea": return "textbox";
      case "th": return headerRole(element);
      case "time": return "time";
      case "tr": return "row";
      default: return element.isContentEditable && !element.parentElement?.isContentEditable ? "textbox" : "generic";
    }
  };
  const roleOf = element => {
    const explicit = (element.getAttribute("role") ?? "").trim().toLowerCase().split(/[ \t\n\r\f]+/).find(t => ariaRoles.has(t));
    if (explicit === undefined)
      return implicitRole(element);
    if (explicit === "none" || explicit === "presentation")
      return isPresentationalAllowed(element) ? "none" : implicitRole(element);
    return explicit === "img" ? "image" : explicit;
  };
  const childrenOf = node => {
    if (node instanceof Element && node.shadowRoot !== null)
      return [...node.shadowRoot.childNodes];
    if (node instanceof HTMLSlotElement) {
      const assigned = node.assignedNodes({ flatten: true });
      return assigned.length > 0 ? assigned : [...node.childNodes];
    }
    return [...node.childNodes];
  };
  const pseudoText = (element, which) => {
    const content = getComputedStyle(element, which).content;
    const texts = content.match(/"(?:[^"\\]|\\.)*"/g) ?? [];
    return texts.map(t => t.slice(1, -1).replace(/\\(.)/g, "$1")).join("");
  };
  const isHidden = element => {
    if (element.closest("[aria-hidden=true]") !== null)
      return true;
    const style = styleOf(element);
    if (style.display === "contents")
      return false;
    return !element.checkVisibility({ visibilityProperty: true });
  };
  const isSecret = element => {
    if (element.localName === "input" && (element.getAttribute("type") ?? "").toLowerCase() === "password")
      return true;
    return (element.getAttribute("autocomplete") ?? "").toLowerCase().split(/[ \t\n\r\f]+/).some(t => secretTokens.has(t) || t.startsWith(cardPrefix));
  };
  const selectedText = element => {
    const option = element instanceof HTMLSelectElement ? element.selectedOptions[0] : element.querySelector("[aria-selected=true]");
    return option === undefined || option === null ? "" : collapse(option.label ?? option.textContent ?? "");
  };
  const valueOf = (element, role) => {
    if (rangeRoles.has(role))
      return element.getAttribute("aria-valuetext") ?? element.getAttribute("aria-valuenow") ?? ("value" in element && element.value !== undefined ? String(element.value) : "");
    if (element instanceof HTMLSelectElement)
      return role === "combobox" ? selectedText(element) : "";
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)
      return typedRoles.has(role) ? element.value : "";
    if (typedRoles.has(role) && element.isContentEditable)
      return collapse(element.innerText);
    return "";
  };
  const isBlock = node => node instanceof Element && !["inline", "contents"].includes(styleOf(node).display);
  const byId = (element, id) => {
    const root = element.getRootNode();
    return typeof root.getElementById === "function" ? root.getElementById(id) : document.getElementById(id);
  };
  const compute = (node, state) => {
    if (node.nodeType === Node.TEXT_NODE)
      return node.data;
    if (!(node instanceof Element) || state.visited.has(node))
      return "";
    state.visited.add(node);
    const role = roleOf(node);
    if (!state.isLabelledBy && isHidden(node))
      return "";
    if (!state.isLabelledBy && !state.isTraversal) {
      const ids = (node.getAttribute("aria-labelledby") ?? "").trim();
      if (ids !== "") {
        const text = ids.split(/[ \t\n\r\f]+/).map(t => byId(node, t)).filter(t => t !== null)
          .map(t => compute(t, { isTraversal: true, isLabelledBy: true, isReferenced: true, visited: state.visited })).join(" ");
        if (collapse(text) !== "")
          return text;
      }
    }
    if (state.isTraversal && state.isReferenced !== true && (typedRoles.has(role) || role === "listbox" || rangeRoles.has(role)))
      return role === "combobox" || role === "listbox" ? selectedText(node) : valueOf(node, role);
    const label = collapse(node.getAttribute("aria-label") ?? "");
    if (label !== "")
      return label;
    if (role !== "none") {
      const native = nativeName(node, role, state);
      if (native !== "")
        return native;
    }
    if (state.isTraversal || contentNamedRoles.has(role)) {
      const parts = [pseudoText(node, "::before")];
      for (const child of childrenOf(node)) {
        const text = compute(child, { isTraversal: true, isLabelledBy: state.isLabelledBy, visited: state.visited });
        parts.push(isBlock(child) ? " " + text + " " : text);
      }
      parts.push(pseudoText(node, "::after"));
      const text = parts.join("");
      if (collapse(text) !== "")
        return text;
    }
    return node.getAttribute("title") ?? "";
  };
  const nativeName = (element, role, state) => {
    const local = element.localName;
    const type = (element.getAttribute("type") ?? "").toLowerCase();
    if (local === "input" && ["button", "submit", "reset"].includes(type))
      return element.getAttribute("value") ?? (type === "submit" ? "Submit" : type === "reset" ? "Reset" : "");
    if (local === "input" && type === "image")
      return element.getAttribute("alt") ?? element.getAttribute("value") ?? "Submit";
    if (element.labels !== undefined && element.labels !== null && element.labels.length > 0) {
      const text = [...element.labels].map(t => compute(t, { isTraversal: true, isLabelledBy: state.isLabelledBy, visited: state.visited })).join(" ");
      if (collapse(text) !== "")
        return text;
    }
    if (local === "img" || local === "area")
      return element.getAttribute("alt") ?? "";
    const first = selector => [...element.children].find(t => t.matches(selector));
    const captioned = local === "fieldset" ? first("legend") : local === "table" ? first("caption") : local === "figure" ? first("figcaption") : undefined;
    if (captioned !== undefined)
      return compute(captioned, { isTraversal: true, isLabelledBy: state.isLabelledBy, visited: state.visited });
    if (local === "svg")
      return first("title")?.textContent ?? "";
    if (local === "optgroup")
      return element.getAttribute("label") ?? "";
    if (local === "option" && element.hasAttribute("label"))
      return element.getAttribute("label") ?? "";
    if ((local === "input" || local === "textarea") && element.getAttribute("title") === null)
      return element.getAttribute("placeholder") ?? "";
    return "";
  };
  const nameOf = (element, role) => {
    if (liftedRoles.has(role) || role === "none")
      return collapse(element.getAttribute("aria-label") ?? "");
    return collapse(compute(element, { isTraversal: false, isLabelledBy: false, visited: new Set() }));
  };
  const hasContent = node => childrenOf(node).some(t => t instanceof Element || t.nodeType === Node.TEXT_NODE && collapse(t.data) !== "");
  const elements = [];
  const lines = [];
  let bytes = 0;
  let isCut = false;
  let isDeeper = false;
  let startPath = null;
  let startElement = null;
  let isStarted = true;
  const add = (depth, role, name, value, isMasked, element, host = -1) => {
    let text = "  ".repeat(depth) + "- " + role;
    if (name !== "")
      text += " " + JSON.stringify(name);
    if (isMasked || value !== "")
      text += " value=" + JSON.stringify(isMasked ? maskedValue : value);
    const lineBytes = utf8Bytes(text) + 1 + (element === null ? 0 : referenceBytes);
    if (bytes + lineBytes > mostBytes) {
      isCut = true;
      return false;
    }
    bytes += lineBytes;
    let index = -1;
    if (element !== null) {
      index = elements.length;
      elements.push(element);
    }
    lines.push([depth, role, name, isMasked ? "" : value, isMasked, index, host]);
    return true;
  };
  const walk = (node, depth, isVisible) => {
    if (isCut)
      return;
    if (node.nodeType === Node.TEXT_NODE) {
      const text = collapse(node.data);
      if (text !== "" && isVisible && isStarted && !isInteractive)
        add(depth, "StaticText", text, "", false, null);
      return;
    }
    if (!(node instanceof Element) || unwalked.has(node.localName))
      return;
    if (!isStarted && !startPath.has(node))
      return;
    if (node === startElement)
      isStarted = true;
    if (node.getAttribute("aria-hidden") === "true" || node instanceof HTMLInputElement && node.type === "hidden")
      return;
    const style = styleOf(node);
    if (style.display === "none")
      return;
    const isShownHere = style.visibility === "visible";
    const role = roleOf(node);
    const name = isShownHere ? nameOf(node, role) : "";
    const host = hosts.get(node);
    if (host !== undefined) {
      if (isStarted)
        add(depth, role, name, "", false, node, host);
      return;
    }
    const isLifted = liftedRoles.has(role) && name === "";
    const isListed = isShownHere && !isLifted && (!isInteractive || actionableRoles.has(role) || role === "heading");
    const isSecretField = isSecret(node);
    let childDepth = depth;
    if (isListed) {
      const isBoundary = depth + 1 >= mostDepth && hasContent(node) && !isSecretField;
      const value = valueOf(node, role);
      const isReferenced = actionableRoles.has(role) || isBoundary;
      if (!add(depth, role, name, isSecretField ? "" : value, isSecretField && value !== "", isReferenced ? node : null))
        return;
      if (isBoundary) {
        isDeeper = true;
        return;
      }
      childDepth = depth + 1;
    }
    if (isSecretField || role === "Iframe" || node.namespaceURI === "http://www.w3.org/2000/svg" || node instanceof HTMLSelectElement && role === "combobox")
      return;
    const before = isShownHere && !isInteractive && isStarted ? pseudoText(node, "::before") : "";
    if (before.trim() !== "")
      add(childDepth, "StaticText", collapse(before), "", false, null);
    for (const child of childrenOf(node))
      walk(child, childDepth, style.visibility === "visible");
    const after = isShownHere && !isInteractive && isStarted ? pseudoText(node, "::after") : "";
    if (after.trim() !== "")
      add(childDepth, "StaticText", collapse(after), "", false, null);
  };
  const kept = globalThis[key];
  let root = document.documentElement;
  if (typeof request.part === "number") {
    const part = Array.isArray(kept) ? kept[request.part] : undefined;
    if (!(part instanceof Element) || !part.isConnected)
      return { stale: true };
    root = part;
  }
  const title = collapse(document.title);
  const read = () => {
    if (root === document.documentElement) {
      if (add(0, "RootWebArea", title, "", false, null))
        walk(root, 1, true);
    }
    else
      walk(root, 0, true);
  };
  read();
  let isFromView = false;
  if (isCut && root === document.documentElement && window.scrollY > 0) {
    const start = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 4);
    if (start !== null && start !== document.documentElement && start !== document.body) {
      const path = new Set();
      for (let node = start; node !== null; node = node.assignedSlot ?? node.parentNode ?? (node instanceof ShadowRoot ? node.host : null))
        path.add(node);
      startPath = path;
      startElement = start;
      isStarted = false;
      elements.length = 0;
      lines.length = 0;
      bytes = 0;
      isCut = false;
      isDeeper = false;
      isFromView = true;
      read();
    }
  }
  globalThis[key] = elements;
  return { title, lines, isCut, isDeeper, isFromView };
}`;
}
