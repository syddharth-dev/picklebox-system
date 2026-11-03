# Production backend deployment

Completed November 3, 2026 (Asia/Manila) for `https://thepicklebox.vercel.app`, using Supabase project `lkdmueujbxyeiqunpiso` (`BooknMngmntSys_PickleBox`). The production JavaScript bundle was checked and points to this project.

## Database

The four audited migrations were already present in the hosted schema, but not recorded in `supabase_migrations.schema_migrations`:

- `20260917120000_security_hardening.sql`
- `20261029120000_open_play_reliability.sql`
- `20261031120000_player_booking_time_guards.sql`
- `20261031150000_api_security_audit.sql`

Before recording them as applied, all 19 relevant function bodies were compared with the local SQL and matched exactly. Their definer settings, execution grants, RLS, eight validation constraints, five guards and restricted table/column privileges were also checked. The obsolete cleanup cron job is absent. The schema changes were not executed twice.

The 21 existing migration records matched local SQL exactly. Seventeen historical filenames used slightly different timestamps; their filenames and test references were aligned with the actual hosted versions. SQL file hashes were preserved. Existing hosted migration versions were not rewritten.

The four already-installed migrations were then registered with `migration repair --status applied`. A subsequent remote dry run reports `upToDate: true`, with no pending migrations, seeds or role changes. No booking/payment records were modified. The previously documented historical zero-duration booking remains unchanged.

## Edge Functions

| Function | Active version |
| --- | --- |
| `faq-chat` | 3 |
| `send-booking-notification` | 7 |
| `cleanup-expired-bookings` | 7 |

All deployments include `supabase/functions/_shared/http.ts`. The initial batch upload returned transport errors and did not replace the running code. Individual retries succeeded; endpoint behavior and final ACTIVE versions were verified afterward.

`ALLOWED_ORIGINS` is now `https://thepicklebox.vercel.app`. The existing `LOVABLE_API_KEY` secret was preserved; secret values were not read or changed.

The project publishes ES256 signing keys. The legacy gateway check remains disabled (`verify_jwt = false`), matching its prior production setting and [Supabase's asymmetric-key guidance](https://supabase.com/kb/troubleshooting/edge-function-401-error-response). Every deployed handler verifies bearer tokens with Supabase Auth `getUser()`. Cleanup additionally requires admin/service-role authorization. Missing and invalid tokens were rejected by the deployed code.

## Verification

- 71 database regressions passed after migration filename reconciliation.
- 27 function/header regressions passed, including the Vercel configuration and theme-bootstrap CSP hash.
- Application TypeScript, changed-test lint and `git diff --check` passed.
- All 14 live HTTP checks passed: allowed/disallowed CORS preflight, missing/invalid authentication, rejected methods, response security headers and cleanup browser-origin rejection.
- No real reservations, cancellations, cleanup operations, emails or AI completions were triggered. Authenticated positive workflows and real provider delivery are not certified by these negative endpoint checks.

Private schema snapshots and redacted comparison/check results are kept under ignored `.design/deployment-20261103/`. Supabase CLI temporary state is ignored. No account access token is stored in deployment scripts or documentation.

## Frontend action remaining

The deployed Vercel site did not serve the CSP, frame or nosniff headers from `public/_headers`. `vercel.json` now defines equivalent headers using [Vercel's supported configuration](https://vercel.com/docs/project-configuration/vercel-json#headers), plus the [Vite SPA fallback](https://vercel.com/docs/frameworks/frontend/vite#using-vite-to-make-spas).

Publish a new Vercel deployment containing this configuration, then verify the actual response headers, theme startup and deep links. Backend deployment does not publish this frontend file. No Vercel frontend deployment was performed here.

## Future CLI commands

This deployment used CLI **3.0.0**, whose remote-target flag is `--remote=<project-ref>` for these commands:

```powershell
npx.cmd --yes supabase@3.0.0 db push --remote=lkdmueujbxyeiqunpiso --dry-run --skip-vault
npx.cmd --yes supabase@3.0.0 functions list --remote=lkdmueujbxyeiqunpiso
```

For future function releases, deploy each reviewed function individually:

```powershell
npx.cmd --yes supabase@3.0.0 functions deploy faq-chat --remote=lkdmueujbxyeiqunpiso --use-api
```

The migration dry run is a read-only verification step; newly authored migrations require a separate reviewed apply operation. The older migration history still has the foundational-definition limitations described in `SECURITY_AUDIT.md`; a fresh full reset is not certified.
