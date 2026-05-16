export type Recommendation = "approve" | "needs_review" | "likely_mismatch";

export type ValidationResult = {
  recommendation: Recommendation;
  summary: string;
  reasons: string[];
  reviewedAt: string;
};

export type ValidationInput = {
  title: string;
  criteria: string;
  proof: string;
};

const STORAGE_PREFIX = "handsel:validation:";

export function validateProof({ criteria, proof, title }: ValidationInput): ValidationResult {
  const normalizedProof = proof.trim();
  const reviewedAt = new Date().toISOString();

  if (normalizedProof.length < 10) {
    return {
      recommendation: "likely_mismatch",
      reviewedAt,
      summary: "The submitted proof is too thin for a confident review.",
      reasons: ["Add a link, delivery note, or artifact reference that maps to the acceptance criteria."],
    };
  }

  const expectedTerms = importantTerms(`${title} ${criteria}`);
  const proofTerms = new Set(importantTerms(normalizedProof));
  const overlap = expectedTerms.filter((term) => proofTerms.has(term));
  const hasUrl = /^https?:\/\//i.test(normalizedProof) || normalizedProof.includes("github.com") || normalizedProof.includes("figma.com");

  if (hasUrl && overlap.length >= 2) {
    return {
      recommendation: "approve",
      reviewedAt,
      summary: "The proof references a delivery artifact and overlaps with the stated criteria.",
      reasons: ["Client should still inspect the artifact before approving release."],
    };
  }

  if (hasUrl || overlap.length >= 2) {
    return {
      recommendation: "needs_review",
      reviewedAt,
      summary: "The proof has useful delivery signals, but the match is not strong enough for a clean approval recommendation.",
      reasons: ["Review the artifact manually against the criteria before releasing USDC."],
    };
  }

  return {
    recommendation: "likely_mismatch",
    reviewedAt,
    summary: "The proof does not clearly map to the title or acceptance criteria.",
    reasons: ["Ask for a clearer proof link or more detailed delivery notes."],
  };
}

export function saveValidationResult(agreementId: bigint, result: ValidationResult) {
  localStorage.setItem(`${STORAGE_PREFIX}${agreementId.toString()}`, JSON.stringify(result));
}

export function loadValidationResult(agreementId: bigint): ValidationResult | null {
  const raw = localStorage.getItem(`${STORAGE_PREFIX}${agreementId.toString()}`);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ValidationResult;
  } catch {
    return null;
  }
}

function importantTerms(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s:/.-]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 4)
    .filter((term, index, terms) => terms.indexOf(term) === index)
    .slice(0, 24);
}
