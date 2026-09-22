import type { PostingAgreement } from "@/lib/types";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Opens a new window with a clean, printable summary of one posting agreement and triggers the
 * browser's print dialog — no PDF library needed, this is exactly what "print" means for a
 * one-page reference document. All user-entered text is HTML-escaped before being written into
 * the window, since it's inserted via document.write. */
export function printAgreement(params: {
  agreement: PostingAgreement;
  beneficiaryName: string;
  targetLabel: string | null;
  labels: {
    title: string;
    beneficiary: string;
    agreementDate: string;
    target: string;
    ratePerPost: string;
    flatAmount: string;
    status: string;
    active: string;
    inactive: string;
    notes: string;
    referenceNote: string;
  };
}) {
  const { agreement, beneficiaryName, targetLabel, labels } = params;
  const win = window.open("", "_blank", "width=680,height=840");
  if (!win) return;

  const rows: [string, string][] = [
    [labels.beneficiary, escapeHtml(beneficiaryName)],
    [labels.agreementDate, agreement.startDate.slice(0, 10)],
    [labels.target, targetLabel ? escapeHtml(targetLabel) : "—"],
    [agreement.postsPerWeek != null ? labels.ratePerPost : labels.flatAmount, `${agreement.currency} ${agreement.weeklyAmount.toLocaleString()}`],
    [labels.status, agreement.isActive ? labels.active : labels.inactive],
  ];
  if (agreement.notes) rows.push([labels.notes, escapeHtml(agreement.notes).replace(/\n/g, "<br/>")]);

  win.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(labels.title)} — ${escapeHtml(beneficiaryName)}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #1a1a1a; padding: 40px; max-width: 640px; margin: 0 auto; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .sub { color: #666; font-size: 13px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 10px 0; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
  td:first-child { color: #666; width: 160px; font-size: 13px; }
  td:last-child { font-weight: 600; }
  .note { margin-top: 28px; font-size: 12px; color: #888; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>${escapeHtml(labels.title)}</h1>
  <p class="sub">${escapeHtml(beneficiaryName)}</p>
  <table>
    ${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}
  </table>
  <p class="note">${escapeHtml(labels.referenceNote)}</p>
</body>
</html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 200);
}
