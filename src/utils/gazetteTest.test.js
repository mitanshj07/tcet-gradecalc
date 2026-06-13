import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.js';
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

const SCRATCH_DIR = '/Users/mitansh7/.gemini/antigravity/brain/31f1df22-0875-41e3-afd1-282592f5ed78/scratch';

function logV2Result(label, result) {
  console.log(`\n═══ ${label} — V2 Parser Results ═══`);
  console.log(`Format: ${result.format} | Confidence: ${result.confidence}`);
  console.log(`Student: ${result.student?.name} (${result.student?.seatNo})`);
  console.log(`Branch: ${result.metadata?.branch} | Sem: ${result.metadata?.semester} | Cycle: ${result.metadata?.cycle}`);
  console.log(`Template: ${result.metadata?.templateKey}`);
  console.log(`\n── Subjects ──`);
  for (const s of result.subjects) {
    const marks = [
      s.ese !== undefined ? `ESE:${s.ese}` : null,
      s.importedIA !== undefined ? `IA:${s.importedIA}` : null,
      s.tw !== undefined ? `TW:${s.tw}` : null,
      s.pr !== undefined ? `PR:${s.pr}` : null,
    ].filter(Boolean).join(' ');
    const validation = [
      s.grade ? `Grade:${s.grade}` : null,
      s.gradePoint !== undefined ? `GP:${s.gradePoint}` : null,
      s.credits !== undefined ? `C:${s.credits}` : null,
      s.creditPoints !== undefined ? `CP:${s.creditPoints}` : null,
    ].filter(Boolean).join(' ');
    console.log(`  ${s.subjectCode} (${s.subjectName}): ${marks} | ${validation} | conf:${s.confidence}`);
    if (s.warnings?.length) console.log(`    ⚠ ${s.warnings.join('; ')}`);
  }
  console.log(`\n── Final Summary ──`);
  console.log(`  SGPA: ${result.final.sgpa} (calc: ${result.final.calculatedSgpa})`);
  console.log(`  Total C: ${result.final.totalCredits} | Total CG: ${result.final.totalCreditPoints} | Status: ${result.final.status}`);
  console.log(`\n── V2 Validation ──`);
  console.log(`  SGPA matches: ${result.validation.sgpaMatches}`);
  console.log(`  Credit total matches: ${result.validation.creditTotalMatches}`);
  console.log(`  CP total matches: ${result.validation.creditPointTotalMatches}`);
  console.log(`  All subjects valid: ${result.validation.allSubjectsValid}`);
  if (result.warnings?.length) {
    console.log(`\n── Warnings (${result.warnings.length}) ──`);
    result.warnings.forEach(w => console.log(`  ⚠ ${w}`));
  }
}

describe('Tcet Gazette Verification', () => {
  it('parses COMP Sem I gazette with V2 validation', async () => {
    const filePath = '/Users/mitansh7/Downloads/gazette-i- comp225 (4).pdf';
    const text = await extractPdfText(filePath);
    
    mkdirSync(SCRATCH_DIR, { recursive: true });
    writeFileSync(`${SCRATCH_DIR}/extracted_comp_sem1.txt`, text);

    const result = parseOfficeRegisterText(text, {
      preferredBranch: 'COMP',
      preferredSemester: 1,
    });

    writeFileSync(`${SCRATCH_DIR}/parsed_comp_sem1.json`, JSON.stringify(result, null, 2));
    logV2Result('COMP Sem I', result);

    // Core assertions
    expect(result.student.seatNo).toBe('121160227');
    expect(result.student.name).toContain('TYAGI KHUSHI');
    expect(result.final.sgpa).toBe(8.9);
    expect(result.final.totalCredits).toBe(21);
    expect(result.final.totalCreditPoints).toBe(187);
    expect(result.final.status).toBe('P');
    expect(result.validation.sgpaMatches).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);

    // V2: Per-subject validation
    const physics = result.subjects.find(s => s.subjectCode === 'BSC1101');
    expect(physics).toMatchObject({ ese: 50, importedIA: 37, tw: 21, pr: 21 });
    expect(physics.gradePoint).toBe(10);
    expect(physics.creditPoints).toBe(40);

    const math = result.subjects.find(s => s.subjectCode === 'BSC1102');
    expect(math).toMatchObject({ ese: 38, importedIA: 31, tw: 19 });

    const bee = result.subjects.find(s => s.subjectCode === 'ESC1101');
    expect(bee).toMatchObject({ ese: 46, importedIA: 34, tw: 22, pr: 20 });

    const egd = result.subjects.find(s => s.subjectCode === 'ESC1102');
    expect(egd).toMatchObject({ ese: 32, importedIA: 32, tw: 19, pr: 20 });

    const workshop = result.subjects.find(s => s.subjectCode === 'ESC1103');
    expect(workshop).toMatchObject({ tw: 18 });
    expect(workshop.creditPoints).toBe(8);

    const english = result.subjects.find(s => s.subjectCode === 'HSMC1101');
    expect(english).toMatchObject({ ese: 45, importedIA: 35, tw: 21 });
  });

  it('parses IT Sem II gazette with V2 validation', async () => {
    const filePath = '/Users/mitansh7/Downloads/gazette-ii- it76.pdf';
    const text = await extractPdfText(filePath);
    
    writeFileSync(`${SCRATCH_DIR}/extracted_it_sem2.txt`, text);

    const result = parseOfficeRegisterText(text, {
      preferredBranch: 'IT',
      preferredSemester: 2,
    });

    writeFileSync(`${SCRATCH_DIR}/parsed_it_sem2.json`, JSON.stringify(result, null, 2));
    logV2Result('IT Sem II', result);

    // Core assertions
    expect(result.student.seatNo).toBe('122340076');
    expect(result.student.name).toContain('MISHRA');
    expect(result.final.sgpa).toBe(9.95);
    expect(result.final.status).toBe('P');
    expect(result.validation.sgpaMatches).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);

    // V2: Per-subject validation
    const physics = result.subjects.find(s => s.subjectCode === 'BSC1101');
    expect(physics).toMatchObject({ ese: 57, importedIA: 36, tw: 21, pr: 19 });
  });
});
