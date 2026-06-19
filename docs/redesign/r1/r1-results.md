# Redesign R1 — shell verification

## WCAG AA over glass chrome (worst-case incl. ember bloom)

Samples: **14** · failing: **0**

| surface | text | fg | worst bg | ratio | need | ok |
|---|---|---|---|---|---|---|
| client-dark | Messages | rgb(179, 172, 160) | rgb(80,62,36) | 4.54:1 | 4.5:1 | ✅ |
| staff-light | Dashboard | rgb(180, 83, 9) | rgb(251,243,228) | 4.55:1 | 4.5:1 | ✅ |
| client-light | Dashboard | rgb(180, 83, 9) | rgb(251,250,247) | 4.81:1 | 4.5:1 | ✅ |
| staff-light | CT | rgb(180, 83, 9) | rgb(252,250,247) | 4.82:1 | 4.5:1 | ✅ |
| staff-light | 1 | rgb(255, 255, 255) | rgb(209,52,56) | 4.93:1 | 4.5:1 | ✅ |
| client-light | PP | rgb(255, 255, 255) | rgb(180,83,9) | 5.02:1 | 4.5:1 | ✅ |
| client-dark | PP | rgb(255, 255, 255) | rgb(180,83,9) | 5.02:1 | 4.5:1 | ✅ |
| staff-light | RP | rgb(255, 255, 255) | rgb(180,83,9) | 5.02:1 | 4.5:1 | ✅ |
| staff-light | team | rgb(111, 108, 102) | rgb(252,250,247) | 5.02:1 | 4.5:1 | ✅ |
| staff-light | Clients | rgb(87, 83, 78) | rgb(246,231,210) | 6.28:1 | 4.5:1 | ✅ |
| client-light | Messages | rgb(87, 83, 78) | rgb(247,234,217) | 6.44:1 | 4.5:1 | ✅ |
| client-dark | Dashboard | rgb(251, 191, 36) | rgb(49,44,41) | 8.26:1 | 4.5:1 | ✅ |
| staff-light | Jump to client | rgb(24, 24, 27) | rgb(251,243,228) | 16.07:1 | 4.5:1 | ✅ |
| staff-light | Riley Partner | rgb(24, 24, 27) | rgb(252,250,247) | 17.01:1 | 4.5:1 | ✅ |

## Nav routing + role visibility + keyboard

Checks: **16** · failing: **0**

| check | result | ok |
|---|---|---|
| program-tabs(client) | Dashboard,Messages,Program,Content,Performance,Deliverables,Tasks,Call | ✅ |
| /messages | /messages | ✅ |
| /program | /program | ✅ |
| /performance | /performance | ✅ |
| /deliverables | /deliverables | ✅ |
| /tasks | /tasks | ✅ |
| /calls-notes | /calls-notes | ✅ |
| /documents | /documents | ✅ |
| /dashboard | /dashboard | ✅ |
| /clients (client→redirect) | /dashboard | ✅ |
| /admin/users (client→redirect) | /dashboard | ✅ |
| keyboard:nav-focusable | {"focusable":true,"hasFocusStyle":false} | ✅ |
| /clients | /clients | ✅ |
| /dashboard | /dashboard | ✅ |
| admin-nav(Users+Audit) | Dashboard,Clients,Users,Admin,Audit log,Admin,AA,Avery Admin,Admin | ✅ |
| admin-no-switcher | false | ✅ |

## Console

errors/warnings: 1; hydration issues: 0
- [warning] The width(-1) and height(-1) of chart should be greater than 0,
       please check the style of container, or the props width(100%) and hei
