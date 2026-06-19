# R3 Wave 1 — staff chrome + dual-thread + task detail/timer

## AA (worst-case)
Samples: **37** · failing: **0**

| surface | text | fg | worst bg | ratio | need | ok |
|---|---|---|---|---|---|---|
| staff/messages-client/light | team | rgb(111, 108, 102) | rgb(243,238,229) | 4.53:1 | 4.5 | ✅ |
| staff/messages-internal/light | team | rgb(111, 108, 102) | rgb(243,238,229) | 4.53:1 | 4.5 | ✅ |
| staff/messages-client/light | Clients | rgb(180, 83, 9) | rgb(247,243,237) | 4.54:1 | 4.5 | ✅ |
| staff/messages-internal/light | Clients | rgb(180, 83, 9) | rgb(247,243,237) | 4.54:1 | 4.5 | ✅ |
| staff/messages-client/light | CT | rgb(180, 83, 9) | rgb(247,244,238) | 4.57:1 | 4.5 | ✅ |
| staff/messages-internal/light | CT | rgb(180, 83, 9) | rgb(247,244,238) | 4.57:1 | 4.5 | ✅ |
| staff/messages-client/light | 1 | rgb(255, 255, 255) | rgb(209,52,56) | 4.93:1 | 4.5 | ✅ |
| staff/messages-internal/light | 1 | rgb(255, 255, 255) | rgb(209,52,56) | 4.93:1 | 4.5 | ✅ |
| staff/messages-client/light | RP | rgb(255, 255, 255) | rgb(180,83,9) | 5.02:1 | 4.5 | ✅ |
| staff/messages-client/light | PC | rgb(255, 255, 255) | rgb(180,83,9) | 5.02:1 | 4.5 | ✅ |
| staff/messages-client/light | Client since March 2 | rgb(111, 108, 102) | rgb(252,250,246) | 5.02:1 | 4.5 | ✅ |
| staff/messages-client/light | Send | rgb(255, 255, 255) | rgb(180,83,9) | 5.02:1 | 4.5 | ✅ |
| staff/messages-internal/light | RP | rgb(255, 255, 255) | rgb(180,83,9) | 5.02:1 | 4.5 | ✅ |
| staff/messages-internal/light | PC | rgb(255, 255, 255) | rgb(180,83,9) | 5.02:1 | 4.5 | ✅ |
| staff/messages-internal/light | Client since March 2 | rgb(111, 108, 102) | rgb(252,250,246) | 5.02:1 | 4.5 | ✅ |
| staff/messages-internal/light | Post internal | rgb(255, 255, 255) | rgb(180,83,9) | 5.02:1 | 4.5 | ✅ |

## Boundary / Timer / Role checks

| check | ok |
|---|---|
| dual-thread: Client + Internal tabs present (staff) | ✅ |
| dual-thread: client tab shows 'Shared with the client' | ✅ |
| dual-thread: internal tab shows the staff-only warning | ✅ |
| dual-thread: internal composer carries the 'Internal — the client cannot see this' indicator | ✅ |
| timer (staff): 'Time tracking' present in staff detail | ✅ |
| staff detail: status control (select) present | ✅ |
| staff detail: 'Visible to the client' control present | ✅ |
| timer: running shows BOTH Stop and Stop & complete | ✅ |
| timer: start → task in_progress — status=in_progress | ✅ |
| timer: plain Stop stays in_progress (does NOT auto-complete) — status=in_progress | ✅ |
| timer: after plain Stop the control returns to Start timer | ✅ |
| timer: Stop & complete → task done — status=done | ✅ |
| role: admin sidebar has Users + Audit | ✅ |
| BOUNDARY: client redirected away from the staff/internal messages route — landed /dashboard | ✅ |
| TIMER: absent on the client task detail (no 'time tracking'/'start timer') | ✅ |
| client task detail: no status <select> (status read-only) | ✅ |
