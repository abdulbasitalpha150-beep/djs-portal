export interface CommissionTier {
  id: string;
  label: string;
  threshold: number;
  percent: number;
}

export const COMMISSION_TIERS: CommissionTier[] = [
  { id: "platinum", label: "Platinum", threshold: 150000, percent: 18 },
  { id: "gold", label: "Gold", threshold: 100000, percent: 15 },
  { id: "silver", label: "Silver", threshold: 50000, percent: 12 },
  { id: "bronze", label: "Bronze", threshold: 20000, percent: 10 },
  { id: "standard", label: "Standard", threshold: 0, percent: 8 },
];

export function determineCommissionTier(monthlyGrossMargin: number) {
  const tier = COMMISSION_TIERS.find((tier) => monthlyGrossMargin >= tier.threshold);
  return tier ?? COMMISSION_TIERS[COMMISSION_TIERS.length - 1];
}

export function calculateCommission(grossMarginAmount: number) {
  const tier = determineCommissionTier(grossMarginAmount);
  const commissionAmount = Number(((grossMarginAmount * tier.percent) / 100).toFixed(2));
  return {
    commissionTier: tier.label,
    commissionPercent: tier.percent,
    commissionAmount,
  };
}
