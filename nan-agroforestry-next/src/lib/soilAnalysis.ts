// Soil analysis based on location characteristics
// Deterministic mapping of elevation/coordinates to soil properties

export interface SoilData {
  soilType: string;
  ph: number;
  nitrogen: 'Low' | 'Medium' | 'High';
  phosphorus: 'Low' | 'Medium' | 'High';
  potassium: 'Low' | 'Medium' | 'High';
  texture: string;
  drainage: string;
  color: string;
  suitableCrops: string[];
  description: string;
}

/**
 * Analyze soil based on elevation and geographic coordinates
 * Uses deterministic algorithm for consistency across regions
 */
export function analyzeSoilByLocation(
  lat: number,
  lng: number,
  elevationM: number
): SoilData {
  // Deterministic hash based on location
  const latHash = Math.abs(Math.sin(lat * 12.9898) * 43758.5453);
  const lngHash = Math.abs(Math.sin(lng * 78.233) * 43758.5453);
  const elevHash = Math.abs(Math.sin((elevationM / 1000) * 45.164) * 43758.5453);
  const combined = (latHash + lngHash + elevHash) % 1;

  // Soil types for Nan province and surroundings
  const soilTypes = [
    {
      type: 'Red Latosol',
      ph: 5.2,
      nitrogen: 'Low' as const,
      phosphorus: 'Low' as const,
      potassium: 'Medium' as const,
      texture: 'Clay loam',
      drainage: 'Well drained',
      color: '#8B4513',
      description: 'Acidic laterite soil common in highland areas, suitable for tree crops',
      crops: ['Tea', 'Coffee', 'Avocado', 'Macadamia']
    },
    {
      type: 'Alluvial Soil',
      ph: 6.8,
      nitrogen: 'High' as const,
      phosphorus: 'Medium' as const,
      potassium: 'High' as const,
      texture: 'Silt loam',
      drainage: 'Moderately well drained',
      color: '#D2B48C',
      description: 'Fertile soil in river valleys, excellent for most crops',
      crops: ['Rice', 'Banana', 'Coconut', 'Sugarcane']
    },
    {
      type: 'Brown Forest Soil',
      ph: 5.8,
      nitrogen: 'Medium' as const,
      phosphorus: 'Medium' as const,
      potassium: 'Medium' as const,
      texture: 'Loam',
      drainage: 'Well drained',
      color: '#8B7355',
      description: 'Moderate fertility soil in mid-altitude areas',
      crops: ['Corn', 'Cassava', 'Peanut', 'Ginger']
    },
    {
      type: 'Mountain Clay Soil',
      ph: 5.4,
      nitrogen: 'Low' as const,
      phosphorus: 'Low' as const,
      potassium: 'Low' as const,
      texture: 'Clay',
      drainage: 'Poorly drained',
      color: '#696969',
      description: 'Steep highland soil requiring conservation, suitable for agroforestry',
      crops: ['Teak', 'Bamboo', 'Mango', 'Longan']
    }
  ];

  // Select soil type based on elevation
  let soilTypeIndex = 0;
  if (elevationM < 300) {
    soilTypeIndex = 1; // Alluvial in lowlands
  } else if (elevationM < 600) {
    soilTypeIndex = 2; // Brown forest soil in mid-altitude
  } else if (elevationM < 900) {
    soilTypeIndex = 0; // Red latosol in highlands
  } else {
    soilTypeIndex = 3; // Mountain clay in high altitude
  }

  // Add variation based on lat/lng hash
  soilTypeIndex = (soilTypeIndex + Math.floor(combined * soilTypes.length)) % soilTypes.length;

  const selected = soilTypes[soilTypeIndex];

  // Fine-tune pH and nutrient levels based on location hash
  const phVariation = (combined - 0.5) * 0.8; // ±0.4 pH units
  const npkVariation = Math.floor(combined * 3);

  const npkLevels = ['Low', 'Medium', 'High'] as const;

  return {
    soilType: selected.type,
    ph: Math.round((selected.ph + phVariation) * 10) / 10,
    nitrogen: npkLevels[(npkLevels.indexOf(selected.nitrogen) + npkVariation) % 3],
    phosphorus: npkLevels[(npkLevels.indexOf(selected.phosphorus) + npkVariation + 1) % 3],
    potassium: npkLevels[(npkLevels.indexOf(selected.potassium) + npkVariation + 2) % 3],
    texture: selected.texture,
    drainage: selected.drainage,
    color: selected.color,
    suitableCrops: selected.crops,
    description: selected.description
  };
}

/**
 * Filter plant database recommendations based on soil characteristics
 */
export function filterPlantsBySoil(
  soilData: SoilData,
  allPlants: Array<{ id: string; nameTh: string; nameEn: string; elevation: { min: number; max: number } }>
): Array<{ id: string; score: number }> {
  const suitableCropIds = soilData.suitableCrops;

  return allPlants
    .map((plant) => {
      let score = 0;

      // Match with suitable crops
      if (
        suitableCropIds.some((crop) =>
          plant.nameEn.toLowerCase().includes(crop.toLowerCase()) ||
          plant.nameTh.includes(crop)
        )
      ) {
        score += 40;
      }

      // Soil preference logic
      if (soilData.ph >= 5.5 && soilData.ph <= 7.5) {
        score += 20; // Most crops prefer neutral to slightly acidic
      }

      // Nitrogen-fixing plants benefit from low N
      if ((plant.nameEn.includes('Pea') || plant.nameTh.includes('ถั่ว')) && soilData.nitrogen === 'Low') {
        score += 15;
      }

      return { id: plant.id, score };
    })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score);
}
