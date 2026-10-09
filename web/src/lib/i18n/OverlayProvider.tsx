"use client";

import type * as React from "react";
import { useEffect } from "react";

import { translateTextNode } from "./dict";
import { useLocale } from "./store";

const MAX_NODES_PER_PASS = 1000;
const EXCLUDED_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE"]);

type IdleDeadline = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

function scheduleIdle(callback: (deadline?: IdleDeadline) => void): number {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    return window.requestIdleCallback(callback);
  }
  return setTimeout(callback, 1) as unknown as number;
}

function cancelIdle(id: number): void {
  if (typeof window !== "undefined" && "cancelIdleCallback" in window) {
    window.cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
}

function isExcludedNode(node: Node): boolean {
  const parent = node.parentElement;
  if (!parent) {
    return true;
  }
  if (EXCLUDED_TAGS.has(parent.tagName)) {
    return true;
  }
  if (parent.closest("script, style, code, pre, [data-no-i18n]")) {
    return true;
  }
  return false;
}

function createTextWalker(root: Node): TreeWalker {
  return document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (isExcludedNode(node)) {
        return NodeFilter.FILTER_REJECT;
      }
      const val = node.nodeValue;
      if (!val?.trim()) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
}

function translateContent(text: string): string {
  // 1. Exact full-node match first (or trimmed match)
  const translated = translateTextNode(text);
  if (translated !== text) {
    return translated;
  }

  // 2. Regex split on sentence boundaries only if trivial
  if (text.includes(". ") || text.includes("? ") || text.includes("! ") || text.includes("; ")) {
    const parts = text.split(/(?<=[.!?])\s+/);
    if (parts.length > 1) {
      let changed = false;
      const translatedParts = parts.map((part) => {
        const partTranslated = translateTextNode(part);
        if (partTranslated !== part) {
          changed = true;
          return partTranslated;
        }

        const trimmed = part.trim();
        const match = trimmed.match(/^([\s\S]+?)([.!?；。！？,;:])$/);
        if (match) {
          const core = match[1];
          const punct = match[2];
          const coreTranslated = translateTextNode(core);
          if (coreTranslated !== core) {
            changed = true;
            const start = part.indexOf(trimmed);
            return `${part.slice(0, start)}${coreTranslated}${punct}${part.slice(start + trimmed.length)}`;
          }
        }

        return part;
      });

      if (changed) {
        return translatedParts.join(" ");
      }
    }
  }

  return text;
}

type OverlayProviderProps = {
  children: React.ReactNode;
};

export function OverlayProvider({ children }: OverlayProviderProps) {
  const locale = useLocale((s) => s.locale);
  const hydrated = useLocale((s) => s.hydrated);

  useEffect(() => {
    void useLocale.getState().hydrate();
  }, []);

  useEffect(() => {
    if (!hydrated || locale === "en" || typeof document === "undefined") {
      return;
    }

    let activeWalker: TreeWalker | null = null;
    let idleId: number | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let observer: MutationObserver | null = null;

    const runPass = () => {
      if (typeof document === "undefined" || !document.body) {
        return;
      }

      if (!activeWalker) {
        activeWalker = createTextWalker(document.body);
      }

      // Temporarily disconnect observer while swapping text nodes to prevent recursion
      if (observer) {
        observer.disconnect();
      }

      let processed = 0;
      let node = activeWalker.nextNode() as Text | null;

      while (node && processed < MAX_NODES_PER_PASS) {
        const original = node.nodeValue;
        if (original) {
          const translated = translateContent(original);
          if (translated !== original) {
            node.nodeValue = translated;
          }
        }
        processed++;
        node = activeWalker.nextNode() as Text | null;
      }

      if (observer) {
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      }

      if (node) {
        idleId = scheduleIdle(() => {
          idleId = null;
          runPass();
        });
      } else {
        activeWalker = null;
      }
    };

    const scheduleDebouncedPass = () => {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        if (idleId !== null) {
          cancelIdle(idleId);
          idleId = null;
        }
        activeWalker = null;
        runPass();
      }, 150);
    };

    observer = new MutationObserver(() => {
      scheduleDebouncedPass();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    runPass();

    return () => {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
      }
      if (idleId !== null) {
        cancelIdle(idleId);
      }
      if (observer) {
        observer.disconnect();
      }
    };
  }, [locale, hydrated]);

  return <>{children}</>;
}

export default OverlayProvider;
