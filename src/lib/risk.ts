import type { RiskLevel } from '../data/types';

export function fireRiskFromScore(score: number): RiskLevel {
  if (score >= 0.78) return 'CRITICAL';
  if (score >= 0.55) return 'HIGH';
  if (score >= 0.32) return 'MEDIUM';
  return 'LOW';
}

export const riskRank: Record<RiskLevel, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

export const riskColor: Record<RiskLevel, string> = {
  LOW: 'var(--ok)',
  MEDIUM: 'var(--warn)',
  HIGH: 'var(--risk)',
  CRITICAL: 'var(--crit)',
};

// hex versions for Google Maps overlays (cannot read CSS vars)
export const riskHex: Record<RiskLevel, string> = {
  LOW: '#3ecf8e',
  MEDIUM: '#f5c84b',
  HIGH: '#f4763b',
  CRITICAL: '#e5484d',
};

export const riskChipClass: Record<RiskLevel, string> = {
  LOW: 'ok',
  MEDIUM: 'warn',
  HIGH: 'risk',
  CRITICAL: 'risk',
};

export const riskLabelTh: Record<RiskLevel, string> = {
  LOW: 'ต่ำ',
  MEDIUM: 'ปานกลาง',
  HIGH: 'สูง',
  CRITICAL: 'วิกฤติ',
};

export function maxRisk(...levels: RiskLevel[]): RiskLevel {
  return levels.reduce((a, b) => (riskRank[b] > riskRank[a] ? b : a), 'LOW');
}
