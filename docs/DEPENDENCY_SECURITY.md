# Dependency security review — 2026-10-14

Targeted compatible lockfile updates: shell-quote 1.10.0 → 1.12.0; source-map-js 1.2.1 → 1.2.2; infrastructure aws-cdk-lib 2.272.0 → 2.273.0 (bundled brace-expansion 5.0.9 → 5.0.12). No Expo SDK or Jest major change was forced. Fresh npm installs, app lint/typecheck/format, 381 Jest assertions, web export, infrastructure typecheck, seven tests and CDK synth passed.

`npm audit` after the changes: app 0 critical, 53 high and 17 moderate package entries; infrastructure 0 advisories. The high app entries propagate from two underlying advisories rather than representing 53 independent defects:

- [braces stack exhaustion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), affects <=3.0.3. Published latest is 3.0.3 and the advisory lists no patch. Used through micromatch in Jest/Metro build tooling. Do not run builds/tests against untrusted source/patterns or expose Metro to untrusted networks; use trusted build inputs and monitor upstream.
- [node-forge signature verification](https://github.com/advisories/GHSA-86w9-cpqp-85rv), affects <=1.4.0. Published latest is 1.4.0 and no patch is listed. Expo's code-signing tooling depends on it. Do not treat passing CI as resolution: review release/OTA signing exposure and obtain an upstream fix before production signing/release. Do not substitute custom cryptography or downgrade Expo to an unrelated SDK because npm suggests it.

Remaining moderate advisories are decode-uri-component, sprintf-js and uuid plus their dependent package entries. Re-audit before launch. These findings remain open; no advisory is suppressed.

All nine Edge Function lockfiles passed `deno audit --lock <absolute path>` with Deno 2.9.7. This audits known dependency advisories, not application authorization logic. Re-run after any import/lockfile change.
