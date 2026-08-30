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
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: [320, 460] });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.rect(0, 0, doc.page.width, doc.page.height).fill("#DC2626");

    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(18).text(params.title, 24, 36, { width: doc.page.width - 48, align: "center" });
    if (params.subtitle) {
      doc.font("Helvetica").fontSize(11).fillColor("#FFFFFFCC").text(params.subtitle, 24, 62, { width: doc.page.width - 48, align: "center" });
    }

    const qrSize = 220;
    const qrX = (doc.page.width - qrSize) / 2;
    const qrY = 100;
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
