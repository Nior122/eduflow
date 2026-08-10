/**
 * EduFlow AI — document parser declarations.
 * pdf-parse and mammoth do not ship complete types; the dynamic imports in
 * document-assistant are resolved against these minimal declarations.
 */
declare module "pdf-parse" {
  const pdfParse: (data: Buffer) => Promise<{ text: string; numpages?: number; info?: unknown }>;
  export default pdfParse;
}

declare module "mammoth" {
  export function extractRawText(input: { buffer: Buffer }): Promise<{ value: string; messages: unknown[] }>;
}
