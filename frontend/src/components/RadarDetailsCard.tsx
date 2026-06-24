import { motion } from 'framer-motion';
import { X, ShieldAlert, Sparkles, Coins } from 'lucide-react';

interface AsteroidData {
  id: string;
  name: string;
  is_hazardous: boolean;
  metrics: {
    diameter_meters: number;
    velocity_km_h: number;
    miss_distance_km: number;
  };
  mining_economy: {
    estimated_value_usd: number;
    primary_materials: string[];
    mining_difficulty: string;
  };
  ai_summary: {
    en: string;
    ru: string;
  } | string;
}

interface RadarDetailsCardProps {
  asteroid: AsteroidData | null;
  onClose: () => void;
}

export default function RadarDetailsCard({ asteroid, onClose }: RadarDetailsCardProps) {
  if (!asteroid) return null;

  const getSummary = (): string => {
    if (typeof asteroid.ai_summary === 'object' && asteroid.ai_summary !== null) {
      return asteroid.ai_summary.ru || asteroid.ai_summary.en || '';
    }
    return (asteroid.ai_summary as string) || '';
  };

  const formatUSD = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -30, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -30, scale: 0.95 }}
      className="absolute bottom-6 left-6 z-20 w-full max-w-sm bg-[#070b19]/95 border border-white/10 rounded-2xl p-6 shadow-[0_10px_50px_rgba(0,0,0,0.6)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
        <div>
          <span className="text-[10px] text-accent font-semibold tracking-wider font-mono uppercase">Target Asteroid</span>
          <h4 className="text-base font-bold font-heading text-white mt-0.5">{asteroid.name}</h4>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer border border-white/5"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Value card */}
        <div className="p-3 rounded-xl border border-accent/20 bg-accent/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-4.5 w-4.5 text-accent animate-pulse" />
            <span className="text-xs text-slate-300 font-body">Est. Resource Value</span>
          </div>
          <span className="text-sm font-bold font-mono text-accent">
            {formatUSD(asteroid.mining_economy.estimated_value_usd)}
          </span>
        </div>

        {/* Hazard & Difficulty */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-2.5 rounded-xl border border-white/5 bg-white/[0.01]">
            <span className="text-[9px] text-slate-400 font-mono block uppercase">Collision Alert</span>
            <span className={`text-[10px] font-mono uppercase font-bold flex items-center gap-1.5 mt-1 ${
              asteroid.is_hazardous ? 'text-red-400' : 'text-emerald-400'
            }`}>
              {asteroid.is_hazardous ? (
                <>
                  <ShieldAlert className="h-3.5 w-3.5 text-red-400" />
                  HAZARDOUS
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  SECURE (SAFE)
                </>
              )}
            </span>
          </div>

          <div className="p-2.5 rounded-xl border border-white/5 bg-white/[0.01]">
            <span className="text-[9px] text-slate-400 font-mono block uppercase">Mining Difficulty</span>
            <span className="text-[10px] font-mono text-slate-200 mt-1 uppercase block font-semibold">
              🔨 {asteroid.mining_economy.mining_difficulty}
            </span>
          </div>
        </div>

        {/* Materials */}
        <div>
          <span className="text-[9px] text-slate-400 font-mono block uppercase mb-1.5">Primary Materials</span>
          <div className="flex flex-wrap gap-1.5">
            {asteroid.mining_economy.primary_materials.map((mat) => (
              <span key={mat} className="text-[9px] font-mono bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2 py-0.5 rounded uppercase">
                {mat}
              </span>
            ))}
          </div>
        </div>

        {/* AI Summary */}
        <div className="pt-3 border-t border-white/5">
          <span className="text-[9px] text-slate-400 font-mono flex items-center gap-1 uppercase mb-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            Llama-3.3 Analyzer Log
          </span>
          <p className="text-xs text-slate-300 font-body leading-relaxed font-light italic">
            "{getSummary()}"
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 pt-2 text-[10px] font-mono text-slate-500 border-t border-white/5">
          <span>Speed: {asteroid.metrics.velocity_km_h.toFixed(0)} km/h</span>
          <span>Miss Dist: {(asteroid.metrics.miss_distance_km / 1e6).toFixed(1)}M km</span>
        </div>
      </div>
    </motion.div>
  );
}
