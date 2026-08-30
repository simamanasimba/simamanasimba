import PDFDocument from "pdfkit";

export interface PdfSection {
  heading: string;
  fields: Array<{ label: string; value: string }>;
}

export interface PdfTable {
  heading: string;
  columns: string[];
  rows: string[][];
}

/**
 * Renders a branded event-report PDF: a details section (key/value pairs)
 * followed by a data table (e.g. the actual attendance manifest). Built with
 * pdfkit directly — no headless-browser dependency.
 */
export function renderEventReportPdf(title: string, subtitle: string, sections: PdfSection[], table?: PdfTable, logo?: Buffer | null): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.rect(0, 0, doc.page.width, 90).fill("#DC2626");
    const textX = 48;
    let logoDrawn = false;
    if (logo) {
      try {
        doc.image(logo, 48, 20, { width: 50, height: 50, fit: [50, 50] });
        logoDrawn = true;
      } catch {
        // Corrupt/unsupported image bytes — fall back to the text-only header rather than fail
        // the whole report over a broken logo file.
      }
    }
    const titleX = logoDrawn ? textX + 62 : textX;
    doc.fillColor("#FFFFFF").fontSize(20).font("Helvetica-Bold").text(title, titleX, 32, { width: doc.page.width - titleX - 48 });
    doc.fontSize(11).font("Helvetica").text(subtitle, titleX, 58, { width: doc.page.width - titleX - 48 });
    doc.fillColor("#111827").moveDown(4);

    for (const section of sections) {
      doc.moveDown(0.5);
      doc.fontSize(13).font("Helvetica-Bold").fillColor("#111827").text(section.heading);
      doc.moveDown(0.3);
      for (const field of section.fields) {
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#6B7280").text(field.label, { continued: true });
        doc.font("Helvetica").fillColor("#111827").text(`  ${field.value}`);
      }
    }

    if (table) {
      doc.moveDown(1);
      doc.fontSize(13).font("Helvetica-Bold").fillColor("#111827").text(table.heading);
      doc.moveDown(0.4);

      const startX = 48;
      const tableWidth = doc.page.width - 96;
      const headerRowHeight = 20;
      const dataRowHeight = 18;

      // Equal-width columns clipped/collided long values like timestamps or long names while
      // short columns ("Method", "Region") sat mostly empty. Size each column by its own longest
      // value instead (header included), floor it so no column collapses to nothing, then scale
      // the whole set to exactly fill the table width — wide content gets real room, narrow
      // content doesn't steal it.
      const minColWidth = 55;
      const rawWidths = table.columns.map((col, i) => {
        const longest = Math.max(col.length, ...table.rows.map((r) => (r[i] ?? "").length));
        return Math.max(minColWidth, longest * 5.3 + 10);
      });
      const rawTotal = rawWidths.reduce((sum, w) => sum + w, 0);
      const colWidths = rawWidths.map((w) => (w / rawTotal) * tableWidth);
      const colX = colWidths.reduce<number[]>((acc, w, i) => [...acc, i === 0 ? startX : acc[i - 1] + colWidths[i - 1]], []);

      function cell(text: string, x: number, y: number, width: number, height: number) {
        // ellipsis + lineBreak:false clips to one line instead of wrapping into the row below —
        // the actual fix for "columns don't fit": a value that's still too long for its column
        // gets a trailing "…" rather than colliding with the next row's text.
        doc.text(text, x + 4, y + (height - 9) / 2, { width: width - 8, height, ellipsis: true, lineBreak: false });
      }

      let y = doc.y;
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#FFFFFF");
      doc.rect(startX, y, tableWidth, headerRowHeight).fill("#B91C1C");
      table.columns.forEach((col, i) => {
        doc.fillColor("#FFFFFF");
        cell(col, colX[i], y, colWidths[i], headerRowHeight);
      });
      y += headerRowHeight;

      doc.font("Helvetica").fontSize(9);
      for (const [rowIndex, row] of table.rows.entries()) {
        if (y > doc.page.height - 60) {
          doc.addPage();
          y = 48;
        }
        if (rowIndex % 2 === 0) {
          doc.rect(startX, y, tableWidth, dataRowHeight).fill("#FEF2F2");
        }
        row.forEach((value, i) => {
          doc.fillColor("#111827");
          cell(value, colX[i], y, colWidths[i], dataRowHeight);
        });
        y += dataRowHeight;
      }
      doc.y = y;
    }

    doc.moveDown(2);
    doc.fontSize(8).fillColor("#8A7F7C").text(`Generated ${new Date().toISOString()} — Simba Event Intelligence Platform`, 48, doc.page.height - 40);

    doc.end();
  });
}
