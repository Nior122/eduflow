/**
 * EduFlow AI — file text extraction (Phase 7).
 * PDF (pdf-parse), Word (mammoth), Excel (xlsx) and plain text. The parser
 * packages are optional: if a dependency is missing, extraction degrades
 * gracefully instead of crashing.
 */
import type { KbSourceType } from "@prisma/client";

export type ExtractedText = { text: string; sourceType: KbSourceType };

export async function extractText(file: File): Promise<ExtractedText | null> {
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    if (name.endsWith(".pdf")) {
      const mod = await import("pdf-parse");
      const pdfParse = mod.default;
      const data = await pdfParse(buffer);
      return { text: data.text ?? "", sourceType: "PDF" };
    }
    if (name.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const data = await mammoth.extractRawText({ buffer });
      return { text: data.value ?? "", sourceType: "WORD" };
    }
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buffer, { type: "buffer" });
      const text = wb.SheetNames.map((sn) => XLSX.utils.sheet_to_csv(wb.Sheets[sn])).join("\n");
      return { text, sourceType: "EXCEL" };
    }
    const decoder = new TextDecoder("utf-8");
    return { text: decoder.decode(buffer), sourceType: "TEXT" };
  } catch (error) {
    console.error("extractText failed:", error);
    return null;
  }
}
