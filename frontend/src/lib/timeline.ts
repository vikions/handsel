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
  const isReleased = agreement.status === 3;
  const isResolvedByArbiter = agreement.status === 5;
  const isSettled = isReleased || isResolvedByArbiter;

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
      label: isResolvedByArbiter && agreement.submittedAt === 0n ? "Delivery accepted by arbiter" : "Proof submitted",
      detail:
        isResolvedByArbiter && agreement.submittedAt === 0n
          ? "Arbiter closed the dispute and accepted the delivery path."
          : "Beneficiary submitted proof for client review.",
      timestamp: agreement.submittedAt > 0n ? agreement.submittedAt : isResolvedByArbiter ? agreement.completedAt : undefined,
      complete: agreement.submittedAt > 0n || isResolvedByArbiter,
    },
    {
      label: isSettled ? "Client / arbiter review" : "AI-assisted review",
      detail: reviewDetail(agreement.status, validation),
      timestamp: validation?.reviewedAt ?? (isSettled ? agreement.completedAt : undefined),
      complete: Boolean(validation) || isSettled,
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
  if (status === 5) return "Arbiter resolved the disputed funds. No further client action is required.";
  if (status === 6) return "Funds were refunded after expiration.";
  if (status === 7) return "Agreement was cancelled before acceptance.";
  return "Settlement is pending.";
}

function reviewDetail(status: number, validation: ValidationResult | null) {
  if (status === 3) return "Client approved the work and released the locked USDC.";
  if (status === 5) return "Arbiter made the final payout decision and closed client review.";
  return validation ? validation.summary : "Optional local recommendation has not been run.";
}
