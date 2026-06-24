import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Terminal, Copy, Check } from 'lucide-react';

const demos = {
  neows: {
    request: "GET https://api.spacefetch.dev/v1/asteroids/today?api_key=gsk_groq",
    response: `{
  "status": "success",
  "meta": {
    "cached": true,
    "response_time_ms": 2,
    "total_objects": 1
  },
  "data": [
    {
      "id": "3724056",
      "name": "(2015 NG13)",
      "is_hazardous": false,
      "metrics": {
        "diameter_meters": 45.0,
        "velocity_km_h": 64186.3,
        "miss_distance_km": 63745553.1
      },
      "mining_economy": {
        "estimated_value_usd": 4566651,
        "primary_materials": ["nickel", "iron"],
        "mining_difficulty": "low"
      },
      "ai_summary": {
        "en": "Asteroid (2015 NG13) is a 45-meter space rock hurtling at 64,186 km/h. Packed with iron and nickel worth $4.5M.",
        "ru": "Астероид (2015 NG13) — 45-метровый космический камень, летящий со скоростью 64186 км/ч. Оценочная стоимость: $4.5 млн."
      }
    }
  ]
}`
  },
  apod: {
    request: "GET https://api.spacefetch.dev/v1/apod?api_key=gsk_groq",
    response: `{
  "status": "success",
  "data": {
    "title": "M16: The Eagle Nebula",
    "date": "2026-06-24",
    "explanation": "A young star cluster, M16 is surrounded by birth clouds of dust and glowing gas, also known as the Eagle Nebula.",
    "media_type": "image",
    "url": "https://apod.nasa.gov/apod/image/2606/eagle_nebula.jpg",
    "hd_url": "https://apod.nasa.gov/apod/image/2606/eagle_nebula_hd.jpg"
  }
}`
  },
  epic: {
    request: "GET https://api.spacefetch.dev/v1/epic/latest?api_key=gsk_groq",
    response: `{
  "status": "success",
  "data": {
    "identifier": "20260624001234",
    "date": "2026-06-24",
    "image_url": "https://epic.gsfc.nasa.gov/archive/natural/2026/06/24/png/epic_1b_20260624001234.png",
    "coordinates": {
      "centroid": {
        "lat": 39.9234,
        "lon": -105.234
      }
    }
  }
}`
  }
};

type Dataset = keyof typeof demos;

function TypewriterResponse({ text }: { text: string }) {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    setDisplayedText("");
    let currentIdx = 0;
    const charsPerTick = 12; // Controls spelling speed
    const interval = setInterval(() => {
      currentIdx += charsPerTick;
      if (currentIdx >= text.length) {
        setDisplayedText(text);
        clearInterval(interval);
      } else {
        setDisplayedText(text.slice(0, currentIdx));
      }
    }, 12);

    return () => clearInterval(interval);
  }, [text]);

  return (
    <pre className="font-code text-xs md:text-sm text-cyan-400/90 leading-relaxed scrollbar-thin overflow-y-auto max-h-[350px]">
      {displayedText}
    </pre>
  );
}

export default function LiveDemo() {
  const [activeTab, setActiveTab] = useState<Dataset>("neows");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(demos[activeTab].response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="demo" className="py-24 bg-bg/30 relative">
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-bold font-heading mb-4">
            Try It in Real-Time
          </h2>
          <p className="text-slate-400 font-body font-light">
            Select a dataset below to execute a simulated SpaceFetch API request and witness the normalized output stream back.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto glass-panel p-6 md:p-8"
        >
          {/* Tabs */}
          <div className="flex border-b border-white/5 pb-4 mb-6 gap-2 md:gap-4 overflow-x-auto scrollbar-none">
            {(["neows", "apod", "epic"] as Dataset[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg font-mono text-sm uppercase tracking-wider transition-all duration-300 ${
                  activeTab === tab
                    ? "bg-primary/20 text-accent border border-accent/30 shadow-[0_0_15px_rgba(34,211,238,0.15)]"
                    : "text-slate-400 hover:text-white border border-transparent"
                }`}
              >
                {tab === "neows" ? "NeoWs (Asteroids)" : tab === "apod" ? "APOD (Daily Image)" : "EPIC (Earth)"}
              </button>
            ))}
          </div>

          {/* Request Header */}
          <div className="flex items-center gap-3 bg-black/40 px-4 py-3 rounded-t-xl border-t border-x border-white/5 font-code text-xs md:text-sm text-slate-300">
            <Terminal className="h-4 w-4 text-accent" />
            <span className="font-semibold text-accent font-mono">REQUEST:</span>
            <span className="text-slate-400 overflow-x-auto whitespace-nowrap scrollbar-none flex-1">
              {demos[activeTab].request}
            </span>
          </div>

          {/* Code Viewer Panel */}
          <div className="relative bg-black/60 rounded-b-xl border-b border-x border-white/5 p-6 min-h-[380px] flex flex-col justify-start">
            <button
              onClick={handleCopy}
              className="absolute top-4 right-4 p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all z-20"
              title="Copy JSON Response"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>

            <TypewriterResponse text={demos[activeTab].response} />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
