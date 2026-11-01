# Live browser inspection

Date: October 31, 2026 (Asia/Manila). Environment: the running application at `http://localhost:8080`, Chrome on Windows, signed in to the account displayed as “Test User.” Admin screens are excluded. The initial desktop screenshots returned by Computer Use are 1536 × 816, including browser chrome.

The connection succeeded after the user restored the app in Chrome. All browser inspection uses the supported Computer Use APIs; no alternate browser automation or URL-verification bypass was used. Screenshots were viewed directly in the tool. Account emails, booking IDs and QR tokens are deliberately omitted from this report.

## Findings

| Finding | Result |
| --- | --- |
| Route navigation retained the previous page's scroll position. Clicking Courts from the lower homepage opened at the grid bottom/footer. | Fixed with a player-route scroll reset for new navigation. Browser history/anchors and excluded admin behavior are preserved. Three regressions pass. Subsequent player navigation and checkout review visibly open at the top. |
| Calendar remained open after picking a date, obstructing the booking page. | Fixed by closing its controlled popover on date selection. A regression selects November 1 and checks the new date and closed calendar. Live mobile reinspection confirmed that choosing November 1 closes the calendar and refreshes availability. |
| Chat launcher appeared above the payment-dialog backdrop. | Fixed by placing the launcher/panel below modal layers. Reinspection of the still-open payment modal showed the launcher correctly dimmed beneath the overlay. |
| A past paid booking's QR dialog said “Valid,” implying current admission validity. | Reworded to “Payment approved — not yet checked in,” which matches the authorization actually checked. Booking date remains visible; no admission policy or stored booking was changed. |
| The floating chatbot covered the footer tagline at narrow widths. | Added space beside the footer text. Reinspection confirmed readable footer text on desktop and at 390 × 740. |
| An existing historical Court 2 booking dated February 25, 2026 displays 13:00–13:00 and a paid amount. | Open data-quality finding. Its intended time cannot be inferred safely. An authorized operator must compare it to the original reservation. New booking validation already rejects zero-duration ranges. The record was not modified. |

## Observed desktop flows

- Homepage: logo, original venue photographs, display/body fonts and booking panel render. The feature-card wave visibly rises on pointer interaction while text and action positions remain fixed.
- Booking guide: three icons and the connecting curved line render. Successive live frames show the pickleball traveling from the first step toward the third along the desktop curve. Motion was also observed on the vertical mobile path.
- Courts: three active courts loaded with current hourly rates (₱250, ₱250, ₱200). Past hours today are disabled. Calendar month navigation works, and choosing November 1 changed the displayed date and refreshed availability.
- Selection/checkout: selected Court 1 at 6PM and 7PM; summary changed from one hour/₱250 to two hours/₱500. Proceed carried both hours and ₱500 to checkout. The review starts at the top after the navigation fix, contact name/account email load, and Submit stays disabled without a payment reference.
- Payment QR: enlarge dialog opens, displays the QR at a readable size, exposes an accessible close control, and closes back to checkout. No reference was entered and Submit Booking was not clicked.
- My bookings: loaded Upcoming (0) and Past (2). Switching tabs displays the two historical paid reservations. An existing QR dialog loaded successfully and closed with Escape.
- Open Play: loaded the empty-session state with zero upcoming sessions. There is no session available to exercise registration/waitlist controls in this live environment.
- Profile: account details loaded; account email is disabled, name is populated and phone is empty. No profile changes were saved.
- Help: the booking FAQ expanded and displayed its answer. Directions and booking links are present.
- Theme: Help rendered in dark mode and then returned to the original light mode.
- Chat: panel opens, focuses the composer, shows its greeting and disables an empty Send button. Escape closes it. No AI message was submitted.

## Responsive inspection

Chrome device emulation was set to 390 × 740 with normal page zoom. The homepage hero, booking panel, checkout and calendar fit the viewport. The mobile menu exposes navigation, profile and sign-out actions. Horizontal scrolling reveals the third court in the booking grid. Choosing a future date closes the calendar automatically. The vertical booking-step animation and unobstructed footer text were observed. This is viewport emulation, not a physical touch-device test.

## Verification and limits

The non-admin regression suite passes: **178 tests across 25 files**, including three route-scroll tests and the calendar-close regression. Production build, application TypeScript check, lint on the files changed for this live follow-up, and `git diff --check` all pass after the fixes. Existing project-wide lint failures and build bundle-size/config warnings remain; this is not a claim that whole-repository lint is clean.

Authentication handoffs (sign-in, sign-up and recovery), final booking submission/cancellation, actual payments, AI responses, email delivery, live Open Play registration/waitlists, physical camera/touch behavior and concurrent-load behavior remain unverified in the browser. Open Play had no available sessions. The existing database migration and edge-function deployment requirements in `PLAYER_FEATURE_AUDIT.md` still apply; this inspection did not deploy them.

No real reservation was created or cancelled; no GCash transfer, outgoing chat/email, profile save or administrative operation was performed.
