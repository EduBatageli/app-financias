import path from 'node:path';
import { HttpError } from './httpError.js';

export function validatePdfUpload(buffer, originalName) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new HttpError(400, 'Selecione um arquivo PDF.');
  if (buffer.length > 15 * 1024 * 1024) throw new HttpError(413, 'O PDF deve ter no máximo 15 MB.');
  if (!buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'))) {
    throw new HttpError(400, 'O arquivo enviado não parece ser um PDF válido.');
  }
  const safeName = path.basename(String(originalName || 'documento.pdf'))
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .slice(0, 180);
  return safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName || 'documento'}.pdf`;
}
