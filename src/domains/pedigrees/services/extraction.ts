import type { ManualAncestorEntry } from "../types";

/**
 * Document extraction (turning an uploaded pedigree scan/PDF into structured ancestor rows) is
 * intentionally behind this typed interface with a no-op implementation.
 *
 * DEFERRED: no OCR/AI extraction is wired. The product brief is explicit — do not fake OCR. The
 * review/matching UX is what matters, not a fake extraction result. `pedigree_submissions.
 * extraction_state` is always `'not_available'` until a real pipeline exists, and the "Add
 * pedigree" upload flow routes straight to manual transcription + review.
 *
 * A future implementation (server-side only — never a browser-side model call) would take the
 * uploaded file, return `ExtractionResult` with per-field confidences, and the review stage would
 * show those alongside the human's corrections. POK's manual canvas-redaction tool
 * (SourcePedigreeRedactor.tsx) is the reference for the human-in-the-loop shape.
 */
export type ExtractionResult = {
  state: "not_available" | "pending" | "succeeded" | "failed";
  subject: Partial<ManualAncestorEntry> | null;
  ancestors: ManualAncestorEntry[];
  warnings: string[];
};

export interface PedigreeDocumentExtractor {
  extract(file: File): Promise<ExtractionResult>;
}

export const noopExtractor: PedigreeDocumentExtractor = {
  async extract() {
    return {
      state: "not_available",
      subject: null,
      ancestors: [],
      warnings: [
        "Automatic reading of pedigree documents is not available yet. Please type the ancestors in.",
      ],
    };
  },
};

/** The extractor the app currently uses. Swap this binding when a real pipeline lands. */
export const pedigreeDocumentExtractor: PedigreeDocumentExtractor = noopExtractor;
