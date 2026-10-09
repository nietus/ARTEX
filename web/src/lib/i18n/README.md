# Frontend localization

English remains the source language. `locales.ts` defines selectable languages,
labels, badges and BCP 47 formatting tags; the persisted store validates its values.

The runtime is divided into independent modules:

- `translate.ts`: pure dictionary matching, whitespace/punctuation handling and
  explicit `{id}` / `{count}` templates. Unknown text falls back to English.
- `dict.ts`: catalog loading and per-language translators. Chinese retains its
  original `{Chinese: English}` format for compatibility.
- `dom-overlay.ts`: batched translation of text and `placeholder`, `title`,
  `aria-label`, and `alt`. It observes new content and attribute updates, records
  original values, and restores them on cleanup without overwriting newer values.
- `OverlayProvider.tsx`: hydration, document language and overlay lifecycle.
- `format.ts`: current-language date/number formatting; use
  `getFormattingLocale()` with native formatting methods. Long-lived date
  formatters should use `createDateFormatter()` to resolve the language lazily.

## Adding Brazilian Portuguese strings

Add exact English source strings to the appropriate JSON catalog in
`locales/pt-BR/`. Keep common actions in `common.json`, and UI-specific strings in
the area catalogs. Add a new catalog to `index.ts` when introducing an area.
Do not duplicate keys between catalogs. Preserve placeholders, IDs, technical
names and the meaning of the source text.

For a dynamic tooltip, explicitly register a template such as
`"Rename Task #{id}": "Renomear tarefa #{id}"`. Templates support identifiers and
numeric counts; arbitrary content is not interpolated automatically. For complex
dynamic labels, translate the static fragments explicitly with
`translateTextNode()`.

## Content boundaries

Code, preformatted output, editable content, textarea values and elements under
`data-no-i18n` are excluded. Input values, resource URLs and identifiers are never
changed. Markdown output and user conversation messages use `data-no-i18n` so
selecting a UI language does not rewrite their content.

The language picker persists the language and reloads once, preserving the
existing React/DOM translation model. Locale-dependent children remount after
hydration so dates are formatted using the saved language. The overlay is a
compatibility bridge; newly built complex UI can use explicit translation calls.

## Verification and remaining coverage

From `web/`:

```sh
npm run test:i18n
npm run i18n:audit
npm run i18n:audit -- --json
npx tsc --noEmit
```

The audit inventories literal JSX text, presentation attributes and label
properties from the current source. Its counts are **not** percentages of
completed screens: candidates include technical names, dynamic composition needs
manual review, and backend-generated content is outside the UI catalog. The
Portuguese catalog is substantially expanded but is not a complete translation
of every help paragraph or dynamic message. The audit lists remaining candidates
and their source locations for subsequent work.
