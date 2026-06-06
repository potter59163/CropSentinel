// Nan multi-strata agroforestry planner — domain model
export type WaterNeed = 'low' | 'med' | 'high';
export type Goal = 'balanced' | 'fast' | 'profit';
export type Layer = 'canopy' | 'shrub' | 'groundcover' | 'root';

export interface Plant {
  id: string;
  nameTh: string;
  nameEn: string;
  emoji: string;
  layer: Layer;
  category: string;
  elevMin: number;
  elevMax: number;
  perennial: boolean;
  yearsToYield: number;
  yearsToMature: number;
  pricePerKg: number;
  yieldKgPerRai: number;
  shadeTol: number;     // 0..1 tolerance to shade
  canopyShade: number;  // 0..1 shade this plant casts
  nFixing: boolean;
  water: WaterNeed;
  establishCostPerRai: number;
  annualCostPerRai: number;
  cyclesPerYear: number;
  sdmId?: string;       // key into the trained SDM (woody species only)
  note: string;
}

export interface FarmInput {
  currentCropId: string | null;
  sizeRai: number;
  elevationM: number;
  locationLabel: string;
  lat?: number;
  lng?: number;
  selectedByLayer: Record<Layer, string[]>; // farmer preferences by forest layer
  goal: Goal;
}

export interface CashflowPoint { year: number; income: number; cost: number; net: number; cumulative: number }

export interface LayerPick {
  layer: Layer;
  plant: Plant;
  suitability: number;          // 0..1
  source: 'model' | 'envelope'; // model = trained SDM, envelope = expert range
  auc?: number;
  modelConfidence: 'high' | 'medium' | 'low' | 'expert';
  shareRai: number;
  pickedBy: 'farmer' | 'system';
  scoreParts: {
    suitability: number;
    economics: number;
    waterFit: number;
    riskFit: number;
    carbon: number;
  };
}

export interface SystemPlan {
  picks: LayerPick[];           // all layers in stack order
  canopy: LayerPick[];          // >=2
  cashflow: CashflowPoint[];
  paybackYear: number | null;
  profit10: number;
  annualAvg: number;
  suitability: number;          // mean across picks
  carbonPerYear: number;        // tCO2e/yr sequestered at maturity
  carbon10: number;             // cumulative tCO2e over 10 yr
  score: number;
  scoreParts: {
    suitability: number;
    economics: number;
    waterFit: number;
    riskFit: number;
    carbon: number;
    farmerFit: number;
  };
  badge: string;                // ดีที่สุด / เห็นผลไว / กำไรสูงสุด
  reasons: string[];
  warnings: string[];
}
