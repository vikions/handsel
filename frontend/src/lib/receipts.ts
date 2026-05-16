import type { ValidationResult } from "./aiValidation";

export type ReceiptAgreement = {
  id: bigint;
  client: string;
  beneficiary: string;
  arbiter: string;
  amountLabel: string;
  title: string;
  criteriaURI: string;
  proofURI: string;
  statusLabel: string;
};

export type Receipt = {
  heading: string;
  status: string;
  parties: Array<{ label: string; value: string }>;
  facts: Array<{ label: string; value: string }>;
};

export function buildReceipt(agreement: ReceiptAgreement, validation: ValidationResult | null): Receipt {
  return {
    heading: `Handsel receipt #${agreement.id.toString()}`,
    status: agreement.statusLabel,
    parties: [
      { label: "Client", value: agreement.client },
      { label: "Beneficiary", value: agreement.beneficiary },
      { label: "Arbiter", value: agreement.arbiter },
    ],
    facts: [
      { label: "Agreement", value: agreement.title || "Untitled agreement" },
      { label: "Amount", value: agreement.amountLabel },
      { label: "Criteria", value: agreement.criteriaURI || "No criteria supplied" },
      { label: "Proof", value: agreement.proofURI || "No proof submitted" },
      { label: "AI recommendation", value: validation?.recommendation.replace("_", " ") ?? "Not reviewed" },
    ],
  };
}
