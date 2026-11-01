import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export interface AttendanceRow {
  name: string;
  phone: string;
  detail: string; // court/time or waitlist position
  status: string;
  payment: string;
  registeredAt: string;
  checkedInAt: string;
}

export const ATTENDANCE_HEADERS = [
  "Name",
  "Phone",
  "Details",
  "Status",
  "Payment",
  "Registered / Booked At",
  "Checked In At",
];

export function fmtTimestamp(value?: string | null) {
  if (!value) return "—";
  try {
    return format(new Date(value), "MMM d, yyyy h:mm a");
  } catch {
    return "—";
  }
}

export function escapeCsv(value: string) {
  // Quoting alone does not stop spreadsheet formulas. Protect untrusted names,
  // phone numbers and other text, including formulas after leading whitespace.
  const raw = value ?? "";
  // eslint-disable-next-line no-control-regex -- Leading control bytes can conceal spreadsheet formula prefixes.
  const v = /^[\s\u0000-\u001f]*[=+@-]/u.test(raw) || /^[\t\r\n]/u.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportAttendanceCsv(
  title: string,
  subtitle: string,
  rows: AttendanceRow[],
  filename: string
) {
  const lines: string[] = [];
  lines.push(escapeCsv(title));
  lines.push(escapeCsv(subtitle));
  lines.push(escapeCsv(`Exported ${fmtTimestamp(new Date().toISOString())}`));
  lines.push("");
  lines.push(ATTENDANCE_HEADERS.map(escapeCsv).join(","));
  rows.forEach((r) => {
    lines.push(
      [r.name, r.phone, r.detail, r.status, r.payment, r.registeredAt, r.checkedInAt]
        .map((c) => escapeCsv(c ?? ""))
        .join(",")
    );
  });
  download(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" }), filename);
}

export function exportAttendancePdf(
  title: string,
  subtitle: string,
  summary: string,
  rows: AttendanceRow[],
  filename: string
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(16);
  doc.text(title, 40, 40);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(subtitle, 40, 58);
  doc.text(summary, 40, 73);
  doc.text(`Exported ${fmtTimestamp(new Date().toISOString())}`, 40, 88);

  autoTable(doc, {
    startY: 104,
    head: [ATTENDANCE_HEADERS],
    body: rows.map((r) => [
      r.name,
      r.phone,
      r.detail,
      r.status,
      r.payment,
      r.registeredAt,
      r.checkedInAt,
    ]),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [34, 139, 78] },
  });

  doc.save(filename);
}
