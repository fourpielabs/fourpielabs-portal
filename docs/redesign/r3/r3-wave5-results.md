# R3 Wave 5 — Admin (Clients · New client · Users · Audit · Client settings)

## AA
Samples **189** · failing **0**

| surface | text | fg | worst bg | ratio | need | ok |
|---|---|---|---|---|---|---|
| admin/clients-list/light | admin | rgb(111, 108, 102) | rgb(243,238,229) | 4.53:1 | 4.5 | ✅ |
| admin/new-client/light | admin | rgb(111, 108, 102) | rgb(243,238,229) | 4.53:1 | 4.5 | ✅ |
| admin/users/light | admin | rgb(111, 108, 102) | rgb(243,238,229) | 4.53:1 | 4.5 | ✅ |
| admin/audit/light | admin | rgb(111, 108, 102) | rgb(243,238,229) | 4.53:1 | 4.5 | ✅ |
| admin/client-settings/light | admin | rgb(111, 108, 102) | rgb(243,238,229) | 4.53:1 | 4.5 | ✅ |
| admin/audit/light | Audit logAdmin | rgb(180, 83, 9) | rgb(247,243,237) | 4.54:1 | 4.5 | ✅ |
| admin/clients-list/light | Clients | rgb(180, 83, 9) | rgb(247,244,237) | 4.57:1 | 4.5 | ✅ |
| admin/new-client/light | Clients | rgb(180, 83, 9) | rgb(247,244,237) | 4.57:1 | 4.5 | ✅ |
| admin/users/light | UsersAdmin | rgb(180, 83, 9) | rgb(247,244,237) | 4.57:1 | 4.5 | ✅ |
| admin/client-settings/light | Clients | rgb(180, 83, 9) | rgb(247,244,237) | 4.57:1 | 4.5 | ✅ |
| admin/clients-list/light | Admin | rgb(129, 116, 0) | rgb(255,254,245) | 4.68:1 | 4.5 | ✅ |
| admin/new-client/light | Admin | rgb(129, 116, 0) | rgb(255,254,245) | 4.68:1 | 4.5 | ✅ |
| admin/users/light | Admin | rgb(129, 116, 0) | rgb(255,254,245) | 4.68:1 | 4.5 | ✅ |
| admin/audit/light | Admin | rgb(129, 116, 0) | rgb(255,254,245) | 4.68:1 | 4.5 | ✅ |
| admin/client-settings/light | Admin | rgb(129, 116, 0) | rgb(255,254,245) | 4.68:1 | 4.5 | ✅ |
| admin/users/light | Delete | rgb(220, 38, 38) | rgb(255,255,255) | 4.83:1 | 4.5 | ✅ |
| admin/clients-list/light | 4 | rgb(255, 255, 255) | rgb(209,52,56) | 4.93:1 | 4.5 | ✅ |
| admin/new-client/light | 4 | rgb(255, 255, 255) | rgb(209,52,56) | 4.93:1 | 4.5 | ✅ |
| admin/users/light | 4 | rgb(255, 255, 255) | rgb(209,52,56) | 4.93:1 | 4.5 | ✅ |
| admin/audit/light | 4 | rgb(255, 255, 255) | rgb(209,52,56) | 4.93:1 | 4.5 | ✅ |

## Checks (render + GUARDS)

| check | ok |
|---|---|
| clients-list: renders converted content | ✅ |
| new-client: renders converted content | ✅ |
| users: renders converted content | ✅ |
| audit: renders converted content | ✅ |
| client-settings: renders converted content | ✅ |
| guard: admin sees the Users table with a 'You' self-marker | ✅ |
| conditional create form: program shows the tier, project HIDES it — program=true project=false | ✅ |
| guard: TEAM blocked from /admin/users — landed /dashboard | ✅ |
| guard: TEAM blocked from /admin/audit — landed /dashboard | ✅ |
| guard: CLIENT blocked from /clients — landed /dashboard | ✅ |
| guard: CLIENT blocked from /admin/users — landed /dashboard | ✅ |
