# Player feature audit

Audit date: October 31, 2026 (Asia/Manila).

Live follow-up: browser access later succeeded after the user restored Chrome. See `LIVE_BROWSER_AUDIT.md` for the actual screens/interactions checked, additional fixes and remaining limits. The original local audit results below remain a separate evidence set.

This audit covers the local player-facing application and its supporting booking/chat functions. Admin screens, management workflows and administrative operations were excluded. Existing admin-screen changes in the working tree predate this audit. Shared authentication, query hooks and database fixtures necessarily support some administrative callers too.

## Findings and corrections

Severity describes the effect on a player; this is not a penetration-test certification. “Fixed locally” requires publishing the updated application. Database and edge-function changes have separate deployment requirements below.

| ID | Severity | Finding and trigger | Correction / evidence |
| --- | --- | --- | --- |
| P01 | High | An account switch could expose cached individual-booking or confirmation data because their query keys omitted the account ID. | Both private queries now include the account ID. Hook tests switch accounts while the next request is pending and verify the previous data is absent. |
| P02 | High | PickleBot retained private conversation text after changing accounts; an old request could append a response to the next account's chat. | Conversation and draft reset per account; request versions suppress stale replies and state updates. A delayed-response regression reproduces the original leak. |
| P03 | High | The booking RPC did not enforce the displayed 60-day window or 7AM–11PM hours, and allowed elapsed hours today. Midnight ranges could produce an unrelated slot-conflict error. | New database trigger validates player booking dates/hours/start times in Asia/Manila. The previous SQL fails four new boundary checks; the migration passes them. **Requires database deployment.** |
| P04 | High | A failed availability request could make unknown court hours appear available; a failed court request could leave a permanent skeleton. Past hours were selectable, and calendar bounds followed the browser's timezone despite Philippine-time copy. | Recovery/retry UI replaces false availability; selection is blocked until availability loads. Calendar days use venue time, elapsed slots are disabled, and expired selections are removed as time advances. Court tests cover query failure and past slots. |
| P05 | Medium | Checkout required customer name/email/phone but discarded those fields. Notifications actually used the signed-in account email. | Checkout preloads profile details, explains that edits are saved, validates/saves name and phone before booking, and shows the actual account email as read-only. A failed profile save prevents reservation creation. |
| P06 | Medium | Malformed checkout navigation state could crash date/slot rendering. Browser-supplied totals were displayed directly, and an empty successful RPC result navigated to confirmation. | Runtime validation rejects malformed, duplicate, elapsed and unsupported selections, checks the 12-range RPC limit, and recalculates totals. Empty results now show a recovery error. Tests cover invalid state and server outcomes. |
| P07 | Medium | A court rate or active state could change after slot selection while checkout still presented the previous payment amount. | Checkout checks active courts/current rates before exposing payment instructions and refetches rates immediately before submission. Changed/unverified court details block submission and provide a route back to Courts. Server-owned charges remain authoritative. Tests simulate both changes. |
| P08 | Medium | A failed initial session promise could leave protected pages loading forever. A delayed old session lookup could overwrite a newer sign-in. Thrown sign-in/signup failures could leave the button loading. | Session initialization ignores stale results, handles failure and cleans up its listener. Auth handlers use error handling/finally; sign-out failures receive feedback. Session race/offline and sign-in failure regressions pass. |
| P09 | Medium | Profile refreshes overwrote unsaved edits. Query errors showed an editable form. Blank names and malformed phone numbers could be saved. | Account-scoped drafts survive background refreshes; load failures offer retry. Shared validation trims names and checks phone format. Successful saves update the correct account's profile cache. Tests reproduce the three original failures. |
| P10 | Medium | Confirmation claimed every reservation was Pending even when already paid/cancelled. Load failures redirected to Courts, encouraging another submission. | Rows reflect real statuses; pending-only instructions are conditional. Failed confirmation loads offer retry and My bookings with a duplicate-submission warning. Navigation IDs receive shape checks. Nested link/button controls were removed. |
| P11 | Medium | Elapsed paid/pending reservations stayed under Upcoming, and payment approval could remain invisible while My bookings stayed open. | History uses the reservation's venue-local end time as well as terminal status. My bookings and confirmation poll every 15 seconds. A regression checks elapsed paid reservations. Open Play time-dependent controls also refresh while idle. |
| P12 | Medium | PickleBot's system prompt supplied an unverified email/phone, described a nonexistent proof-upload flow and claimed a 30-minute expiry. Malformed message objects could cause 500 errors, and preflight omitted platform headers. | Prompt matches the reference-number/manual-verification flow and directs users to Help. Request bodies/roles/content are validated, outbound history is bounded, and long assistant messages are safely limited for subsequent requests. Browser SDK headers are permitted. Actual handler code is exercised with isolated dependencies. **Requires edge-function deployment.** |
| P13 | Medium | Notification preparation called pending bookings “Confirmed,” used obsolete expiry copy and accepted cancellation messages for active bookings. The response did not explicitly identify email as unsent. | Prepared content describes submission/payment verification, mismatched status requests return 409, and responses report `emailSent: false`. **Actual email delivery is still unimplemented; see below.** |

The original failing UI tests reproduced six cases across profile, confirmation and chat before their fixes. Independent database tests against the old booking behavior reproduced four failing boundary cases. Other regressions exercise the corrected code and relevant error paths.

