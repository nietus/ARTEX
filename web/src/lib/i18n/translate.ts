export type Dictionary = Readonly<Record<string, string>>;

// Keep this module independent of React, the locale store and the DOM.
export function createTranslator(dictionary: Dictionary = {}) {
  const lookup = (text: string): string | undefined => (Object.hasOwn(dictionary, text) ? dictionary[text] : undefined);
  const templates = Object.entries(dictionary)
    .filter(([source]) => /\{(?:id|count)\}/u.test(source))
    .map(([source, target]) => {
      const names: string[] = [];
      const pattern = source
        .split(/(\{(?:id|count)\})/u)
        .map((part) => {
          if (part === "{id}" || part === "{count}") {
            names.push(part);
            return part === "{count}" ? "([\\d.,]+)" : "([\\w.-]+)";
          }
          return part.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
        })
        .join("");
      return { regex: new RegExp(`^${pattern}$`, "u"), target, names };
    });

  function translateLiteral(text: string): string {
    const exact = lookup(text);
    if (exact !== undefined) return exact;
    const trimmed = text.trim();
    if (!trimmed) return text;
    let translated = lookup(trimmed) ?? lookup(trimmed.replace(/\s+/g, " "));
    if (translated === undefined) {
      for (const template of templates) {
        const match = template.regex.exec(trimmed);
        if (!match) continue;
        translated = template.target;
        template.names.forEach((name, index) => {
          translated = translated?.replace(name, match[index + 1]);
        });
        break;
      }
    }
    // JSX often renders labels with a trailing colon or ellipsis as one node.
    if (translated === undefined) {
      const match = trimmed.match(/^(.+?)([:.!?…]+)$/u);
      if (match) {
        const core = lookup(match[1]);
        if (core !== undefined) translated = core + match[2];
      }
    }
    if (translated === undefined) return text;
    const start = text.indexOf(trimmed);
    return text.slice(0, start) + translated + text.slice(start + trimmed.length);
  }

  return function translate(text: string): string {
    const literal = translateLiteral(text);
    if (literal !== text) return literal;
    // Preserve separators when several known sentences share a single text node.
    return text
      .split(/(?<=[.!?])([\s]+)/u)
      .map(translateLiteral)
      .join("");
  };
}
