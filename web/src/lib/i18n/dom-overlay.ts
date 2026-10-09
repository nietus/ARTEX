const ATTRIBUTES = ["placeholder", "title", "aria-label", "alt"] as const;
const EXCLUDED = "script, style, code, pre, [contenteditable]:not([contenteditable='false']), [data-no-i18n]";

type Translate = (text: string) => string;
type SavedValue = { source: string; translated: string };

// The DOM bridge is isolated from dictionaries and React. Only presentation
// attributes are translated; input values, URLs and identifiers are untouched.
export function startDomOverlay(root: HTMLElement, translate: Translate, batchSize = 1000): () => void {
  const textSources = new Map<Text, SavedValue>();
  const attributeSources = new Map<Element, Map<string, SavedValue>>();
  const view = root.ownerDocument.defaultView;
  if (!view)
    return () => {
      // A detached document has no observer or browser lifecycle to clean up.
    };

  let walker: TreeWalker | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  function excluded(element: Element | null) {
    return !element || Boolean(element.closest(EXCLUDED));
  }

  function updateText(node: Text) {
    if (excluded(node.parentElement) || node.parentElement?.closest("textarea")) return;
    const current = node.data;
    const saved = textSources.get(node);
    // React may have written a new source string since the last pass.
    const source = saved?.translated === current ? saved.source : current;
    const translated = translate(source);
    if (translated !== current) node.data = translated;
    if (translated !== source) textSources.set(node, { source, translated });
    else textSources.delete(node);
  }

  function updateAttributes(element: Element) {
    if (excluded(element)) return;
    for (const attribute of ATTRIBUTES) {
      const current = element.getAttribute(attribute);
      if (current === null) {
        attributeSources.get(element)?.delete(attribute);
        continue;
      }
      const saved = attributeSources.get(element)?.get(attribute);
      const source = saved?.translated === current ? saved.source : current;
      const translated = translate(source);
      if (translated !== current) element.setAttribute(attribute, translated);
      if (translated !== source) {
        let values = attributeSources.get(element);
        if (!values) {
          values = new Map();
          attributeSources.set(element, values);
        }
        values.set(attribute, { source, translated });
      } else {
        attributeSources.get(element)?.delete(attribute);
      }
    }
  }

  const observe = () =>
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRIBUTES, "data-no-i18n", "contenteditable"],
    });

  function restoreExcluded() {
    for (const [node, saved] of textSources) {
      if (!root.contains(node)) textSources.delete(node);
      else if (excluded(node.parentElement)) {
        if (node.data === saved.translated) node.data = saved.source;
        textSources.delete(node);
      }
    }
    for (const [element, values] of attributeSources) {
      if (!root.contains(element)) attributeSources.delete(element);
      else if (excluded(element)) {
        for (const [attribute, saved] of values) {
          if (element.getAttribute(attribute) === saved.translated) element.setAttribute(attribute, saved.source);
        }
        attributeSources.delete(element);
      }
    }
  }

  function runPass() {
    timer = undefined;
    if (stopped) return;
    observer.disconnect();
    if (!walker) {
      restoreExcluded();
      updateAttributes(root);
      walker = root.ownerDocument.createTreeWalker(root, 1 | 4);
    }
    let count = 0;
    let finished = false;
    while (count < batchSize) {
      const node = walker.nextNode();
      if (!node) {
        finished = true;
        break;
      }
      if (node.nodeType === 3) updateText(node as Text);
      else updateAttributes(node as Element);
      count++;
    }
    observe();
    if (finished) walker = undefined;
    else timer = setTimeout(runPass, 0);
  }

  const observer = new view.MutationObserver(() => {
    if (timer !== undefined) clearTimeout(timer);
    walker = undefined;
    timer = setTimeout(runPass, 50);
  });

  runPass();
  return () => {
    stopped = true;
    observer.disconnect();
    if (timer !== undefined) clearTimeout(timer);
    // Restore only values still owned by the overlay, preserving newer React updates.
    for (const [node, saved] of textSources) {
      if (node.data === saved.translated) node.data = saved.source;
    }
    for (const [element, values] of attributeSources) {
      for (const [attribute, saved] of values) {
        if (element.getAttribute(attribute) === saved.translated) element.setAttribute(attribute, saved.source);
      }
    }
    textSources.clear();
    attributeSources.clear();
  };
}
