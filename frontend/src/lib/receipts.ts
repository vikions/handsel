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

export function buildReceipt(agreement: ReceiptAgreement): Receipt {
  return {
    heading: agreement.title || `Handsel agreement #${agreement.id.toString()}`,
    status: agreement.statusLabel,
    parties: [
      { label: "Client", value: agreement.client },
      { label: "Worker", value: agreement.beneficiary },
      { label: "Resolver", value: agreement.arbiter },
    ],
    facts: [
      { label: "Agreement ID", value: `#${agreement.id.toString()}` },
      { label: "Amount", value: agreement.amountLabel },
      { label: "Settlement", value: settlementDescription(agreement.statusLabel, Boolean(agreement.proofURI)) },
      { label: "Criteria", value: agreement.criteriaURI || "No criteria supplied" },
      { label: "Proof", value: agreement.proofURI || "No proof submitted" },
    ],
  };
}

function settlementDescription(status: string, hasProof: boolean) {
  if (status === "Completed") {
    return hasProof ? "Client approved submitted proof and released USDC" : "Client used the manual release path";
  }
  if (status === "Resolved") return "Resolver distributed funds after a dispute";
  if (status === "Refunded") return "Expired agreement refunded to the client";
  if (status === "Cancelled") return "Client cancelled before worker acceptance";
  if (status === "Disputed") return "Awaiting resolver decision";
  return "Settlement pending";
}
