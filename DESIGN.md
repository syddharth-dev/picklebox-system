# The Pickle Box design system

Updated November 3, 2026. The direction is a community court club: court-signage typography, real venue photography, direct booking controls, and familiar working screens.

## Brand foundations

| Role | Value | Use |
| --- | --- | --- |
| Pickle Green | `#B7E34B` | Booking panels, primary marketing actions, active admin navigation, supporting badges |
| Deep Navy | `#142B3B` | Display text, primary light-theme controls, footer, admin navigation text |
| Off-white | `#F8FAFC` | Default light-theme canvas |
| White | `#FFFFFF` | Navigation, cards, forms and photo margins |

Muted surfaces and secondary text use navy-derived neutrals. Red is reserved for destructive/error states. Green is paired with navy text, never white body text. Calculated solid-color contrast: navy/green 9.80:1, white/navy 14.60:1, navy/off-white 13.95:1. These checks cover these exact solid pairs; they are not a full rendered accessibility audit.

- Display: Barlow Condensed, weights 600–800. Large uppercase headlines belong to marketing sections; working pages use smaller, readable titles.
- Body and controls: Manrope, weights 400–800. Fonts load from Google Fonts, with local sans-serif fallbacks.
- Corners: 12px for main surfaces and controls, with smaller token-based corners for secondary pieces.
- Depth: borders and spacing define ordinary surfaces. Shadows are reserved mainly for overlays and floating controls.
- Motion: one short homepage entrance; two one-time viewport reveals; button/arrow, menu and booking-selection feedback. Tabs fade briefly, while routine tables stay steady. Reduced-motion settings bypass animation, including when the preference changes during the session. Reveal content remains visible without observer support, and focused content is never kept hidden.
- Icons: the existing Lucide library. The original logo is retained. PickleBot uses a smaller derivative of its supplied avatar for the floating interface, while the original remains in the asset library.

## Layout and content

The white header leads to Courts, Open Play, My bookings and Help. Mobile navigation retains profile and sign-out access. The default theme is light; saved dark-mode preferences and the theme toggle remain supported.

The homepage opens with the original brand tagline and a responsive real-court photograph beside a green booking form. The form explains the 60-day booking window, and the selected date is carried to the existing court grid. Its mobile headline is independently sized to preserve the wording without horizontal clipping. Three rounded feature cards follow for court bookings, Open Play and check-in passes, each with a white/theme-aware icon header, curved navy/green divider, green explanation panel and working destination. These marketing cards use 24px corners, while operational surfaces retain 12px corners. The redundant venue-preview section was removed to shorten the path to the primary actions. Community photography, Open Play, the actual payment/check-in sequence, and practical FAQs provide the remainder of the page. No fabricated player counts, prices, testimonials or opening-status claims were added.

The booking guide uses three numbered icon circles connected by a dashed path, centered in three columns on desktop and stacked along a vertical path on mobile. A decorative pickleball travels once along that same measured path when the guide enters view, with sizing updated when the layout changes. Native CSS [offset-path](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/offset-path) and [offset-distance](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/offset-distance) provide the motion. The feature-card sea rises 32px on pointer hover or keyboard focus without moving its text or actions. Reduced-motion settings disable both effects. Payment verification remains explicit before QR access. The two supplied Tripket screenshots (1920 × 1020 including browser chrome) guide only the feature-card and booking-guide composition: generous section spacing, clear centered headings, colored card footers and connected steps. The existing Pickle Box palette, fonts, capabilities and surrounding homepage remain the authority. No screenshot is shipped as UI, and no exact visual-match claim is made.

Operational pages share a page-heading component, form controls, accessible dialogs and status styles. The court grid can scroll horizontally when its columns need more room on narrow screens. Slots support keyboard-generated clicks and announce selection state. The admin sidebar groups all existing destinations into club operations and management; its tables and workflows remain intact.

