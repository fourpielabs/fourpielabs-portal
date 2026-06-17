# Phase 2 — Before / After (component finish)

`__BEFORE` = phase-1 baseline, `__AFTER` = post-phase-2 (desktop @1440). `__NEW` = a new
capability (no before equivalent — the old control was a native browser input). Full
after-set in [../phase-2-after/](../phase-2-after/); focused captures in
[../phase-2-after/focus/](../phase-2-after/focus/).

| File | What changed |
|---|---|
| `client-program__dashboard` | KPI band numerals **40 → 48px** + warm delta badges. Band stays a hero (enhanced, not flattened). |
| `admin__clients_P` | Staff overview "Latest metrics" numerals **19 → 30px** Bricolage; still fits the 3-card row. |
| `client-program__performance` | "Month by month" delta arrows now use the warm delta tokens. |
| `admin__clients_P_metrics` | Editor **restructured**: segmented "Enter data / Client preview", CSV in the header, tab now **wide (1440)** — vs the old one-page stack. |
| `metrics-preview__NEW` | The new read-only "Client preview" mode (capped to the client's standard width). |
| `report-dialog__NEW` | A report dialog showing the new `DateRangePicker` ("Reporting period") + `FileDropzone` (PDF). |
| `date-picker__NEW` | The shadcn Calendar/Popover open in a dialog (amber "today" ring, token-matched). |

All other routes are unchanged from phase 1 (verified by the adversarial review).
