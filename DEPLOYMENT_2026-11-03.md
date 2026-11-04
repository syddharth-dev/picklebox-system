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

### November 4 follow-up: signed-out court availability

The public Courts page loaded all three active courts, but its availability RPC
returned HTTP 401 / `42501` (`permission denied for function get_reserved_slots`)
for signed-out visitors. This caused the page to show its availability error.

Applied `20261104090000_public_court_availability.sql` to production and recorded
that version as applied. It grants `anon` execution of the existing narrow,
read-only availability RPC. The hosted function's private-note masking was
verified before granting access. No table privileges or booking/payment records
were changed. The older pending `20261103193000_public_open_play_discovery.sql`
migration was not applied as part of this fix.

Afterward, anonymous requests returned HTTP 200 for the three active courts and
availability on November 4 and 5. All **235 tests across 29 files** passed,
including new actual-SQL-role regressions for guest availability, private-note
masking, Open Play occupied hours, and continued denial of private reads and
booking creation. Changed-test lint and `git diff --check` passed. This is a
backend-only fix; no frontend deployment is required. Physical mobile/browser
verification was unavailable because the browser access host was disconnected.

The subsequent guest-checkout handoff change is **local and still requires a
frontend deployment**. Courts now sends the selected date/courts/hours to Auth,
which validates and forwards them to checkout after login or a signup session.
Expired selections return to Courts. The 45 relevant navigation, auth, booking
validation and checkout tests pass, as do application TypeScript and the
production build. Auth/test lint passes; Courts retains the same three existing
`react-hooks/set-state-in-effect` findings as the committed baseline. Actual
email verification and physical mobile checkout have not been exercised.

The admin sidebar/search/pagination follow-up is also **local and requires a
frontend deployment**. It adds a white sidebar, booking search and status/court/
booking-date filters, and shared 10-item pagination across applicable admin
lists. Pagination and filtering operate on the existing loaded query results;
attendance exports and dashboard aggregates retain their full loaded inputs.
All **258 tests across 32 files** pass, along with application TypeScript,
production build and `git diff --check`. The changed-source lint comparison
introduces no findings; pre-existing lint findings remain. Browser visual QA
was unavailable because the browser access host was disconnected. No hosted
admin records, schema or payment states were changed.

### CLI reference

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
