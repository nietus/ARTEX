# i18n Translation Pipeline

1. **Extract**: Run `extract3.py` to extract atomic CJK runs from `web/src`.
2. **Translate**: Run `retry2.py` to batch-translate strings via `agy gpt-oss-120b-medium` with `gemini-3.8-flash-low` fallback.
3. **Apply**: Run `apply3.py` for atomic, longest-first replacement of localized strings back into source files.
4. **Verify**: Verify changes with Biome formatting/linting, TypeScript compiler checks (`tsc`), and `next build`.
5. **Dictionary**: The original Chinese-to-English pipeline catalog lives in `scripts/i18n/locale-zh.json`; the frontend Chinese runtime copy lives in `web/src/lib/i18n/locale-zh.json`.

## Brazilian Portuguese frontend

The current UI source language is English. Brazilian Portuguese catalogs are
organized by UI area in `web/src/lib/i18n/locales/pt-BR/`. See
`web/src/lib/i18n/README.md` for the modular runtime, exclusions, formatting and
explicit dynamic-label templates.

From `web/`, use `npm run i18n:audit` to inventory remaining source strings, or
`npm run i18n:audit -- --json` for locations and all candidates. This inventory
does not measure completed screens; review technical names and dynamic text
separately. Run `npm run test:i18n` and `npx tsc --noEmit` after changes.
