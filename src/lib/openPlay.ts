export function venueDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function openPlayStart(session: { session_date: string; start_time: string }): number {
  return new Date(`${session.session_date}T${session.start_time}+08:00`).getTime();
}

export interface OpenPlaySessionInput {
  session_date: string;
  start_time: string;
  end_time: string;
  court_ids: string[];
  max_players: number;
  price_php: number;
  cancel_cutoff_hours: number;
}

export function validateOpenPlaySession(session: OpenPlaySessionInput, now = Date.now()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(session.session_date)) return "Choose a valid session date.";
  const time = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
  if (!time.test(session.start_time) || !time.test(session.end_time)
    || openPlayStart({ ...session, start_time: session.end_time }) <= openPlayStart(session)) {
    return "End time must be after the start time on the same day.";
  }
  if (!Number.isFinite(openPlayStart(session)) || venueDate(new Date(openPlayStart(session))) !== session.session_date) return "Choose a valid session date.";
  if (openPlayStart(session) <= now) return "Choose a start time in the future (Philippine time).";
  if (!session.court_ids.length || new Set(session.court_ids).size !== session.court_ids.length) return "Select at least one available court.";
  if (!Number.isInteger(session.max_players) || session.max_players < 1) return "Capacity must be a whole number of at least 1.";
  if (!Number.isFinite(session.price_php) || session.price_php < 0) return "Price must be zero or greater.";
  if (!Number.isInteger(session.cancel_cutoff_hours) || session.cancel_cutoff_hours < 0) return "Cancellation cutoff must be a whole number of hours, zero or greater.";
  return null;
}

export function openPlayErrorMessage(error: unknown): string {
  const message = typeof error === "object" && error !== null && "message" in error ? String(error.message) : "";
  const messages: Record<string, string> = {
    AUTH_REQUIRED: "Please sign in again.",
    ADMIN_REQUIRED: "Admin access is required.",
    SESSION_NOT_FOUND: "This session is no longer available.",
    SESSION_NOT_OPEN: "This session has been cancelled or closed.",
    SESSION_ALREADY_STARTED: "Registration closes when the session starts.",
    PAYMENT_REFERENCE_REQUIRED: "Enter your GCash payment reference.",
    INVALID_PAYMENT_REFERENCE: "Payment references must be 128 characters or fewer.",
    ALREADY_REGISTERED: "You already have a registration for this session.",
    CANCELLATION_CUTOFF_PASSED: "The cancellation deadline has passed. Contact the venue for help.",
    REGISTRATION_NOT_CANCELLABLE: "This registration can no longer be cancelled online.",
    REG_NOT_FOUND: "This registration is no longer available.",
    FORBIDDEN: "You can only cancel your own registration.",
    PAYMENT_NOT_APPROVED: "Verify payment before checking this player in.",
    INVALID_REGISTRATION_TRANSITION: "This player's status has changed. Refresh the roster and try again.",
    COURT_TIME_CONFLICT: "A selected court is already reserved during this time. Choose another court or time.",
    INVALID_SESSION_COURTS: "Select at least one available court.",
    COURT_UNAVAILABLE: "A selected court is unavailable. Refresh the court list.",
    CAPACITY_BELOW_REGISTRATIONS: "Capacity cannot be lower than the number of registered players.",
  };
  return Object.entries(messages).find(([code]) => message.includes(code))?.[1]
    ?? (message || "The request failed. Please try again.");
}
