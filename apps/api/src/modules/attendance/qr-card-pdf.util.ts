import PDFDocument from "pdfkit";

/** Renders a single branded card (logo/title/QR) as a one-page PDF — used for both
 * the event's door/banner QR and a per-registrant ticket. Built with pdfkit
 * directly, matching the style of reports/pdf.util.ts. */
export function renderQrCardPdf(params: {
  title: string;
  subtitle?: string;
  lines?: string[];
  qrPng: Buffer;
  footer?: string;
  /** The organization's uploaded logo, if any — drawn above the title as a small badge. Silently skipped if missing or unreadable. */
  logo?: Buffer | null;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: [320, 460] });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.rect(0, 0, doc.page.width, doc.page.height).fill("#DC2626");

    let titleY = 36;
    if (params.logo) {
      try {
        const logoSize = 40;
        const logoX = (doc.page.width - logoSize) / 2;
        doc.save();
        doc.roundedRect(logoX, 16, logoSize, logoSize, 10).clip();
        doc.image(params.logo, logoX, 16, { width: logoSize, height: logoSize, fit: [logoSize, logoSize] });
        doc.restore();
        titleY = 66;
      } catch {
        // A corrupt/unreadable logo buffer must never break the whole card — fall back to no logo.
      }
    }

    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(18).text(params.title, 24, titleY, { width: doc.page.width - 48, align: "center" });
    if (params.subtitle) {
      doc.font("Helvetica").fontSize(11).fillColor("#FFFFFFCC").text(params.subtitle, 24, titleY + 26, { width: doc.page.width - 48, align: "center" });
    }

    const qrSize = 220;
    const qrX = (doc.page.width - qrSize) / 2;
    const qrY = titleY + 64;
    doc.roundedRect(qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 12).fill("#FFFFFF");
    doc.image(params.qrPng, qrX, qrY, { width: qrSize, height: qrSize });

    let y = qrY + qrSize + 28;
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#FFFFFF");
    for (const line of params.lines ?? []) {
      doc.text(line, 24, y, { width: doc.page.width - 48, align: "center" });
      y += 16;
    }

    if (params.footer) {
      doc.font("Helvetica").fontSize(8).fillColor("#FFFFFFAA").text(params.footer, 24, doc.page.height - 30, { width: doc.page.width - 48, align: "center" });
    }

    doc.end();
  });
}