## Coverage and methods

| Feature | Audit coverage |
| --- | --- |
| Home and navigation | Existing date handoff, navigation/account controls and return-path tests; source review of feature-card links, Help/FAQ routes and the legacy per-court redirect. |
| Authentication | Session startup/offline/race/unsubscribe tests; valid/external sign-in return paths; thrown login failures; source inspection of signup/password checks and sign-out feedback. Real account creation and verification email delivery were not performed. |
| Court discovery | Loading/error/empty states, venue date and past-time rules, keyboard selection, live reservation removal, Open Play blocking and selection/checkout state. Realtime delivery itself was not connected to a hosted backend. |
| Checkout | Contact prefill/save/failure, account email, price changes, current-session ownership, grouped atomic submission, missing/malformed state, blank/duplicate/elapsed selections, total recomputation, no-created-ID results and button recovery. GCash QR interaction remains a display/control path; no money was sent. |
| Reservation database | Actual atomic booking and cancellation SQL loaded into PGlite with a fixture schema. Tests cover server-derived amounts, pending payments, conflict rollback, cancellation ownership/release, authentication, opening hours and the booking window. |
| My bookings and confirmation | Status rendering, failure recovery, elapsed history, cache isolation and QR dialog persistence through refresh. |
| Open Play | Existing registration/waitlist/promotion/cancellation-cutoff/payment/QR/privacy/conflict regressions rerun. Privileged fixture setup is used to create sessions and check player outcomes; admin screens were excluded. |
| QR passes | Existing paid/pending, authorization, stale-fetch and unavailable-token regressions rerun. No physical camera scan or live admission performed. |
| Profile | Failed loads, retry, validation and draft preservation; account-specific query/cache behavior reviewed. |
| Chat and notifications | Actual Deno handler source transpiled into an isolated test harness with mocked auth/database/fetch. Authentication, origin restriction, message validation, preflight, truthful prompt/response and status mismatch covered. No external API request or email was sent. |
| Help, theme and motion | Existing theme/reveal/path-resize/reduced-motion tests rerun; Help and photo/CTA destination source review. Visual appearance and animation rendering remain unverified. |

## Verification

- Final non-admin suite: **174 tests across 24 files pass** using `npm.cmd test -- --reporter=dot --exclude src/pages/admin/**`.
- TypeScript: `tsc --noEmit -p tsconfig.app.json` passes.
- Production bundle: `npm.cmd run build` succeeds, with the existing large-chunk warning.
- ESLint on changed functional source, supporting edge functions and added tests: zero errors; one existing Fast Refresh export warning in `useAuth.tsx`.
- Whole-repository ESLint remains failing: **36 errors and 8 warnings**. Thirty-one errors are in excluded admin pages/hooks. Five pre-existing errors remain in shared UI scaffolding (`command.tsx`, `textarea.tsx`), generated preview auth storage, the unreachable legacy `BookCourt.tsx`, and Tailwind's CommonJS plugin import. The JSON inventory is `.design/player-audit-lint.json`. These are not newly introduced runtime failures.
- `git diff --check` passes. Existing CRLF-conversion notices are Git configuration notices, not whitespace failures.

## Open issues and deployment work

1. **Email delivery is absent.** `send-booking-notification` builds content/logs preparation but never calls an email provider. A successful booking or `success: true` response is not proof of delivered email. Adding an API secret alone will not implement delivery. A provider integration, sender configuration and delivery test remain necessary if emailed confirmations are a product requirement.
2. **Database guard is local only.** Apply `supabase/migrations/20261031120000_player_booking_time_guards.sql` after the existing migration sequence. Until then, hosted RPC callers can bypass the new client time checks. No migration or production data was changed remotely during this audit.
3. **Deploy both updated edge functions.** Their correctness changes require deployment. Verify the exact application origins in `ALLOWED_ORIGINS`, and verify authentication, quota and AI gateway configuration in the intended environment. Runtime secrets and hosted configuration were not inspected or modified.
4. **Bundle/load cost remains.** The built main JS chunk is approximately 2.25 MB (660 KB gzip), and the supplied chatbot JPEG is about 1.64 MB. Route splitting and image optimization remain performance work; no measured load-time or Core Web Vitals claim is made.
5. **Global lint debt remains**, as itemized above. `npm run lint` is not green despite the functional audit's changed-file lint passing.

## Practical limits

At the time of the original local audit, computer-use inspection had stopped because Windows browser URL verification could not enforce policy. No alternative browser automation path was used. The later authorized browser follow-up is documented separately in `LIVE_BROWSER_AUDIT.md`; physical touch/camera tests, full visual comparisons and accessibility conformance remain outside the original local evidence.

Component tests use jsdom and controlled API doubles. Database tests execute real application SQL against PGlite with surrounding fixture tables; they do not prove a full Supabase deployment, hosted RLS configuration, replication/publication delivery, multi-connection race behavior or load capacity. Edge tests isolate external services and are not Deno deployment tests. The short interval between a checkout rate refresh and transaction commit remains subject to a price change; final amounts are server-derived and payments are manually verified.

No live bookings, registrations, account creations, GCash transactions, outgoing messages or production mutations were performed. These local checks provide regression evidence; a staging walkthrough and the deployment checks above remain required before declaring the live player experience fully verified.
