// Shared loan math — used by both the Express server and the React client.

export const TERMS = [
  { days: 91, monthlyRate: 0.04 },
  { days: 120, monthlyRate: 0.035 },
  { days: 180, monthlyRate: 0.03 },
  { days: 270, monthlyRate: 0.025 },
  { days: 365, monthlyRate: 0.02 },
] as const;

export const MIN_AMOUNT = 10_000;
export const MAX_AMOUNT = 300_000;

export function termInfo(days: number) {
  return TERMS.find((t) => t.days === days) ?? TERMS[2];
}

export interface LoanFigures {
  monthlyRate: number;
  interest: number;
  total: number;
  monthly: number;
  months: number;
  dueDate: Date;
}

export function computeLoan(principal: number, days: number, now = new Date()): LoanFigures {
  const { monthlyRate } = termInfo(days);
  const months = days / 30;
  const interest = principal * monthlyRate * months;
  const total = principal + interest;
  return {
    monthlyRate,
    interest,
    total,
    monthly: total / months,
    months: Math.ceil(months),
    dueDate: new Date(now.getTime() + days * 86_400_000),
  };
}

export const naira = (value: number) =>
  "₦" + Math.round(value).toLocaleString("en-NG");

export const formatDate = (iso: string | Date) =>
  new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
