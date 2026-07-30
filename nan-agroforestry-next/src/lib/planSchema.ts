import { z } from 'zod';
import { TH_LAT_MIN, TH_LAT_MAX, TH_LNG_MIN, TH_LNG_MAX, TH_ELEV_MIN, TH_ELEV_MAX } from './geoBounds';

const layerSelection = z.object({
  canopy: z.array(z.string()).default([]),
  shrub: z.array(z.string()).default([]),
  groundcover: z.array(z.string()).default([]),
  root: z.array(z.string()).default([]),
});

// Constrained to the list the UI actually offers. Left open, an arbitrary string reached
// engine.transitionContext's `TRANSITION_COST_PER_RAI[z.cropId]` lookup, and a plain object
// literal resolves inherited keys — so cropId "constructor" returned the Object function,
// `areaRai * Object` produced NaN, and the NaN propagated through every cashflow. Verified
// on production: transitionCost, profit10, paybackYear and all 10 cumulative values came
// back null while the agronomic sections still looked authoritative. `catch` maps anything
// unrecognised to 'อื่นๆ', which is the row TRANSITION_COST_PER_RAI already has a cost for.
export const KNOWN_CROP_IDS = [
  'ข้าวโพดเลี้ยงสัตว์', 'ข้าวไร่', 'มันสำปะหลัง', 'ยางพารา',
  'ไม้ผลผสม', 'สวนผสม', 'ป่า/ไม้ยืนต้นเดิม', 'พื้นที่ว่าง/เพิ่งถาง', 'พื้นที่เสื่อมโทรม', 'อื่นๆ',
] as const;

const cropIdSchema = z.enum(KNOWN_CROP_IDS).catch('อื่นๆ');

const existingZoneSchema = z.object({
  id: z.string().min(1).max(80),
  cropId: cropIdSchema,
  areaRai: z.number().positive().max(500),
  keepRatio: z.number().min(0).max(1).optional(),
  note: z.string().max(160).optional(),
});

export const farmInputSchema = z.object({
  currentCropId: cropIdSchema.nullable(),
  existingZones: z.array(existingZoneSchema).max(12).optional(),
  sizeRai: z.number().min(0.5).max(500),
  elevationM: z.number().min(TH_ELEV_MIN).max(TH_ELEV_MAX),
  locationLabel: z.string().min(1).max(120),
  lat: z.number().min(TH_LAT_MIN).max(TH_LAT_MAX).optional(),
  lng: z.number().min(TH_LNG_MIN).max(TH_LNG_MAX).optional(),
  selectedByLayer: layerSelection,
  goal: z.enum(['balanced', 'fast', 'profit']),
  targetAnnualIncome: z.number().positive().max(20_000_000).optional(),
  cropAssumptions: z.array(z.object({
    plantId: z.string(),
    plantsPerRai: z.number().positive().max(5000).optional(),
    totalPlants: z.number().positive().max(1_000_000).optional(),
    shareRai: z.number().positive().max(500).optional(),
    pricePerKg: z.number().positive().max(10000).optional(),
    yieldKgPerRai: z.number().positive().max(100000).optional(),
    establishCostPerRai: z.number().min(0).max(1_000_000).optional(),
    annualCostPerRai: z.number().min(0).max(1_000_000).optional(),
    cyclesPerYear: z.number().positive().max(24).optional(),
    survivalRate: z.number().min(0.1).max(1.2).optional(),
    validationStatus: z.enum(['model_suggested', 'expert_confirmed', 'needs_review', 'not_recommended']).optional(),
    expertNote: z.string().max(300).optional(),
  })).max(80).optional(),
});

/**
 * Drop crop overrides for plants the user has not actually selected.
 *
 * The advanced override editor only renders rows for `selectedByLayer`, so an override
 * attached to any other plant is invisible in the UI — yet engine.applyAssumption applies
 * assumptions to every candidate plant and still labels the pick `pickedBy: 'system'`.
 * That combination let a crafted ?plan= share link rewrite the economics of plants the
 * farmer never chose and have the result presented as the model's own recommendation.
 *
 * Applied on both sides of the wire: on share-link ingest in the client, and server-side
 * in runPlan so a direct POST cannot bypass it either.
 */
export function sanitizeAssumptions<T extends {
  selectedByLayer?: Record<string, string[]>;
  cropAssumptions?: Array<{ plantId: string }>;
}>(input: T): T {
  if (!input.cropAssumptions?.length) return input;
  const selected = new Set(Object.values(input.selectedByLayer ?? {}).flat());
  const kept = input.cropAssumptions.filter((a) => selected.has(a.plantId));
  if (kept.length === input.cropAssumptions.length) return input;
  return { ...input, cropAssumptions: kept };
}
