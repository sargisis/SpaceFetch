import { useState, useMemo } from 'react';
import {
  ShieldAlert,
  Zap,
  Gem,
  Ruler,
  Target,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Atom,
  Gauge,
  DollarSign
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

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
  close_approach_date?: string;
}

interface ThreatDashboardProps {
  asteroids: AsteroidData[];
  loading: boolean;
}

type SortKey = 'threat' | 'size' | 'speed' | 'value' | 'proximity';

function getThreatScore(ast: AsteroidData): number {
  // Composite threat score: hazardous flag, proximity, speed, size
  let score = 0;
  if (ast.is_hazardous) score += 40;
  
  // Closer = more dangerous (normalize to 0-20 range, < 10M km = max)
  const proxScore = Math.max(0, 20 - (ast.metrics.miss_distance_km / 500000));
  score += Math.min(20, proxScore);
  
  // Faster = more dangerous (normalize, > 100k km/h = max)
  const speedScore = Math.min(20, (ast.metrics.velocity_km_h / 100000) * 20);
  score += speedScore;
  
  // Bigger = more dangerous (normalize, > 500m = max)
  const sizeScore = Math.min(20, (ast.metrics.diameter_meters / 500) * 20);
  score += sizeScore;
  
  return Math.min(100, Math.round(score));
}

