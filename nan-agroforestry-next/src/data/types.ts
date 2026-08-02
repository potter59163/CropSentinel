// Nan multi-strata agroforestry planner — domain model
export type WaterNeed = 'low' | 'med' | 'high';
export type Goal = 'balanced' | 'fast' | 'profit';
export type Layer = 'canopy' | 'shrub' | 'groundcover' | 'root';
export type ValidationStatus = 'model_suggested' | 'expert_confirmed' | 'needs_review' | 'not_recommended';

/**
 * วิสัย — what the plant actually IS, botanically. Separate from `layer`, which is only
 * where it sits in the canopy.
 *
 * The two were conflated before: the top layer was labelled "ไม้ยืนต้น" (perennial tree)
 * while holding ไผ่ (a grass) and กล้วย (a giant herb). Thai agroforestry references name
 * strata by HEIGHT/POSITION precisely so that a bamboo clump, a banana and a palm can share
 * a height band without anyone claiming they are trees — so the layer axis is now positional
 * and the botany lives here, per species, where it is true.
 */
export type Habit =
  | 'ไม้ต้น'            // true woody tree, single main trunk
  | 'ไม้พุ่ม'           // woody shrub, multi-stemmed
  | 'ไผ่'               // bamboo — woody clumping GRASS (Poaceae)
  | 'ไม้ล้มลุก'         // herbaceous, no wood
  | 'ไม้ล้มลุกขนาดใหญ่' // giant herb — banana's pseudostem is leaf sheaths, not wood
  | 'ไม้เถา'            // vine / climber
  | 'หญ้า'              // true grass
  | 'เฟิร์น';           // pteridophyte — not a flowering plant at all

export interface Plant {
  id: string;
  nameTh: string;
  nameEn: string;
  layer: Layer;
  /** วิสัย — see Habit. Shown to the farmer as a chip so the layer never has to imply it. */
  habit: Habit;
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
  existingZones?: ExistingZone[];
  sizeRai: number;
  elevationM: number;
  locationLabel: string;
  lat?: number;
  lng?: number;
  selectedByLayer: Record<Layer, string[]>; // farmer preferences by forest layer
  goal: Goal;
  targetAnnualIncome?: number;
  cropAssumptions?: CropAssumption[];
  /**
   * What sits on the other side of the boundary — see NeighbourFuel in lib/layout.ts.
   *
   * Fire risk on a Nan plot depends more on the NEIGHBOUR than on the plot itself: measured
   * flame lengths run 1.34 m off standing forest but 12.82 m off ไร่เหล่า, which no achievable
   * firebreak width out-reaches. The app carried those measurements for a while without ever
   * asking the question, so every farmer got the generic answer.
   */
  neighbourFuel?: 'maize' | 'forest' | 'fallow' | 'unknown';
}

export interface CashflowPoint { year: number; income: number; cost: number; net: number; cumulative: number }

export interface ExistingZone {
  id: string;
  cropId: string;
  areaRai: number;
  keepRatio?: number;
  note?: string;
}

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
    /** Relative woody permanence — see WOODY_STRUCTURE_INDEX in data/plants.ts. */
    woodyStructure: number;
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
  productProfit10: number;
  transitionCost: number;
  transitionNotes: string[];
  score: number;
  scoreParts: {
    agroforestry: number;
    suitability: number;
    economics: number;
    waterFit: number;
    riskFit: number;
    /** Relative woody permanence — see WOODY_STRUCTURE_INDEX in data/plants.ts. */
    woodyStructure: number;
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
