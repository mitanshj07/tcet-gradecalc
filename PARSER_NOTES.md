# Parser Notes

TCET GradeCalc uses one common grading engine and one common office-register parser. Branches do not have different grading systems under the CBCGS-HME 2023-style flow; they have different subject templates, course order, credits, and TW/PR/OR components.

## Supported format

- Text-based TCET Office Register PDFs.
- Client-side extraction through `pdfjs-dist`.
- No OCR and no paid document parsing APIs.
- Scanned or image-only PDFs fail gracefully and require manual entry.

## Pipeline

1. Extract text from PDF in the browser.
2. Detect office-register signals.
3. Extract branch, semester, scheme, exam month/year, and report date.
4. Resolve branch + semester + cycle into a subject template.
5. Extract `COURSE I`, `COURSE II`, and related course labels.
6. Match the course map to the selected template.
7. Parse compressed student subject rows.
8. Use imported IA/internal marks when official PDFs do not expose ISE splits.
9. Validate `C x GP`, `Sigma C`, `Sigma CG`, and GPA.
10. Show review before applying or saving.

## Adding a new branch or semester fixture

- Add an anonymized text fixture under `tests/fixtures/`.
- Add/verify the subject template in `src/utils/officeRegisterTemplates.js`.
- Mark template subjects with the correct `verificationStatus`.
- Add parser tests for metadata, course map, imported IA, totals, and GPA.

## Limitations

- PDF text extraction can shift spacing, so parser confidence and review are required.
- Sem II templates are resolver-ready but must remain `needs-verification` until matched against real branch/semester gazettes or official TCET scheme documents.
- Full raw PDF text is not saved by default.
