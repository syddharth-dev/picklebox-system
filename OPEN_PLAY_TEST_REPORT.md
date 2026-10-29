# Open Play test and repair report

Date: October 29, 2026 (Asia/Manila)

The Open Play player, admin, database, QR and court-availability paths were audited and repaired locally. Backend fixes are in `supabase/migrations/20261029120000_open_play_reliability.sql`. This migration has **not** been applied to the hosted Supabase project.

## Findings and implemented fixes

| Severity | Finding | Implemented fix |
| --- | --- | --- |
| High | Open Play and normal court bookings could reserve the same court/time; overlapping Open Play sessions were also accepted. | Database triggers reject overlaps in both directions, with one transaction lock shared by schedule writes. Adjacent times remain valid. |
| High | Open Play did not appear in normal booking availability. | The availability RPC includes every intersecting Open Play hour. The grid labels these hours, disables selection, refreshes on changes, and removes selections that become reserved. |
| High | Manual admin check-in accepted unpaid or waitlisted players and omitted `checked_in_at`. | The RPC validates state/payment and sets an idempotent attendance timestamp. The UI disables check-in until payment is verified. Direct client table writes can no longer bypass the RPC. |
| High | Cancelling a session left already-issued QR passes usable. | Token retrieval, lookup and check-in now check session status. Cached tokens are hidden while revalidating or after authorization fails. |
| High | Session, roster and QR caches did not include the signed-in account. | Query keys now include the user ID, preventing reuse of another account's cached registration details or token. |
| High | The configured cancellation cutoff was never enforced; checked-in players could cancel themselves. | Server and UI enforce the cutoff in Philippine time and restrict player cancellation to registered/waitlisted entries. Admin overrides remain available through guarded RPCs. |
| High | Registration compared venue-local date/time with the database's timezone, allowing registration after the Philippine start time. The dashboard used the UTC date. | Explicit Asia/Manila conversions on the server and fixed venue-time calculations in the frontend. |
| Medium | Cancelling a waitlisted entry left gaps in queue positions. Admin no-show/cancellation updates did not promote eligible waitlisted players. | Registration/cancellation/admin transitions lock the session first and rebalance the queue. Promotion occurs only while the session is scheduled and has not started. |
| Medium | Negative fees/cutoffs, empty or invalid court assignments, and excessive payment-reference lengths were accepted. Form validation was incomplete. | Database checks/triggers and form/hook validation enforce valid inputs. The create form offers active courts and exposes its existing cutoff setting. |
| Medium | Open dialogs retained stale session objects after capacity/status changes. Payment references carried into other sessions. | Dialog state stores a session ID and reads the current query result. Changing/closing the dialog clears the reference. |
| Medium | Failed queries appeared as empty schedules/rosters, and session-cancellation errors escaped the admin click handler. | Explicit error/retry states and handled mutation errors with readable messages. |
| Medium | Payment/check-in/registration changes left attendance and dashboard queries stale. RLS hides other players' registration events, so realtime alone could not reliably update counts. | Shared cache invalidation covers relevant lists, attendance, QR and availability. Fifteen-second polling supplements realtime updates. |
| Low | Player cards could not be opened with the keyboard; form controls and booking-grid cells had incomplete labels. | Keyboard activation, focus styles and accessible control names were added. The participant-only roster is labelled “Your registration”. The existing venue GCash QR asset is shown beside payment-reference entry. |

## Reproduction and verification

The original repository had two tests, both passing. The first regression batch reproduced **19 failed database assertions out of 33 cases** and **six failed player-screen cases**. These are failure scenarios, not 25 separate root causes.

After the repairs, the complete suite passes **98 tests across nine files**:

| Coverage | Cases |
| --- | ---: |
| Actual Open Play SQL, registration, waitlist, permissions, scheduling and QR RPCs | 46 |
| Player screen: registration, cancellation, live state, errors and keyboard access | 11 |
| Admin screen: creation, validation, payment/check-in and failure handling | 8 |
| Query/mutation hooks, account isolation and cache invalidation | 7 |
| Venue dates/times, input validation and error messages | 19 |
| QR rendering during authorization/refetch failures | 3 |
| Open Play reservations in the regular court grid | 2 |
| Existing repository tests | 2 |

Commands used:

```sh
npm test -- --reporter=dot
npm run build
node_modules/.bin/tsc --noEmit -p tsconfig.app.json
```

TypeScript and the production build pass. Targeted lint passes for the Open Play implementation and regression files. Repository-wide lint still reports **48 existing errors and eight warnings**, reduced from the initial **65 errors and eight warnings**. Remaining violations are in shared/other feature code, including existing `any` annotations in dashboard, attendance and court-page code. Existing Vite/Tailwind and bundle-size warnings also remain.

Tests use the existing Vitest/Testing Library setup plus the development-only PGlite dependency. SQL tests execute the actual Open Play, QR and court-availability migrations, the roster section of the earlier security migration, and the new reliability migration. Surrounding Supabase auth roles/claims and non-Open-Play tables are fixtures. A test-only random-byte function substitutes for pgcrypto; production QR generation was not changed.

## Deployment and remaining verification

1. Review the read-only queries in `supabase/diagnostics/open_play_preflight.sql` against the hosted database. Existing overlapping sessions, invalid values and historical unpaid/missing-timestamp check-ins require venue review; no historical registrations or payment records were changed by this work.
2. Apply the new migration after the prior migrations, including `20260917120000_security_hardening.sql`, using the project's normal Supabase migration process. The new fee/cutoff constraints use `NOT VALID` to preserve existing rows while checking future writes. Validate them after any historical invalid values are resolved.
3. Deploy the frontend and run a staging smoke test with separate player/admin accounts: create a session, fill it, join the waitlist, cancel before cutoff, verify payment, check in, cancel the session and confirm the old QR is rejected. Also attempt an overlapping ordinary booking.

No hosted database mutations, live registrations, real GCash transactions, refunds or camera scans were performed. Only public frontend Supabase configuration is available locally; there is no authenticated database/admin deployment connection. React tests use jsdom and mocked API responses; they are not a browser-to-hosted-Supabase end-to-end test. PGlite has one database connection, so genuine concurrent-client load/locking tests and hosted realtime delivery remain staging checks. The shared lock order was reviewed in code but was not proven under a multi-connection load test.

Cancelling a paid registration/session preserves payment records. Actual refunds and manual GCash verification remain venue operations; the repair does not initiate financial transactions.

PGlite testing API reference: [official PGlite documentation](https://pglite.dev/docs/).
