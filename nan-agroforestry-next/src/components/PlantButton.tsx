import { ReactNode } from 'react';
import { PlantIcon } from './PlantIcon';

interface PlantButtonProps {
  plantId: string;
  nameTh: string;
  nameEn?: string;
  isSelected?: boolean;
  onClick: () => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'card' | 'tag';
  confidence?: number; // 0..1 for SDM confidence
}

const sizeClasses = {
  sm: 'px-3 py-2 text-xs',
  md: 'px-4 py-3 text-sm',
  lg: 'px-5 py-4 text-base',
};

/* Boba tea theme - warm gradient backgrounds */
const layerGradients: Record<string, string> = {
  // Canopy layers - warm browns/golds
  mango: 'from-orange-100 to-yellow-50',
  longan: 'from-amber-100 to-yellow-50',
  banana: 'from-yellow-100 to-yellow-50',
  cashew: 'from-orange-100 to-amber-50',
  avocado: 'from-green-100 to-emerald-50',
  macadamia: 'from-amber-100 to-orange-50',
  maikhwaen: 'from-red-100 to-rose-50',
  bamboo: 'from-teal-100 to-green-50',
  teak: 'from-amber-100 to-yellow-50',

  // Shrub - warm palettes
  coffee: 'from-amber-100 to-yellow-50',
  chili: 'from-red-100 to-rose-50',
  tea: 'from-emerald-100 to-green-50',
  lemongrass: 'from-lime-100 to-yellow-50',

  // Groundcover - sunny
  peanut: 'from-yellow-100 to-amber-50',
  pumpkin: 'from-orange-100 to-yellow-50',
  sweetpotato: 'from-orange-100 to-red-50',
  pineapple: 'from-yellow-100 to-orange-50',

  // Root - earth tones
  ginger: 'from-yellow-100 to-orange-50',
  turmeric: 'from-yellow-100 to-amber-50',
  taro: 'from-purple-100 to-violet-50',
  galangal: 'from-orange-100 to-amber-50',
};

const confidenceColors = {
  high: 'border-green-400 shadow-md shadow-green-100',
  medium: 'border-amber-400 shadow-md shadow-amber-100',
  low: 'border-orange-400 shadow-md shadow-orange-100',
};

function getConfidenceLevel(confidence?: number): 'high' | 'medium' | 'low' {
  if (!confidence) return 'low';
  if (confidence >= 0.7) return 'high';
  if (confidence >= 0.4) return 'medium';
  return 'low';
}

export function PlantButton({
  plantId,
  nameTh,
  nameEn,
  isSelected = false,
  onClick,
  size = 'md',
  variant = 'card',
  confidence,
}: PlantButtonProps) {
  const gradient = layerGradients[plantId] || 'from-amber-50 to-yellow-50';
  const confLevel = getConfidenceLevel(confidence);
  const confColor = confidence ? confidenceColors[confLevel] : '';

  if (variant === 'tag') {
    return (
      <button
        onClick={onClick}
        className={`
          ${sizeClasses[size]} 
          inline-flex items-center gap-2 rounded-full
          border-2 transition-all duration-300
          ${isSelected
            ? 'border-green-500 bg-green-50 text-green-900 shadow-md'
            : 'border-gray-200 bg-white text-gray-700 hover:border-green-400 hover:shadow-md'
          }
        `}
      >
        <PlantIcon plantId={plantId} size={size === 'sm' ? 'sm' : 'md'} />
        <span className="font-semibold">{nameTh}</span>
        {isSelected && <span className="text-lg">✓</span>}
      </button>
    );
  }

  // Card variant (default)
  return (
    <button
      onClick={onClick}
      className={`
        group w-full rounded-2xl border-3 transition-all duration-300
        bg-gradient-to-br ${gradient}
        ${isSelected
          ? `border-green-500 ring-2 ring-green-200 shadow-lg ${confColor}`
          : 'border-gray-200 hover:border-orange-300 hover:shadow-lg'
        }
        hover:shadow-lg hover:-translate-y-1
        focus:outline-none focus:ring-2 focus:ring-orange-400
        active:scale-95
      `}
    >
      <div className={`flex flex-col items-center justify-center gap-2 ${sizeClasses[size]}`}>
        <div className="relative">
          <PlantIcon plantId={plantId} size="lg" className="animate-fade-in" />
          {isSelected && (
            <div className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white text-sm font-bold shadow-lg animate-bounce-in">
              ✓
            </div>
          )}
        </div>

        <div className="text-center">
          <div className="font-semibold text-gray-800">{nameTh}</div>
          {nameEn && (
            <div className="text-xs text-gray-500 italic">{nameEn}</div>
          )}
        </div>

        {confidence && (
          <div className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium
            ${confLevel === 'high' ? 'bg-green-100 text-green-700' : ''}
            ${confLevel === 'medium' ? 'bg-amber-100 text-amber-700' : ''}
            ${confLevel === 'low' ? 'bg-orange-100 text-orange-700' : ''}
          `}>
            {confLevel === 'high' && '✓ ดี'}
            {confLevel === 'medium' && '◐ ปานกลาง'}
            {confLevel === 'low' && '◐ ต่ำ'}
            <span className="ml-0.5 text-xs">{Math.round(confidence * 100)}%</span>
          </div>
        )}
      </div>

      {/* Hover accent */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-green-400/5 to-transparent" />
      </div>
    </button>
  );
}

// ── PLANT SELECTION SECTION ──

interface PlantSectionProps {
  title: string;
  subtitle?: string;
  layer: 'canopy' | 'shrub' | 'groundcover' | 'root';
  plants: Array<{
    id: string;
    nameTh: string;
    nameEn?: string;
    confidence?: number;
  }>;
  selected: string[];
  onSelect: (plantId: string) => void;
}

const layerColors: Record<string, { emoji: string; bgClass: string; borderClass: string }> = {
  canopy: { emoji: '🌳', bgClass: 'bg-gradient-to-b from-orange-50 to-transparent', borderClass: 'border-l-4 border-orange-300' },
  shrub: { emoji: '🌿', bgClass: 'bg-gradient-to-b from-green-50 to-transparent', borderClass: 'border-l-4 border-green-300' },
  groundcover: { emoji: '🍃', bgClass: 'bg-gradient-to-b from-yellow-50 to-transparent', borderClass: 'border-l-4 border-yellow-300' },
  root: { emoji: '🫚', bgClass: 'bg-gradient-to-b from-purple-50 to-transparent', borderClass: 'border-l-4 border-purple-300' },
};

export function PlantSection({ title, subtitle, layer, plants, selected, onSelect }: PlantSectionProps) {
  const layerStyle = layerColors[layer];

  return (
    <div className={`rounded-xl ${layerStyle.bgClass} ${layerStyle.borderClass} px-4 py-5 sm:px-6`}>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {layerStyle.emoji} {title}
          </h3>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
          )}
        </div>
        <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm">
          {selected.length} selected
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {plants.map((plant) => (
          <PlantButton
            key={plant.id}
            plantId={plant.id}
            nameTh={plant.nameTh}
            nameEn={plant.nameEn}
            isSelected={selected.includes(plant.id)}
            onClick={() => onSelect(plant.id)}
            size="md"
            variant="card"
            confidence={plant.confidence}
          />
        ))}
      </div>
    </div>
  );
}
