import * as service from '../services/expensesService.js';
import * as ocrService from '../services/ocrService.js';
import { HttpError } from '../utils/httpError.js';

function pdfMetadata(request) {
  const encoded = request.get('X-PDF-Metadata');
  if (!encoded) return request.query;
  try {
    const metadata = JSON.parse(decodeURIComponent(encoded));
    if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') throw new Error('invalid');
    return metadata;
  } catch {
    throw new HttpError(400, 'Os dados enviados com o PDF são inválidos.');
  }
}

export async function index(request, response) {
  response.json(await service.listExpenses());
}

export async function store(request, response) {
  response.status(201).json(await service.createExpense(request.body));
}

export async function storePdf(request, response) {
  const { originalName, ...input } = pdfMetadata(request);
  response.status(201).json(await service.createExpenseFromPdf(input, request.body, originalName));
}

export async function analyzePdf(request, response) {
  const { originalName } = pdfMetadata(request);
  let password = '';
  try {
    password = decodeURIComponent(request.get('X-PDF-Password') || '');
  } catch {
    password = '';
  }
  response.json(await ocrService.analyzePdf(request.body, originalName, password));
}

export async function showPdf(request, response) {
  const document = await service.getExpenseDocument(request.params.id);
  const disposition = request.query.download === '1' ? 'attachment' : 'inline';
  const encodedName = encodeURIComponent(document.originalName).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  response.type(document.mimeType);
  response.set('Content-Length', String(document.sizeBytes));
  response.set('Content-Disposition', `${disposition}; filename*=UTF-8''${encodedName}`);
  response.set('Cache-Control', 'private, no-store');
  response.sendFile(document.absolutePath);
}

export async function update(request, response) {
  response.json(await service.updateExpense(request.params.id, request.body));
}

export async function projections(request, response) {
  response.json(await service.listProjections());
}
