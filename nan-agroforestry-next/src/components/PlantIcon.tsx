/**
 * Cute Boba Tea Theme Plant Icons
 * Simple, rounded shapes + warm colors
 * Style: Playful, emoji-like but refined
 */

interface PlantIconProps {
  plantId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = { sm: 24, md: 40, lg: 56 };

export function PlantIcon({ plantId, size = 'md', className = '' }: PlantIconProps) {
  const s = sizeMap[size];

  // Canopy (tall trees)
  if (plantId === 'mango') return <MangoIcon size={s} />;
  if (plantId === 'longan') return <LonganIcon size={s} />;
  if (plantId === 'banana') return <BananaIcon size={s} />;
  if (plantId === 'cashew') return <CashewIcon size={s} />;
  if (plantId === 'avocado') return <AvocadoIcon size={s} />;
  if (plantId === 'macadamia') return <MacadamiaIcon size={s} />;
  if (plantId === 'maikhwaen') return <MaikhwaenIcon size={s} />;
  if (plantId === 'bamboo') return <BambooIcon size={s} />;
  if (plantId === 'teak') return <TeakIcon size={s} />;

  // Shrub
  if (plantId === 'coffee') return <CoffeeIcon size={s} />;
  if (plantId === 'chili') return <ChiliIcon size={s} />;
  if (plantId === 'tea') return <TeaIcon size={s} />;
  if (plantId === 'lemongrass') return <LemongrassIcon size={s} />;

  // Groundcover
  if (plantId === 'peanut') return <PeanutIcon size={s} />;
  if (plantId === 'pumpkin') return <PumpkinIcon size={s} />;
  if (plantId === 'sweetpotato') return <SweetpotatoIcon size={s} />;
  if (plantId === 'pineapple') return <PineappleIcon size={s} />;

  // Root
  if (plantId === 'ginger') return <GingerIcon size={s} />;
  if (plantId === 'turmeric') return <TurmericIcon size={s} />;
  if (plantId === 'taro') return <TaroIcon size={s} />;
  if (plantId === 'galangal') return <GalangalIcon size={s} />;

  return <DefaultIcon size={s} />;
}

// ── CANOPY TREES ──

function MangoIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="animate-fade-in">
      <circle cx="32" cy="20" r="14" fill="#a97c4a" stroke="#6b5435" strokeWidth="1.5" opacity="0.3" />
      <ellipse cx="32" cy="18" rx="12" ry="13" fill="#d4a574" stroke="#8b6f47" strokeWidth="1.5" />
      <path d="M 32 31 Q 20 38 20 48 Q 20 52 32 56 Q 44 52 44 48 Q 44 38 32 31" fill="#7a6b4f" stroke="#5a5237" strokeWidth="1.5" />
      <circle cx="26" cy="18" r="4" fill="#c99b6b" opacity="0.6" />
    </svg>
  );
}

function LonganIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="animate-fade-in">
      <circle cx="32" cy="16" r="13" fill="#9b7c5c" stroke="#6b5b47" strokeWidth="1.5" opacity="0.3" />
      <ellipse cx="32" cy="14" rx="11" ry="12" fill="#c9a378" stroke="#8b7355" strokeWidth="1.5" />
      <path d="M 32 26 Q 20 33 18 45 Q 18 50 32 54 Q 46 50 46 45 Q 44 33 32 26" fill="#6b5c4a" stroke="#4a4237" strokeWidth="1.5" />
      <circle cx="28" cy="14" r="3.5" fill="#e6c59f" opacity="0.5" />
      <circle cx="36" cy="16" r="2.5" fill="#d4b585" opacity="0.5" />
    </svg>
  );
}

function BananaIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="animate-fade-in">
      <path d="M 20 16 Q 24 10 30 12 Q 38 14 42 24 Q 44 32 40 40" fill="none" stroke="#c4b84d" strokeWidth="8" strokeLinecap="round" opacity="0.8" />
      <path d="M 20 16 Q 24 10 30 12 Q 38 14 42 24 Q 44 32 40 40" fill="none" stroke="#e5d76d" strokeWidth="5.5" strokeLinecap="round" />
      <ellipse cx="44" cy="40" rx="4" ry="6" fill="#8b7a35" opacity="0.6" />
    </svg>
  );
}

function CashewIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="animate-fade-in">
      <circle cx="32" cy="18" r="12" fill="#9d8b6f" stroke="#6b5a47" strokeWidth="1.5" opacity="0.3" />
      <ellipse cx="32" cy="16" rx="11" ry="11" fill="#c4a883" stroke="#8b7355" strokeWidth="1.5" />
      <path d="M 32 27 Q 20 34 20 44 Q 20 50 32 54 Q 44 50 44 44 Q 44 34 32 27" fill="#7a6b57" stroke="#4a4237" strokeWidth="1.5" />
      <path d="M 40 38 L 48 44 Q 50 46 48 50 L 42 48" fill="#b8956e" stroke="#6b5a47" strokeWidth="1" />
    </svg>
  );
}

function AvocadoIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="animate-fade-in">
      <ellipse cx="32" cy="20" rx="13" ry="14" fill="#5a6b4a" stroke="#3a4a2a" strokeWidth="1.5" />
      <path d="M 32 34 Q 20 40 20 50 Q 20 54 32 58 Q 44 54 44 50 Q 44 40 32 34" fill="#6b7c5a" stroke="#4a5237" strokeWidth="1.5" />
      <circle cx="32" cy="22" r="5" fill="#c9b5a0" opacity="0.7" />
    </svg>
  );
}

function MacadamiaIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="animate-fade-in">
      <circle cx="32" cy="18" r="14" fill="#8b7355" stroke="#5a4a37" strokeWidth="1.5" opacity="0.3" />
      <circle cx="32" cy="16" r="12" fill="#b8956e" stroke="#7a6b57" strokeWidth="1.5" />
      <path d="M 32 28 Q 20 35 20 45 Q 20 51 32 55 Q 44 51 44 45 Q 44 35 32 28" fill="#6b5c4a" stroke="#4a3a2a" strokeWidth="1.5" />
      <circle cx="32" cy="16" r="5" fill="#d9c7b0" opacity="0.6" />
      <circle cx="26" cy="22" r="3" fill="#e6d9c3" opacity="0.5" />
    </svg>
  );
}

function MaikhwaenIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="animate-fade-in">
      <circle cx="32" cy="18" r="11" fill="#8b5c3a" stroke="#5a3c1a" strokeWidth="1.5" opacity="0.3" />
      <ellipse cx="32" cy="16" rx="10" ry="11" fill="#c4735c" stroke="#8b4a37" strokeWidth="1.5" />
      <path d="M 32 27 Q 22 33 22 44 Q 22 50 32 54 Q 42 50 42 44 Q 42 33 32 27" fill="#7a3a27" stroke="#4a2a17" strokeWidth="1.5" />
      <circle cx="28" cy="16" r="2.5" fill="#d9a587" opacity="0.6" />
      <circle cx="36" cy="18" r="2" fill="#e6b89f" opacity="0.5" />
    </svg>
  );
}

function BambooIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="animate-fade-in">
      <rect x="28" y="10" width="8" height="44" rx="2" fill="#7a9b5a" stroke="#5a7b3a" strokeWidth="1.5" />
      <ellipse cx="32" cy="12" rx="5" ry="3" fill="#a0c875" stroke="#7a9b5a" strokeWidth="1" />
      <g opacity="0.7">
        <line x1="20" y1="24" x2="32" y2="22" stroke="#8b9c6a" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="44" y1="28" x2="32" y2="30" stroke="#8b9c6a" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="18" y1="40" x2="32" y2="38" stroke="#8b9c6a" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function TeakIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="animate-fade-in">
      <ellipse cx="32" cy="18" rx="13" ry="14" fill="#8b7b6b" stroke="#5a5245" strokeWidth="1.5" opacity="0.3" />
      <ellipse cx="32" cy="16" rx="12" ry="13" fill="#a89b89" stroke="#7a6d5a" strokeWidth="1.5" />
      <path d="M 32 29 Q 20 36 20 48 Q 20 53 32 57 Q 44 53 44 48 Q 44 36 32 29" fill="#6b5c4a" stroke="#3a2a1a" strokeWidth="1.5" />
      <circle cx="32" cy="16" r="4" fill="#c9b5a0" opacity="0.6" />
    </svg>
  );
}

