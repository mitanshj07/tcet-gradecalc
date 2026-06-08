import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { describe, it } from 'vitest';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parseOfficeRegisterText } from './officeRegisterParser';

function groupTextItemsIntoLines(items = [], tolerance = 8) {
  const sortedItems = items
    .filter((item) => item?.str?.trim())
    .map((item) => ({
      text: item.str,
      x: item.transform?.[4] ?? 0,
      y: item.transform?.[5] ?? 0,
    }))
    .sort((a, b) => b.y - a.y)

  const rows = []

  for (const item of sortedItems) {
    const foundRow = rows.find((row) => Math.abs(row.y - item.y) <= tolerance)
    if (foundRow) {
      foundRow.items.push(item)
    } else {
      rows.push({
        y: item.y,
        items: [item],
      })
    }
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) =>
      row.items
        .sort((a, b) => a.x - b.x)
        .map((item) => item.text.trim())
        .filter(Boolean)
        .join(' '),
    )
    .filter(Boolean)
}

async function extractPdfText(filePath) {
  const buffer = readFileSync(filePath);
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    standardFontDataUrl: './node_modules/pdfjs-dist/standard_fonts/',
  });
  const pdf = await loadingTask.promise;

  const pages = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const lines = groupTextItemsIntoLines(content.items);
    pages.push(lines.join('\n'));
  }

  return pages.join('\n');
}

describe('Tcet Gazette Verification', () => {
  it('parses COMP Sem I gazette and writes results', async () => {
    const filePath = '/Users/mitansh7/Downloads/gazette-i- comp225 (4).pdf';
    console.log(`Extracting: ${filePath}`);
    const text = await extractPdfText(filePath);
    
    // Save extracted text to check structure
    mkdirSync('/Users/mitansh7/.gemini/antigravity/brain/31f1df22-0875-41e3-afd1-282592f5ed78/scratch', { recursive: true });
    writeFileSync('/Users/mitansh7/.gemini/antigravity/brain/31f1df22-0875-41e3-afd1-282592f5ed78/scratch/extracted_comp_sem1.txt', text);

    const result = parseOfficeRegisterText(text, {
      preferredBranch: 'COMP',
      preferredSemester: 1,
    });

    console.log('COMP Sem 1 horizontal record check:');
    console.log('  seatNo:', result.student?.seatNo);
    console.log('  name:', result.student?.name);
    console.log('  subjects count:', result.subjects.length);
    console.log('  warnings:', result.warnings);

    writeFileSync(
      '/Users/mitansh7/.gemini/antigravity/brain/31f1df22-0875-41e3-afd1-282592f5ed78/scratch/parsed_comp_sem1.json',
      JSON.stringify(result, null, 2)
    );
    
    console.log('COMP Sem 1 parse format:', result.format);
    console.log('COMP Sem 1 confidence:', result.confidence);
    console.log('COMP Sem 1 student name:', result.student?.name);
    console.log('COMP Sem 1 student seatNo:', result.student?.seatNo);
  });

  it('parses IT Sem II gazette and writes results', async () => {
    const filePath = '/Users/mitansh7/Downloads/gazette-ii- it76.pdf';
    console.log(`Extracting: ${filePath}`);
    const text = await extractPdfText(filePath);
    
    writeFileSync('/Users/mitansh7/.gemini/antigravity/brain/31f1df22-0875-41e3-afd1-282592f5ed78/scratch/extracted_it_sem2.txt', text);

    const result = parseOfficeRegisterText(text, {
      preferredBranch: 'IT',
      preferredSemester: 2,
    });

    writeFileSync(
      '/Users/mitansh7/.gemini/antigravity/brain/31f1df22-0875-41e3-afd1-282592f5ed78/scratch/parsed_it_sem2.json',
      JSON.stringify(result, null, 2)
    );
    
    console.log('IT Sem 2 parse format:', result.format);
    console.log('IT Sem 2 confidence:', result.confidence);
    console.log('IT Sem 2 student name:', result.student?.name);
    console.log('IT Sem 2 student seatNo:', result.student?.seatNo);
  });
});
