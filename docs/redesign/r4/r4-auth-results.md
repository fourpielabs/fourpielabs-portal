# R4 — auth card over the hero

## AA (card text, worst-case ring-sampled over the backdrop)
Samples **28** · failing **0**

| screen | text | fg | worst bg | ratio | need | ok |
|---|---|---|---|---|---|---|
| login | Your email and passwor | rgb(168, 168, 163) | rgb(40,32,21) | 6.73:1 | 4.5 | ✅ |
| reset-setpw | Choose a new password  | rgb(168, 168, 163) | rgb(40,31,20) | 6.78:1 | 4.5 | ✅ |
| welcome | Create your password t | rgb(168, 168, 163) | rgb(39,31,21) | 6.8:1 | 4.5 | ✅ |
| forgot-password | We'll email you a link | rgb(168, 168, 163) | rgb(38,31,21) | 6.82:1 | 4.5 | ✅ |
| forgot-password | team@fourpielabs.com | rgb(168, 168, 163) | rgb(28,24,20) | 7.39:1 | 4.5 | ✅ |
| login | team@fourpielabs.com | rgb(168, 168, 163) | rgb(28,23,19) | 7.44:1 | 4.5 | ✅ |
| welcome | team@fourpielabs.com | rgb(168, 168, 163) | rgb(28,23,19) | 7.44:1 | 4.5 | ✅ |
| reset-setpw | team@fourpielabs.com | rgb(168, 168, 163) | rgb(28,23,19) | 7.44:1 | 4.5 | ✅ |
| reset-setpw | At least 12 characters | rgb(179, 172, 160) | rgb(33,27,21) | 7.57:1 | 4.5 | ✅ |
| welcome | At least 12 characters | rgb(179, 172, 160) | rgb(32,27,21) | 7.59:1 | 4.5 | ✅ |
| login | Need help? team@fourpi | rgb(179, 172, 160) | rgb(28,23,19) | 7.89:1 | 4.5 | ✅ |
| forgot-password | Need help? team@fourpi | rgb(179, 172, 160) | rgb(28,23,19) | 7.89:1 | 4.5 | ✅ |
| welcome | Need help? team@fourpi | rgb(179, 172, 160) | rgb(28,23,19) | 7.89:1 | 4.5 | ✅ |
| reset-setpw | Need help? team@fourpi | rgb(179, 172, 160) | rgb(28,23,19) | 7.89:1 | 4.5 | ✅ |
| login | Forgot password? | rgb(251, 191, 36) | rgb(31,26,20) | 10.34:1 | 4.5 | ✅ |
| forgot-password | Back to sign in | rgb(251, 191, 36) | rgb(28,24,20) | 10.57:1 | 4.5 | ✅ |

## Checks

| check | ok |
|---|---|
| login: console clean (no hydration / 'window is not defined') | ✅ |
| login: card renders the sign-in form | ✅ |
| reset-request: 'Reset your password' copy | ✅ |
| welcome: 'Welcome to 4Pie Labs' + create-password form | ✅ |
| reset(set-pw): 'Reset your password' + new-password form | ✅ |
| static fallback on MOBILE (coarse pointer) — no canvas | ✅ |
| static composition present (hero SVG) | ✅ |
| static fallback on REDUCED-MOTION — no canvas | ✅ |
| static fallback on NO-WEBGL — no canvas | ✅ |
