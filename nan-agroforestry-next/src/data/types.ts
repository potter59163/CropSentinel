// Nan multi-strata agroforestry planner — domain model
export type WaterNeed = 'low' | 'med' | 'high';
export type Goal = 'balanced' | 'fast' | 'profit';
export type Layer = 'canopy' | 'shrub' | 'groundcover' | 'root';
export type ValidationStatus = 'model_suggested' | 'expert_confirmed' | 'needs_review' | 'not_recommended';

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
  sdmId?: string;       // key into the trained SDM when GBIF data is sufficient
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
  targetAnnualIncome?: number;
  cropAssumptions?: CropAssumption[];
}

export interface CashflowPoint { year: number; income: number; cost: number; net: number; cumulative: number }

export interface CropAssumption {
  plantId: string;
  plantsPerRai?: number;
  totalPlants?: number;
  shareRai?: number;
  pricePerKg?: number;
  yieldKgPerRai?: number;
  establishCostPerRai?: number;
  annualCostPerRai?: number;
  cyclesPerYear?: number;
  survivalRate?: number; // 0..1, applied to expected yield
  validationStatus?: ValidationStatus;
  expertNote?: string;
}

export interface SensitivityScenario {
  id: 'down30' | 'base' | 'up30';
  label: string;
  priceMultiplier: number;
  profit10: number;
  annualAvg: number;
  paybackYear: number | null;
  cashflow: CashflowPoint[];
}

export interface SoilHealthProxy {
  score: number;
  label: 'ดี' | 'ปานกลาง' | 'เสี่ยงเสื่อม';
  signals: string[];
  limitations: string[];
}

export interface LayerPick {
  layer: Layer;
  plant: Plant;
  suitability: number;          // 0..1
  source: 'model' | 'envelope'; // model = trained SDM, envelope = expert range
  auc?: number;
  modelConfidence: 'high' | 'medium' | 'low' | 'expert';
  shareRai: number;
  pickedBy: 'farmer' | 'system';
  plantsPerRai?: number;
  totalPlants?: number;
  validationStatus: ValidationStatus;
  expertNote?: string;
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
  productProfit10: number;
  ecosystemValue10: number;
  score: number;
  scoreParts: {
    agroforestry: number;
    suitability: number;
    economics: number;
    waterFit: number;
    riskFit: number;
    carbon: number;
    farmerFit: number;
  };
  agroforestryParts: {
    strata: number;
    diversity: number;
    shade: number;
    soilCover: number;
    incomeContinuity: number;
    riskBuffer: number;
  };
  badge: string;                // ดีที่สุด / เห็นผลไว / กำไรสูงสุด
  reasons: string[];
  warnings: string[];
  sensitivity: SensitivityScenario[];
  soilHealth: SoilHealthProxy;
}
