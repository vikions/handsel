import type { ValidationResult } from "./aiValidation";

export type TimelineAgreement = {
  status: number;
  createdAt: bigint;
  acceptedAt: bigint;
  submittedAt: bigint;
  completedAt: bigint;
};

export type TimelineEvent = {
  label: string;
  detail: string;
  timestamp?: bigint | string;
  complete: boolean;
};

export function buildTimeline(agreement: TimelineAgreement, validation: ValidationResult | null): TimelineEvent[] {
  return [
    {
      label: "Agreement created",
      detail: "Client defined criteria and locked USDC.",
      timestamp: agreement.createdAt,
      complete: agreement.createdAt > 0n,
    },
    {
      label: "Beneficiary accepted",
      detail: "Work can begin once the beneficiary accepts.",
      timestamp: agreement.acceptedAt,
      complete: agreement.acceptedAt > 0n,
    },
    {
      label: "Proof submitted",
      detail: "Beneficiary submitted proof for client review.",
      timestamp: agreement.submittedAt,
      complete: agreement.submittedAt > 0n,
    },
    {
      label: "AI-assisted review",
      detail: validation ? validation.summary : "Optional local MVP recommendation has not been run.",
      timestamp: validation?.reviewedAt,
      complete: Boolean(validation),
    },
    {
      label: "Settlement state",
      detail: settlementDetail(agreement.status),
      timestamp: agreement.completedAt,
      complete: agreement.status >= 3,
    },
  ];
}

function settlementDetail(status: number) {
  if (status === 3) return "Client approved release or used the manual release path.";
  if (status === 4) return "Agreement is disputed and awaits arbiter resolution.";
  if (status === 5) return "Arbiter resolved the disputed funds.";
  if (status === 6) return "Funds were refunded after expiration.";
  if (status === 7) return "Agreement was cancelled before acceptance.";
  return "Settlement is pending.";
}
