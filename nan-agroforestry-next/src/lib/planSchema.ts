import { z } from 'zod';

const layerSelection = z.object({
  canopy: z.array(z.string()).default([]),
  shrub: z.array(z.string()).default([]),
  groundcover: z.array(z.string()).default([]),
  root: z.array(z.string()).default([]),
});

export const farmInputSchema = z.object({
  currentCropId: z.string().nullable(),
  sizeRai: z.number().positive().max(500),
  elevationM: z.number().min(0).max(2600),
  locationLabel: z.string().min(1).max(120),
  lat: z.number().min(5).max(22).optional(),
  lng: z.number().min(97).max(106.5).optional(),
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
