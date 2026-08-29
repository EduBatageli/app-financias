import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { HttpError } from '../utils/httpError.js';
import { validatePdfUpload } from '../utils/pdf.js';

const execFileAsync = promisify(execFile);
const maxPages = Math.max(1, Math.min(5, Number(process.env.OCR_MAX_PAGES || 3)));
const renderDpi = Math.max(150, Math.min(300, Number(process.env.OCR_DPI || 200)));
const timeout = Math.max(10_000, Math.min(120_000, Number(process.env.OCR_TIMEOUT_MS || 60_000)));
let ocrRunning = false;

function commandOptions(extra = {}) {
  return {
    encoding: 'utf8',
    maxBuffer: 5 * 1024 * 1024,
    timeout,
    env: { ...process.env, OMP_THREAD_LIMIT: '1' },
    ...extra,
  };
}

function parseBrazilianAmount(value) {
  const parsed = Number(value.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function extractFieldsFromText(text, originalName = 'conta.pdf') {
  const normalizedText = String(text || '').normalize('NFKC');
  const numberPattern = '(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+,\\d{2})';
  const labeledAmount = new RegExp(
    `(?:valor\\s+(?:total|a\\s+pagar|da\\s+fatura)|total\\s+(?:a\\s+pagar|da\\s+fatura)|total\\s+geral)[^\\d]{0,60}(?:R\\$\\s*)?${numberPattern}`,
    'iu',
  ).exec(normalizedText);

  let totalAmount = labeledAmount ? parseBrazilianAmount(labeledAmount[1]) : null;
  let amountConfidence = totalAmount ? 'high' : 'none';
  if (!totalAmount) {
    const currencyAmounts = [...normalizedText.matchAll(new RegExp(`R\\$\\s*${numberPattern}`, 'giu'))]
      .map((match) => parseBrazilianAmount(match[1]))
      .filter((amount) => amount !== null);
    if (currencyAmounts.length) {
      totalAmount = Math.max(...currencyAmounts);
      amountConfidence = 'low';
    }
  }

  const ignoredLine = /^(?:fatura|conta|cliente|consumidor|vencimento|emiss[aã]o|nota fiscal|documento|dados|total|valor|p[aá]gina|c[oó]digo|segunda via)/iu;
  const lines = normalizedText.split(/\r?\n/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const candidates = lines.slice(0, 35).filter((line) => {
    const letters = line.match(/\p{L}/gu)?.length || 0;
    const digits = line.match(/\d/g)?.length || 0;
    return line.length >= 3 && line.length <= 80 && letters >= 3 && digits <= letters
      && !ignoredLine.test(line) && !/CNPJ|CPF|www\.|https?:|@/iu.test(line);
  });
  const description = candidates[0]
    || path.basename(originalName, path.extname(originalName)).replace(/[_-]+/g, ' ').trim()
    || null;

  return {
    description,
    totalAmount,
    confidence: amountConfidence === 'high' && description ? 'high' : totalAmount || description ? 'medium' : 'low',
  };
}

function hasUsefulText(text) {
  return String(text || '').replace(/[^\p{L}\p{N}]/gu, '').length >= 50;
}

export function isPasswordError(error) {
  return /(?:incorrect|invalid|wrong|requires?|need(?:s|ed)?)\s+(?:a\s+)?password|password\s+(?:required|incorrect|invalid)|encrypted\s+file/iu
    .test(`${error?.stderr || ''}\n${error?.message || ''}`);
}

function passwordArguments(password) {
  return password ? ['-upw', password] : [];
}

async function runAnalysis(buffer, originalName, password = '') {
  const validatedName = validatePdfUpload(buffer, originalName);
  if (password.length > 256) throw new HttpError(400, 'A senha do PDF é muito longa.');
  const workingDirectory = await mkdtemp(path.join(tmpdir(), 'fluxo-ocr-'));
  const inputPath = path.join(workingDirectory, 'input.pdf');

  try {
    await writeFile(inputPath, buffer);
    let text = '';
    try {
      ({ stdout: text } = await execFileAsync(
        'pdftotext', [...passwordArguments(password), '-f', '1', '-l', String(maxPages), '-layout', inputPath, '-'], commandOptions(),
      ));
    } catch (error) {
      if (error.code === 'ENOENT') throw new HttpError(503, 'O extrator de PDF ainda não está disponível no servidor.');
      if (isPasswordError(error)) {
        throw new HttpError(423, password ? 'Senha incorreta. Tente novamente.' : 'Este PDF é protegido por senha.');
      }
    }

    let method = 'native';
    if (!hasUsefulText(text)) {
      method = 'ocr';
      const imagePrefix = path.join(workingDirectory, 'page');
      try {
        await execFileAsync('pdftoppm', [
          ...passwordArguments(password), '-f', '1', '-l', String(maxPages), '-r', String(renderDpi), '-gray', '-png', inputPath, imagePrefix,
        ], commandOptions());
      } catch (error) {
        if (error.code === 'ENOENT') throw new HttpError(503, 'O renderizador de PDF ainda não está disponível no servidor.');
        if (isPasswordError(error)) {
          throw new HttpError(423, password ? 'Senha incorreta. Tente novamente.' : 'Este PDF é protegido por senha.');
        }
        throw new HttpError(422, 'Não foi possível preparar este PDF para leitura.');
      }

      const images = (await readdir(workingDirectory)).filter((name) => /^page-\d+\.png$/u.test(name)).sort();
      const pageTexts = [];
      for (const image of images) {
        try {
          const { stdout } = await execFileAsync(
            'tesseract', [path.join(workingDirectory, image), 'stdout', '-l', 'por', '--psm', '3'], commandOptions(),
          );
          pageTexts.push(stdout);
        } catch (error) {
          if (error.code === 'ENOENT') throw new HttpError(503, 'O OCR ainda não está disponível no servidor.');
          if (error.killed || error.signal === 'SIGTERM') throw new HttpError(408, 'A leitura do PDF excedeu o tempo permitido.');
          throw new HttpError(422, 'Não foi possível reconhecer o texto deste PDF.');
        }
      }
      text = pageTexts.join('\n');
    }

    if (!hasUsefulText(text)) throw new HttpError(422, 'Não encontramos texto suficiente neste PDF. Preencha os campos manualmente.');
    return { ...extractFieldsFromText(text, validatedName), method, pagesLimit: maxPages };
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}

export async function analyzePdf(buffer, originalName, password = '') {
  if (ocrRunning) throw new HttpError(429, 'Já existe um PDF sendo lido. Tente novamente em alguns instantes.');
  ocrRunning = true;
  try {
    return await runAnalysis(buffer, originalName, password);
  } finally {
    ocrRunning = false;
  }
}