function getThreatLevel(score: number): { label: string; color: string; bg: string; border: string; glow: string } {
  if (score >= 75) return { label: 'CRITICAL', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', glow: 'shadow-[0_0_15px_rgba(239,68,68,0.15)]' };
  if (score >= 50) return { label: 'HIGH', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', glow: 'shadow-[0_0_15px_rgba(249,115,22,0.15)]' };
  if (score >= 25) return { label: 'MODERATE', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', glow: 'shadow-[0_0_15px_rgba(234,179,8,0.15)]' };
  return { label: 'LOW', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', glow: 'shadow-[0_0_15px_rgba(52,211,153,0.15)]' };
}

function formatNumber(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

function getThreatGradient(score: number): string {
  if (score >= 75) return 'from-red-500 to-red-600';
  if (score >= 50) return 'from-orange-500 to-orange-600';
  if (score >= 25) return 'from-yellow-500 to-yellow-600';
  return 'from-emerald-500 to-emerald-600';
}

export default function ThreatDashboard({ asteroids, loading }: ThreatDashboardProps) {
  const { t, language } = useLanguage();
  const [sortKey, setSortKey] = useState<SortKey>('threat');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Compute threat scores and stats
  const enrichedAsteroids = useMemo(() => {
    return asteroids.map(ast => ({
      ...ast,
      threatScore: getThreatScore(ast)
    }));
  }, [asteroids]);

  const sorted = useMemo(() => {
    const arr = [...enrichedAsteroids];
    switch (sortKey) {
      case 'threat':
        return arr.sort((a, b) => b.threatScore - a.threatScore);
      case 'size':
        return arr.sort((a, b) => b.metrics.diameter_meters - a.metrics.diameter_meters);
      case 'speed':
        return arr.sort((a, b) => b.metrics.velocity_km_h - a.metrics.velocity_km_h);
      case 'value':
        return arr.sort((a, b) => b.mining_economy.estimated_value_usd - a.mining_economy.estimated_value_usd);
      case 'proximity':
        return arr.sort((a, b) => a.metrics.miss_distance_km - b.metrics.miss_distance_km);
      default:
        return arr;
    }
  }, [enrichedAsteroids, sortKey]);

  // Stats
  const stats = useMemo(() => {
    if (enrichedAsteroids.length === 0) return null;
    const hazardous = enrichedAsteroids.filter(a => a.is_hazardous).length;
    const maxThreat = Math.max(...enrichedAsteroids.map(a => a.threatScore));
    const avgSpeed = enrichedAsteroids.reduce((s, a) => s + a.metrics.velocity_km_h, 0) / enrichedAsteroids.length;
    const totalValue = enrichedAsteroids.reduce((s, a) => s + a.mining_economy.estimated_value_usd, 0);
    const closest = Math.min(...enrichedAsteroids.map(a => a.metrics.miss_distance_km));
    const largest = Math.max(...enrichedAsteroids.map(a => a.metrics.diameter_meters));
    return { hazardous, maxThreat, avgSpeed, totalValue, closest, largest, total: enrichedAsteroids.length };
  }, [enrichedAsteroids]);

  if (loading) {
    return (
      <div className="flex h-[350px] w-full items-center justify-center text-accent/50 font-mono animate-pulse">
        {t('threat.loading')}
      </div>
    );
  }

  if (asteroids.length === 0) {
    return (
      <div className="flex flex-col h-[350px] w-full items-center justify-center text-slate-500 text-xs font-mono gap-3">
        <ShieldAlert className="h-8 w-8 text-slate-600" />
        <span>{t('threat.empty')}</span>
      </div>
    );
  }

  const maxDiameter = Math.max(...asteroids.map(a => a.metrics.diameter_meters));
  const maxProximity = Math.max(...asteroids.map(a => a.metrics.miss_distance_km));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-white/5 pb-4">
        <h2 className="text-2xl font-bold font-heading text-white flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-red-400" />
          {t('threat.title')}
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          {t('threat.subtitle')}
        </p>
      </div>

      {/* Stats Overview Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard 
            icon={<Target className="h-4 w-4" />}
            label={t('threat.tracked')} 
            value={stats.total.toString()} 
            sub={t('threat.objectsToday')}
            color="text-blue-400"
            borderColor="border-blue-500/20"
          />
          <StatCard 
            icon={<AlertTriangle className="h-4 w-4" />}
            label={t('threat.hazardous')} 
            value={stats.hazardous.toString()} 
            sub={`${stats.hazardous} / ${stats.total}`}
            color="text-red-400"
            borderColor="border-red-500/20"
          />
          <StatCard 
            icon={<Gauge className="h-4 w-4" />}
            label={t('threat.maxThreat')} 
            value={`${stats.maxThreat}%`} 
            sub={t('threat.threatScore')}
            color={stats.maxThreat >= 50 ? 'text-orange-400' : 'text-yellow-400'}
            borderColor={stats.maxThreat >= 50 ? 'border-orange-500/20' : 'border-yellow-500/20'}
          />
          <StatCard 
            icon={<Zap className="h-4 w-4" />}
            label={t('threat.avgSpeed')} 
            value={`${formatNumber(stats.avgSpeed)}`} 
            sub="km/h"
            color="text-purple-400"
            borderColor="border-purple-500/20"
          />
          <StatCard 
            icon={<Ruler className="h-4 w-4" />}
            label={t('threat.closest')} 
            value={`${formatNumber(stats.closest)}`} 
            sub={t('threat.kmMiss')}
            color="text-cyan-400"
            borderColor="border-cyan-500/20"
          />
          <StatCard 
            icon={<DollarSign className="h-4 w-4" />}
            label={t('threat.totalValue')} 
            value={`$${formatNumber(stats.totalValue)}`} 
            sub={t('threat.miningEst')}
            color="text-emerald-400"
            borderColor="border-emerald-500/20"
          />
        </div>
      )}

      {/* Overall Threat Gauge */}
      {stats && (
        <div className="glass-panel p-5 bg-[#060810]/40">
          <div className="flex items-center gap-2 mb-4">
            <Gauge className="h-4 w-4 text-accent" />
            <span className="text-[10px] text-accent font-semibold tracking-wider font-mono uppercase">
              {t('threat.globalIndex')}
            </span>
          </div>
          <div className="h-4 rounded-full bg-black/40 border border-white/5 overflow-hidden relative">
            <div className="absolute inset-0 flex">
              {sorted.map((ast, i) => {
                const width = (1 / sorted.length) * 100;
                return (
                  <div
                    key={ast.id}
                    className={`h-full bg-gradient-to-r ${getThreatGradient(ast.threatScore)} transition-all duration-700`}
                    style={{ 
                      width: `${width}%`,
                      opacity: 0.4 + (ast.threatScore / 100) * 0.6,
                      animationDelay: `${i * 100}ms`
                    }}
                    title={`${ast.name}: ${ast.threatScore}% threat`}
                  />
                );
              })}
            </div>
          </div>
          <div className="flex justify-between mt-2 text-[9px] font-mono text-slate-500">
            <span>0% — LOW</span>
            <span>25% — MODERATE</span>
            <span>50% — HIGH</span>
            <span>75% — CRITICAL</span>
            <span>100%</span>
          </div>
        </div>
      )}

      {/* Sort Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">{t('threat.sortBy')}:</span>
        {([
          { key: 'threat', label: t('threat.sortThreat'), icon: <ShieldAlert className="h-3 w-3" /> },
          { key: 'proximity', label: t('threat.sortProximity'), icon: <Target className="h-3 w-3" /> },
          { key: 'speed', label: t('threat.sortSpeed'), icon: <Zap className="h-3 w-3" /> },
          { key: 'size', label: t('threat.sortSize'), icon: <Ruler className="h-3 w-3" /> },
          { key: 'value', label: t('threat.sortValue'), icon: <Gem className="h-3 w-3" /> },
        ] as { key: SortKey; label: string; icon: JSX.Element }[]).map(s => (
          <button
            key={s.key}
            onClick={() => setSortKey(s.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase transition-all cursor-pointer border ${
              sortKey === s.key 
                ? 'bg-primary/20 text-accent border-accent/20 font-semibold' 
                : 'text-slate-400 hover:text-white border-white/5 hover:border-white/10'
            }`}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </div>

      {/* Asteroid Threat Cards */}
      <div className="space-y-3">
        {sorted.map((ast, index) => {
          const threat = getThreatLevel(ast.threatScore);
          const isExpanded = expandedId === ast.id;
          const desc = typeof ast.ai_summary === 'object' ? ((ast.ai_summary as Record<string, string>)[language] || ast.ai_summary.en || ast.ai_summary.ru) : ast.ai_summary;

          return (
            <div
              key={ast.id}
              className={`rounded-xl border ${threat.border} ${threat.bg} ${threat.glow} overflow-hidden transition-all duration-300`}
            >
              {/* Main row */}
              <div 
                className="p-4 flex items-center gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : ast.id)}
              >
                {/* Rank */}
                <div className="text-lg font-bold font-mono text-slate-600 w-8 text-center shrink-0">
                  #{index + 1}
                </div>

                {/* Threat circle */}
                <div className="relative shrink-0">
                  <svg width="52" height="52" viewBox="0 0 52 52" className="transform -rotate-90">
                    <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                    <circle 
                      cx="26" cy="26" r="22" fill="none" 
                      className={threat.color.replace('text-', 'stroke-')}
                      strokeWidth="4" 
                      strokeLinecap="round"
                      strokeDasharray={`${(ast.threatScore / 100) * 138.2} 138.2`}
                      style={{ transition: 'stroke-dasharray 0.8s ease-out' }}
                    />
                  </svg>
                  <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold ${threat.color}`}>
                    {ast.threatScore}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-white truncate">{ast.name}</h3>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${threat.bg} ${threat.color} border ${threat.border} uppercase shrink-0`}>
                      {threat.label}
                    </span>
                    {ast.is_hazardous && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded font-bold bg-red-500/20 text-red-400 border border-red-500/30 uppercase shrink-0 flex items-center gap-0.5">
                        <AlertTriangle className="h-2.5 w-2.5" /> PHA
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-mono text-slate-400">
                    <span className="flex items-center gap-1">
                      <Ruler className="h-3 w-3 text-slate-500" />
                      {ast.metrics.diameter_meters.toFixed(0)}m
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3 text-slate-500" />
                      {formatNumber(ast.metrics.velocity_km_h)} km/h
                    </span>
                    <span className="flex items-center gap-1">
                      <Target className="h-3 w-3 text-slate-500" />
                      {formatNumber(ast.metrics.miss_distance_km)} km
                    </span>
                    <span className="flex items-center gap-1 text-emerald-400">
                      <DollarSign className="h-3 w-3" />
                      ${formatNumber(ast.mining_economy.estimated_value_usd)}
                    </span>
                  </div>
                </div>

                {/* Expand toggle */}
                <div className="shrink-0 text-slate-500">
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-white/5 p-5 bg-black/20 space-y-5">
                  {/* Visual bars */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Size comparison */}
                    <div>
                      <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 block mb-2 flex items-center gap-1">
                        <Ruler className="h-3 w-3" /> {t('threat.diameterComparison')}
                      </span>
                      <div className="space-y-1.5">
                        <BarRow 
                          label={ast.name} 
                          value={ast.metrics.diameter_meters} 
                          max={maxDiameter} 
                          unit="m" 
                          color="bg-gradient-to-r from-blue-500 to-cyan-400"
                          highlight
                        />
                        <BarRow label={t('threat.statueOfLiberty')} value={93} max={maxDiameter} unit="m" color="bg-slate-600" />
                        <BarRow label={t('threat.boeing747')} value={70.7} max={maxDiameter} unit="m" color="bg-slate-700" />
                        <BarRow label={t('threat.blueWhale')} value={30} max={maxDiameter} unit="m" color="bg-slate-700" />
                      </div>
                    </div>

                    {/* Speed comparison */}
                    <div>
                      <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 block mb-2 flex items-center gap-1">
                        <Zap className="h-3 w-3" /> {t('threat.velocityComparison')}
                      </span>
                      <div className="space-y-1.5">
                        <BarRow 
                          label={ast.name} 
                          value={ast.metrics.velocity_km_h} 
                          max={Math.max(ast.metrics.velocity_km_h, 40000)} 
                          unit="km/h" 
                          color="bg-gradient-to-r from-purple-500 to-pink-400"
                          highlight
                        />
                        <BarRow label={t('threat.issSpeed')} value={27600} max={Math.max(ast.metrics.velocity_km_h, 40000)} unit="km/h" color="bg-slate-600" />
                        <BarRow label={t('threat.bullet')} value={4000} max={Math.max(ast.metrics.velocity_km_h, 40000)} unit="km/h" color="bg-slate-700" />
                        <BarRow label={t('threat.sound')} value={1235} max={Math.max(ast.metrics.velocity_km_h, 40000)} unit="km/h" color="bg-slate-700" />
                      </div>
                    </div>
                  </div>

                  {/* Proximity gauge */}
                  <div>
                    <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 block mb-2 flex items-center gap-1">
                      <Target className="h-3 w-3" /> {t('threat.missDistance')}
                    </span>
                    <div className="relative h-8 rounded-lg bg-black/40 border border-white/5 overflow-hidden">
                      {/* Danger zone */}
                      <div className="absolute left-0 top-0 h-full w-[5%] bg-red-500/10 border-r border-red-500/20" />
                      <div className="absolute left-[5%] top-0 h-full w-[15%] bg-orange-500/5 border-r border-orange-500/10" />
                      
                      {/* Asteroid marker */}
                      <div 
                        className="absolute top-1 bottom-1 w-1 rounded-full bg-accent animate-pulse"
                        style={{ 
                          left: `${Math.min(95, (ast.metrics.miss_distance_km / maxProximity) * 100)}%`,
                          transition: 'left 0.6s ease-out'
                        }}
                      />
                      
                      {/* Moon orbit reference */}
                      <div 
                        className="absolute top-0 h-full border-r border-dashed border-slate-500/30"
                        style={{ left: `${Math.min(95, (384400 / maxProximity) * 100)}%` }}
                      >
                        <span className="absolute -top-0 left-1 text-[7px] font-mono text-slate-500">🌙 Moon</span>
                      </div>
                    </div>
                    <div className="flex justify-between mt-1 text-[8px] font-mono text-slate-600">
                      <span>🌍 Earth</span>
                      <span>{formatNumber(ast.metrics.miss_distance_km)} {t('threat.kmFromEarth')}</span>
                      <span>{formatNumber(maxProximity)} km</span>
                    </div>
                  </div>

                  {/* Mining & AI row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Mining details */}
                    <div className="p-4 rounded-xl border border-white/5 bg-black/20">
                      <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-400 block mb-3 flex items-center gap-1">
                        <Gem className="h-3 w-3" /> {t('threat.miningEconomics')}
                      </span>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-400">{t('threat.estimatedValue')}</span>
                          <span className="text-sm font-bold text-emerald-400 font-mono">
                            ${formatNumber(ast.mining_economy.estimated_value_usd)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-400">{t('threat.difficulty')}</span>
                          <span className={`text-xs font-mono uppercase font-bold ${
                            ast.mining_economy.mining_difficulty === 'high' ? 'text-red-400' :
                            ast.mining_economy.mining_difficulty === 'medium' ? 'text-yellow-400' :
                            'text-emerald-400'
                          }`}>
                            {ast.mining_economy.mining_difficulty}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs text-slate-400 block mb-1.5">{t('threat.primaryMaterials')}</span>
                          <div className="flex flex-wrap gap-1.5">
                            {ast.mining_economy.primary_materials.map(m => (
                              <span key={m} className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 uppercase">
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* AI Summary */}
                    <div className="p-4 rounded-xl border border-white/5 bg-black/20">
                      <span className="text-[9px] font-mono uppercase tracking-wider text-amber-400 block mb-3 flex items-center gap-1">
                        <Atom className="h-3 w-3" /> {t('threat.aiAnalysis')}
                      </span>
                      {desc ? (
                        <p className="text-xs text-slate-300 font-body leading-relaxed italic">
                          "{desc}"
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 font-mono">
                          {t('threat.noAiAnalysis')}
                        </p>
                      )}
                      {ast.close_approach_date && (
                        <div className="mt-3 pt-2 border-t border-white/5 text-[10px] font-mono text-slate-500">
                          {t('threat.closeApproachDate')}: {ast.close_approach_date}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer summary */}
      <div className="p-3 rounded-xl border border-white/5 bg-white/[0.01] text-[10px] font-mono text-slate-500 flex items-center justify-between">
        <span>{t('threat.dataSource')}</span>
        <span className="text-accent">{asteroids.length} {t('threat.objectsAnalyzed')}</span>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────

function StatCard({ icon, label, value, sub, color, borderColor }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
  borderColor: string;
}) {
  return (
    <div className={`p-3.5 rounded-xl border ${borderColor} bg-white/[0.01] hover:bg-white/[0.03] transition-colors`}>
      <div className={`flex items-center gap-1.5 mb-2 ${color}`}>
        {icon}
        <span className="text-[9px] font-mono uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <div className="text-lg font-bold font-mono text-white leading-none">{value}</div>
      <div className="text-[9px] font-mono text-slate-500 mt-1">{sub}</div>
    </div>
  );
}

function BarRow({ label, value, max, unit, color, highlight }: {
  label: string;
  value: number;
  max: number;
  unit: string;
  color: string;
  highlight?: boolean;
}) {
  const pct = Math.max(2, (value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className={`text-[9px] font-mono w-28 truncate shrink-0 ${highlight ? 'text-white font-semibold' : 'text-slate-500'}`}>
        {label}
      </span>
      <div className="flex-1 h-3 rounded-full bg-black/30 border border-white/5 overflow-hidden relative">
        <div 
          className={`h-full rounded-full ${color} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[9px] font-mono w-20 text-right shrink-0 ${highlight ? 'text-accent font-semibold' : 'text-slate-500'}`}>
        {formatNumber(value)} {unit}
      </span>
    </div>
  );
}