The admin sidebar has a white surface with navy text and pale-green hover states
in both themes, retaining the green active navigation item. Admin record lists
show 10 items per page with result ranges and first/previous/next/last controls.
Pagination applies to bookings, payments, members, courts, reservation records,
Open Play sessions and rosters, attendance tables, recent check-ins and dashboard lists. Booking
search matches names, phones, booking references, GCash references, booking IDs
and court names, with status, court and inclusive booking-date filters. Changing
filters resets to page 1. Attendance exports and dashboard totals use the full
loaded dataset rather than the displayed page. Calendar grids, forms and scanner
results retain their task-specific layouts.

Open Play discovery is public: signed-out visitors can inspect upcoming session schedules, skill levels, prices and availability. Registration status, participant details, registration, payment and cancellation remain authenticated. A narrow security-definer summary function exposes only discovery fields and aggregate counts to the anonymous role; underlying registration rows remain private. Authentication retains the selected session in an internal return path, so signing in can continue the task the player started. The Help route replaces broken FAQ navigation, and confirmation links to Help instead of an unverified support email. Payment copy states that staff approval is required.

PickleBot uses a mobile-safe panel, Escape-to-close behavior and focus restoration. It no longer promises unrestricted questions before sign-in, and its conversation remounts when the authenticated account changes so private chat state is not carried between users.

## Original photographic assets

| Supplied file | Workspace asset | Subject |
| --- | --- | --- |
| `IMG_4257.jpg` | `src/assets/venue/courts.jpg` | Indoor courts |
| `IMG_6472.jpg` | `src/assets/venue/community.jpg` | Players greeting across the net |
| `IMG_1879.jpg` | `src/assets/venue/rally.jpg` | Community interaction after a game |

All three asset copies match their supplied originals by SHA-256. The original files and embedded marks are unaltered. Layouts use ordinary CSS image crops. Old generated venue assets remain in the repository but are no longer imported by the shipped homepage.

The court photograph also has 720px and 1080px responsive derivatives for smaller viewports. The browser selects between them with `srcset`; the original remains the largest source. The PickleBot avatar has a 256px interface derivative for the same reason.

## Visual target and verification limits

The inspected composition reference is `.design/homepage-target.png`, generated with the built-in image tool at 1536 × 1024. Its exact prompt is in `.design/homepage-target.prompt.txt`. It is a design reference only, outside public assets, and is never rendered as the application UI. The implementation uses original photographs, the original wordmark, semantic text and actual controls. Exact flat brand colors take precedence over tonal shading in the generated reference. A preselected date uses the actual supported booking window instead of the mock's empty placeholder.

The initial computer-use inspection stopped because the Windows tool could not verify Chrome's current URL for policy enforcement. No alternative browser-control path was used. A later inspection succeeded after the user restored Chrome: desktop and 390 × 740 layouts, font loading, hover motion and the desktop/mobile booking-step animation were observed. See [LIVE_BROWSER_AUDIT.md](LIVE_BROWSER_AUDIT.md) for evidence, fixes and remaining coverage limits. No rendered before/after image comparison, physical touch-device test, exhaustive contrast audit or pixel-perfect claim is made.

The current homepage pass was also rendered in headless Chrome at 1440px and 390px widths. Browser timing was allowed to settle before the final capture so the intentional entrance animation did not masquerade as missing content. This pass caught and corrected mobile hero overflow.

Verification uses the existing database and Open Play regressions, TypeScript, production build, and added interaction tests for public session inspection, date handoff, mobile navigation, slot selection, sign-in continuation, reduced-motion behavior, observer cleanup, booking-query recovery, cancellation confirmation and QR-pass state through refreshes. Route-level code splitting keeps most operational and admin code out of the homepage's initial JavaScript. The public discovery migration is included in the repository but was not applied to a live Supabase project; it must be deployed with the application before signed-out discovery works in production. Payment-processing rules and live Supabase data were not changed.