// ── SHRUB ──

function CoffeeIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="animate-fade-in">
      <ellipse cx="32" cy="16" rx="10" ry="11" fill="#6b5437" stroke="#3a2a17" strokeWidth="1.5" />
      <path d="M 32 27 Q 22 32 22 42 Q 22 47 32 51 Q 42 47 42 42 Q 42 32 32 27" fill="#8b6f47" stroke="#5a4a2a" strokeWidth="1.5" />
      <circle cx="28" cy="14" r="3" fill="#a0785a" opacity="0.5" />
      <circle cx="36" cy="16" r="2.5" fill="#8b6f57" opacity="0.5" />
    </svg>
  );
}

function ChiliIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="animate-fade-in">
      <path d="M 32 8 Q 35 12 34 16 Q 34 20 32 24 Q 30 20 30 16 Q 29 12 32 8" fill="#d9453a" stroke="#8b2a1f" strokeWidth="1.5" />
      <ellipse cx="32" cy="26" rx="10" ry="8" fill="#c4735c" stroke="#8b4a37" strokeWidth="1.5" />
      <ellipse cx="32" cy="28" rx="9" ry="7" fill="#d9857d" opacity="0.7" />
      <path d="M 28 16 L 26 10 Q 26 8 28 8" stroke="#8b5c3a" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TeaIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="animate-fade-in">
      <ellipse cx="32" cy="16" rx="10" ry="10" fill="#5a7c3a" stroke="#3a5a1a" strokeWidth="1.5" />
      <path d="M 32 26 Q 22 31 22 41 Q 22 46 32 50 Q 42 46 42 41 Q 42 31 32 26" fill="#7a9c5a" stroke="#5a7c3a" strokeWidth="1.5" />
      <circle cx="28" cy="14" r="3.5" fill="#8aac7a" opacity="0.6" />
      <circle cx="36" cy="14" r="3" fill="#6a8c5a" opacity="0.5" />
    </svg>
  );
}

function LemongrassIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="animate-fade-in">
      <g opacity="0.7">
        <path d="M 28 8 L 26 50" stroke="#9cbb5a" strokeWidth="2" strokeLinecap="round" />
        <path d="M 32 8 L 32 52" stroke="#b0d170" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M 36 8 L 38 50" stroke="#9cbb5a" strokeWidth="2" strokeLinecap="round" />
        <path d="M 24 12 L 22 48" stroke="#8aab4a" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <path d="M 40 12 L 42 48" stroke="#8aab4a" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      </g>
    </svg>
  );
}

// ── GROUNDCOVER ──

function PeanutIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="animate-fade-in">
      <ellipse cx="32" cy="20" rx="10" ry="9" fill="#a89470" stroke="#6b5a3a" strokeWidth="1.5" />
      <ellipse cx="32" cy="22" rx="9" ry="8" fill="#c9b8a0" stroke="#8b7a5a" strokeWidth="1" />
      <path d="M 24 28 Q 22 35 22 42 Q 22 46 32 50 Q 42 46 42 42 Q 42 35 40 28" fill="#7a6b57" stroke="#4a3a27" strokeWidth="1.5" />
      <ellipse cx="26" cy="18" rx="3" ry="3.5" fill="#d9c7b0" opacity="0.5" />
    </svg>
  );
}

function PumpkinIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="animate-fade-in">
      <circle cx="32" cy="24" r="14" fill="#d97a2a" stroke="#a54a0a" strokeWidth="1.5" />
      <path d="M 32 24 L 32 10 M 20 24 L 8 24 M 44 24 L 56 24 M 22 32 L 12 38 M 42 32 L 52 38" stroke="#8b5a1a" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M 32 10 Q 28 6 26 10 Q 28 8 32 8 Q 36 8 38 10 Q 36 6 32 10" fill="#6b8c3a" stroke="#4a6a1a" strokeWidth="1" />
      <ellipse cx="32" cy="30" rx="10" ry="8" fill="#b8653a" stroke="#7a3a1a" strokeWidth="1" opacity="0.8" />
    </svg>
  );
}

function SweetpotatoIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="animate-fade-in">
      <ellipse cx="32" cy="22" rx="9" ry="8" fill="#c98a5a" stroke="#8b5a2a" strokeWidth="1.5" />
      <path d="M 24 30 Q 22 38 24 46 Q 26 52 32 54 Q 38 52 40 46 Q 42 38 40 30" fill="#8b6a47" stroke="#5a4a27" strokeWidth="1.5" />
      <path d="M 28 18 L 26 6 Q 26 4 28 8 L 28 18" fill="#7a9c5a" stroke="#4a7a2a" strokeWidth="1" />
      <ellipse cx="32" cy="24" rx="4" ry="4" fill="#d9a585" opacity="0.5" />
    </svg>
  );
}

function PineappleIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="animate-fade-in">
      <ellipse cx="32" cy="28" rx="12" ry="13" fill="#e5c43a" stroke="#a59c1a" strokeWidth="1.5" />
      <g opacity="0.6" stroke="#8b8c1a" strokeWidth="1">
        <line x1="22" y1="20" x2="28" y2="28" strokeLinecap="round" />
        <line x1="32" y1="18" x2="32" y2="26" strokeLinecap="round" />
        <line x1="42" y1="20" x2="36" y2="28" strokeLinecap="round" />
        <line x1="20" y1="32" x2="28" y2="34" strokeLinecap="round" />
        <line x1="44" y1="32" x2="36" y2="34" strokeLinecap="round" />
      </g>
      <path d="M 28 14 L 32 8 L 36 14 Q 34 12 32 12 Q 30 12 28 14" fill="#7a9c5a" stroke="#4a7a2a" strokeWidth="1" />
    </svg>
  );
}

// ── ROOT CROPS ──

function GingerIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="animate-fade-in">
      <ellipse cx="32" cy="28" rx="11" ry="10" fill="#c99a5a" stroke="#8b6a2a" strokeWidth="1.5" />
      <path d="M 26 20 L 22 8 Q 22 6 24 8 L 26 20 M 36 20 L 40 6 Q 40 4 38 6 L 36 20 M 32 20 L 32 4 Q 32 2 32 4 L 32 20" stroke="#7a9c5a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M 20 38 L 18 50 Q 18 52 20 50 L 20 38 M 44 38 L 46 50 Q 46 52 44 50 L 44 38" stroke="#8b6a4a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function TurmericIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="animate-fade-in">
      <ellipse cx="32" cy="26" rx="10" ry="9" fill="#d9a844" stroke="#8b7a1a" strokeWidth="1.5" />
      <path d="M 28 18 L 26 4 Q 26 2 28 4 L 28 18 M 36 18 L 38 4 Q 38 2 36 4 L 36 18" stroke="#6a8c5a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M 22 35 L 18 50 L 18 54 M 42 35 L 46 50 L 46 54" stroke="#8b7a4a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function TaroIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="animate-fade-in">
      <ellipse cx="32" cy="26" rx="11" ry="10" fill="#8b7a9c" stroke="#5a5a7a" strokeWidth="1.5" />
      <path d="M 26 17 L 22 4 Q 22 2 24 6 L 26 17 M 38 17 L 42 4 Q 42 2 40 6 L 38 17 M 32 16 L 32 2" stroke="#a0aa6a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M 20 35 L 16 50 M 44 35 L 48 50" stroke="#7a6a8b" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function GalangalIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="animate-fade-in">
      <ellipse cx="32" cy="26" rx="10" ry="9" fill="#c9a8a0" stroke="#8b7a6a" strokeWidth="1.5" />
      <path d="M 28 18 L 26 4 Q 26 2 28 6 L 28 18 M 36 18 L 38 4 Q 38 2 36 6 L 36 18" stroke="#7a9c5a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M 22 35 L 18 50 M 42 35 L 46 50" stroke="#8b7a6a" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

// ── DEFAULT ──

function DefaultIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="animate-fade-in">
      <circle cx="32" cy="32" r="16" fill="#b0a890" stroke="#7a6a5a" strokeWidth="1.5" opacity="0.5" />
      <path d="M 32 12 L 26 28 L 26 50 L 38 50 L 38 28 L 32 12" fill="#9b8c7a" stroke="#5a5245" strokeWidth="1.5" />
    </svg>
  );
}
