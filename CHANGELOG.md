# Changelog

## 0.1.0 (2026-02-06)

Initial release.

### Features

- **Core engine**: incremental text buffer, debounced scheduler, plugin pipeline, typed event bus
- **Public API**: `createRecognizer()` with `feed()`, `commit()`, `on()`/`off()`, `state()`, `destroy()`
- **Entity model**: stable keys, span tracking, provisional/confirmed status, confidence scoring
- **Built-in plugins**:
  - `quantity` — numbers with units (km, mi, kg, g, lb, m, cm, mm, ft, etc.)
  - `datetime` — ISO dates, verbal dates, times, relative dates
  - `email` — email addresses
  - `url` — HTTP/HTTPS/FTP URLs
  - `phone` — phone numbers (US and international formats)
- **Performance guardrails**: windowed analysis, debounced realtime/commit passes, IME composition handling, diff-based stale entity removal
- **Custom plugins**: full plugin interface for extending with regex, local ML, or remote LLM backends
- **Dual format**: ships ESM and CJS with full TypeScript declarations
