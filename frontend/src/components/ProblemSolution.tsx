import { motion } from 'framer-motion';
import { useLanguage } from '../i18n/LanguageContext';

const rawNASAJSON = `{
  "near_earth_objects": {
    "2026-06-24": [
      {
        "links": {
          "self": "http://api.nasa.gov/neo/rest/v1/neo/3724056"
        },
        "id": "3724056",
        "neo_reference_id": "3724056",
        "name": "(2015 NG13)",
        "absolute_magnitude_h": 24.9,
        "estimated_diameter": {
          "meters": {
            "estimated_diameter_min": 27.83,
            "estimated_diameter_max": 62.24
          }
        },
        "is_potentially_hazardous_asteroid": false,
        "close_approach_data": [
          {
            "close_approach_date": "2026-06-24",
            "epoch_date_close_approach": 1782306240000,
            "relative_velocity": {
              "kilometers_per_hour": "64186.3265"
            },
            "miss_distance": {
              "kilometers": "63745553.13"
            }
          }
        ]
      }
    ]
  }
}`;

const cleanSpaceFetchJSON = `{
  "status": "success",
  "data": [
    {
      "id": "3724056",
      "name": "(2015 NG13)",
      "is_hazardous": false,
      "metrics": {
        "diameter_meters": 45,
        "velocity_km_h": 64186.3,
        "miss_distance_km": 63745553.1
      },
      "mining_economy": {
        "estimated_value_usd": 4566651,
        "primary_materials": ["nickel", "iron"],
        "mining_difficulty": "low"
      },
      "ai_summary": {
        "en": "Asteroid (2015 NG13) is a 45-meter space rock...",
        "ru": "Астероид (2015 NG13) - 45-метровый космический..."
      }
    }
  ]
}`;

export default function ProblemSolution() {
  const { t } = useLanguage();

  return (
    <section id="problem-solution" className="py-24 relative overflow-hidden bg-bg/50 border-y border-white/5">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-glow-gradient pointer-events-none" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-bold font-heading mb-4 text-white">
            {t('problem.title')}
          </h2>
          <p className="text-slate-400 font-body font-light">
            {t('problem.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Problem Card */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="flex flex-col h-full"
          >
            <div className="flex items-center justify-between px-4 py-3 rounded-t-xl bg-red-950/20 border-t border-x border-red-500/20">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500/40" />
                <span className="text-xs font-mono text-red-400 font-semibold uppercase tracking-wider">{t('problem.nasaTitle')}</span>
              </div>
              <span className="text-[10px] font-mono text-red-500 animate-glitch font-bold">MESSY & COMPLEX</span>
            </div>

            <div className="flex-1 p-6 rounded-b-xl border-x border-b border-red-500/10 bg-red-950/5 font-code text-xs md:text-sm text-red-300/70 overflow-x-auto shadow-glass select-none max-h-[420px] scrollbar-thin">
              <pre className="animate-glitch leading-relaxed opacity-60">
                {rawNASAJSON}
              </pre>
            </div>
          </motion.div>

          {/* Solution Card */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col h-full"
          >
            <div className="flex items-center justify-between px-4 py-3 rounded-t-xl bg-blue-950/20 border-t border-x border-accent/20">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-accent animate-pulse" />
                <span className="text-xs font-mono text-accent font-semibold uppercase tracking-wider">{t('problem.sfTitle')}</span>
              </div>
              <span className="text-[10px] font-mono text-accent font-bold">100% CLEAN JSON</span>
            </div>

            <div className="flex-1 p-6 rounded-b-xl border-x border-b border-accent/15 bg-blue-950/5 font-code text-xs md:text-sm text-blue-100 overflow-x-auto shadow-glass max-h-[420px] scrollbar-thin">
              <pre className="leading-relaxed">
                {cleanSpaceFetchJSON}
              </pre>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
