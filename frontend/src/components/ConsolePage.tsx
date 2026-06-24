import { useState, useEffect, useRef, Fragment } from 'react';
import {
  Cpu,
  Key,
  Terminal,
  BookOpen,
  Globe,
  ShieldAlert,
  Sparkles,
  Camera,
  Image as ImageIcon,
  Check,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';

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

interface ConsolePageProps {
  user: { email: string; apiKey: string; tier: string };
  onGoHome: () => void;
}

type Tab = 'space' | 'credentials' | 'logs' | 'docs';
type SnippetTab = 'curl' | 'js' | 'python' | 'go' | 'rust' | 'cpp';

export default function ConsolePage({ user, onGoHome }: ConsolePageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('space');

  // Space Observatories states
  const [apod, setApod] = useState<any>(null);
  const [epic, setEpic] = useState<any>(null);
  const [asteroids, setAsteroids] = useState<AsteroidData[]>([]);
  const [loadingSpace, setLoadingSpace] = useState(true);

  // Credentials states
  const [showKey, setShowKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [activeSnippetTab, setActiveSnippetTab] = useState<SnippetTab>('curl');
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Live log logs
  const [logs, setLogs] = useState<string[]>([]);
  const logTerminalRef = useRef<HTMLDivElement>(null);

  // Selected Asteroid in Space Feed
  const [selectedAstId, setSelectedAstId] = useState<string | null>(null);

  // Fetch Space Feed data from real NASA APIs & Local API
  useEffect(() => {
    if (activeTab !== 'space') return;

    setLoadingSpace(true);
    // 1. Fetch APOD (NASA Daily Image)
    fetch('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY')
      .then((res) => res.json())
      .then((data) => setApod(data))
      .catch((err) => console.error('Failed to fetch APOD', err));

    // 2. Fetch EPIC (Earth Satellite Photos)
    fetch('https://epic.gsfc.nasa.gov/api/natural')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const latest = data[0];
          // Format date to folder structure (e.g. 2026/06/24)
          const dateObj = new Date(latest.date);
          const y = dateObj.getFullYear();
          const m = String(dateObj.getMonth() + 1).padStart(2, '0');
          const d = String(dateObj.getDate()).padStart(2, '0');
          
          setEpic({
            date: latest.date,
            lat: latest.centroid_coordinates.lat,
            lon: latest.centroid_coordinates.lon,
            imgUrl: `https://epic.gsfc.nasa.gov/archive/natural/${y}/${m}/${d}/png/${latest.image}.png`
          });
        }
      })
      .catch((err) => console.error('Failed to fetch EPIC', err));

    // 3. Fetch Asteroids from Local Go Backend
    fetch('http://localhost:8080/v1/asteroids/today', {
      headers: {
        'X-API-Key': user.apiKey
      }
    })
      .then((res) => res.json())
      .then((resData) => {
        if (resData.status === 'success' && Array.isArray(resData.data)) {
          setAsteroids(resData.data);
        }
      })
      .catch((err) => {
        console.warn('Backend server offline. Utilizing mockup telemetry.', err);
      })
      .finally(() => {
        setLoadingSpace(false);
      });
  }, [activeTab, user.apiKey]);

  // Handle simulated ground-control log feeds
  useEffect(() => {
    if (activeTab !== 'logs') return;

    // Prefill some logs
    const initialLogs = [
      `[${new Date().toLocaleTimeString()}] System Initialize... Success`,
      `[${new Date().toLocaleTimeString()}] Authenticating X-API-Key for developer: ${user.email}`,
      `[${new Date().toLocaleTimeString()}] Redis session check: OK`,
      `[${new Date().toLocaleTimeString()}] Rate Limit remaining: 5 req/sec (Free Plan)`
    ];
    setLogs(initialLogs);

    const logsTemplate = [
      () => `[${new Date().toLocaleTimeString()}] GET /v1/asteroids/today ➜ 200 OK (cache: HIT) - 1.2ms - Munich, DE`,
      () => `[${new Date().toLocaleTimeString()}] GET /v1/apod ➜ 200 OK (cache: HIT) - 0.8ms - London, UK`,
      () => `[${new Date().toLocaleTimeString()}] GET /v1/epic/latest ➜ 200 OK (cache: MISS) - 425.9ms - Austin, US`,
      () => `[${new Date().toLocaleTimeString()}] GET /v1/asteroids/today ➜ 200 OK (cache: HIT) - 1.5ms - Seoul, KR`,
      () => `[${new Date().toLocaleTimeString()}] GET /v1/apod ➜ 200 OK (cache: MISS) - 490.1ms - Sydney, AU`,
      () => `[${new Date().toLocaleTimeString()}] RateLimit status ➜ ${Math.floor(Math.random() * 4) + 1}/5 requests in active slot`
    ];

    const interval = setInterval(() => {
      const idx = Math.floor(Math.random() * logsTemplate.length);
      const newLog = logsTemplate[idx]();
      setLogs((prev) => [...prev.slice(-30), newLog]); // Keep last 30 logs
    }, 2000);

    return () => clearInterval(interval);
  }, [activeTab, user.email]);

  // Autoscroll logs terminal
  useEffect(() => {
    if (logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
    }
  }, [logs]);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(user.apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const getSnippet = () => {
    switch (activeSnippetTab) {
      case 'curl':
        return `curl -i -H "X-API-Key: ${user.apiKey}" \\
  https://api.spacefetch.dev/v1/asteroids/today`;
      case 'js':
        return `fetch("https://api.spacefetch.dev/v1/asteroids/today", {
  headers: { "X-API-Key": "${user.apiKey}" }
})
  .then(res => res.json())
  .then(data => console.log(data));`;
      case 'python':
        return `import requests

url = "https://api.spacefetch.dev/v1/asteroids/today"
headers = {"X-API-Key": "${user.apiKey}"}

response = requests.get(url, headers=headers)
print(response.json())`;
      case 'go':
        return `package main

import (
	"fmt"
	"io"
	"net/http"
)

func main() {
	client := &http.Client{}
	req, _ := http.NewRequest("GET", "https://api.spacefetch.dev/v1/asteroids/today", nil)
	req.Header.Set("X-API-Key", "${user.apiKey}")
	
	resp, _ := client.Do(req)
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	fmt.Println(string(body))
}`;
      case 'rust':
        return `// reqwest = { version = "0.11", features = ["json"] }
// tokio = { version = "1", features = ["full"] }

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let res = client
        .get("https://api.spacefetch.dev/v1/asteroids/today")
        .header("X-API-Key", "${user.apiKey}")
        .send()
        .await?
        .text()
        .await?;
    println!("{}", res);
    Ok(())
}`;
      case 'cpp':
        return `#include <iostream>
#include <curl/curl.h>

int main() {
    CURL* curl = curl_easy_init();
    if(curl) {
        curl_easy_setopt(curl, CURLOPT_URL, "https://api.spacefetch.dev/v1/asteroids/today");
        struct curl_slist* headers = NULL;
        headers = curl_slist_append(headers, "X-API-Key: ${user.apiKey}");
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        
        CURLcode res = curl_easy_perform(curl);
        curl_easy_cleanup(curl);
    }
    return 0;
}`;
    }
  };

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(getSnippet());
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="min-h-screen bg-bg text-slate-200 flex flex-col md:flex-row pt-16 font-body">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/5 bg-[#060810]/60 flex flex-col shrink-0">
        <div className="p-6 border-b border-white/5 flex items-center gap-2">
          <Cpu className="h-5 w-5 text-accent animate-pulse" />
          <span className="font-heading font-bold text-white tracking-wider uppercase text-sm">
            Control Console
          </span>
        </div>

        {/* Links */}
        <nav className="p-4 flex-1 space-y-1">
          <button
            onClick={() => setActiveTab('space')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
              activeTab === 'space'
                ? 'bg-primary/20 text-accent border border-accent/20'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <Globe className="h-4 w-4 shrink-0" />
            Space Observatories
          </button>

          <button
            onClick={() => setActiveTab('credentials')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
              activeTab === 'credentials'
                ? 'bg-primary/20 text-accent border border-accent/20'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <Key className="h-4 w-4 shrink-0" />
            API Credentials
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-primary/20 text-accent border border-accent/20'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <Terminal className="h-4 w-4 shrink-0" />
            Live Logs
          </button>

          <button
            onClick={() => setActiveTab('docs')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
              activeTab === 'docs'
                ? 'bg-primary/20 text-accent border border-accent/20'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <BookOpen className="h-4 w-4 shrink-0" />
            API Reference
          </button>
        </nav>

        {/* Back to Home Trigger */}
        <div className="p-4 border-t border-white/5">
          <button
            onClick={onGoHome}
            className="w-full py-2.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer text-center block"
          >
            Return to Landing
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-h-[calc(100vh-64px)] scrollbar-thin">
        {/* SPACE OBSERVATORIES TAB */}
        {activeTab === 'space' && (
          <div className="space-y-6">
            <div className="border-b border-white/5 pb-4">
              <h2 className="text-2xl font-bold font-heading text-white">Space Observatories Feed</h2>
              <p className="text-xs text-slate-400 mt-1">Live data streams processed from NASA and enriched via Llama-3.3.</p>
            </div>

            {loadingSpace ? (
              <div className="flex h-[350px] w-full items-center justify-center text-accent/50 font-mono animate-pulse">
                SYNCING ACTIVE COSMIC TELEMETRY...
              </div>
            ) : (
              <div className="space-y-6">
                {/* APOD and EPIC widgets */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* APOD Section */}
                  <div className="glass-panel p-5 bg-[#060810]/40 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <ImageIcon className="h-4 w-4 text-accent" />
                        <span className="text-[10px] text-accent font-semibold tracking-wider font-mono uppercase">NASA Image of the Day (APOD)</span>
                      </div>
                      {apod?.url ? (
                        <div className="rounded-xl overflow-hidden max-h-[220px] border border-white/10 mb-4 bg-black">
                          <img src={apod.url} alt={apod.title} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="h-[180px] rounded-xl border border-dashed border-white/10 flex items-center justify-center text-slate-500 text-xs font-mono mb-4">
                          No Visual Feed Available
                        </div>
                      )}
                      <h4 className="text-sm font-bold text-white leading-snug">{apod?.title || 'Unknown Title'}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed font-light mt-2 line-clamp-4">
                        {apod?.explanation || 'No description retrieved.'}
                      </p>
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 border-t border-white/5 pt-2 mt-4 flex justify-between">
                      <span>Feed Date: {apod?.date || 'N/A'}</span>
                      <span>Instrument: Planetary Camera</span>
                    </div>
                  </div>

                  {/* EPIC Section */}
                  <div className="glass-panel p-5 bg-[#060810]/40 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Camera className="h-4 w-4 text-accent animate-pulse" />
                        <span className="text-[10px] text-accent font-semibold tracking-wider font-mono uppercase">DSCOVR Satellite Live Camera (EPIC)</span>
                      </div>
                      {epic?.imgUrl ? (
                        <div className="rounded-xl overflow-hidden max-h-[220px] border border-white/10 mb-4 bg-black flex items-center justify-center p-2">
                          <img src={epic.imgUrl} alt="Live Earth View" className="w-[190px] h-[190px] object-cover animate-[spin_180s_linear_infinite]" />
                        </div>
                      ) : (
                        <div className="h-[180px] rounded-xl border border-dashed border-white/10 flex items-center justify-center text-slate-500 text-xs font-mono mb-4">
                          Syncing Earth Feed...
                        </div>
                      )}
                      <h4 className="text-sm font-bold text-white leading-snug">Full-Disk Color Earth Photograph</h4>
                      <p className="text-xs text-slate-400 leading-relaxed font-light mt-2">
                        Taken by the EPIC camera on the DSCOVR satellite at Lagrange Point 1 (1.5 million km away).
                      </p>
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 border-t border-white/5 pt-2 mt-4 flex justify-between">
                      <span>Coordinates: Lat {epic?.lat?.toFixed(2) || '0.00'}°, Lon {epic?.lon?.toFixed(2) || '0.00'}°</span>
                      <span>Capture Time: {epic?.date ? new Date(epic.date).toLocaleTimeString() : 'N/A'}</span>
                    </div>
                  </div>

                </div>

                {/* Asteroids List full-width */}
                <div className="glass-panel p-5 bg-[#060810]/40">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-4 w-4 text-accent" />
                    <span className="text-[10px] text-accent font-semibold tracking-wider font-mono uppercase">Today's Near-Earth Asteroid Log (NeoWs)</span>
                  </div>

                  {asteroids.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs font-mono">
                      No asteroids recorded today. Space environment secure.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 font-mono text-[9px] text-slate-400 uppercase">
                            <th className="py-2.5">Name</th>
                            <th className="py-2.5">Alert Level</th>
                            <th className="py-2.5">Diameter</th>
                            <th className="py-2.5">Speed</th>
                            <th className="py-2.5">Miss Distance</th>
                            <th className="py-2.5">Estimated Value</th>
                            <th className="py-2.5 text-right">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-mono text-xs">
                          {asteroids.map((ast) => {
                            const isSelected = selectedAstId === ast.id;
                            const desc = typeof ast.ai_summary === 'object' ? ast.ai_summary.ru || ast.ai_summary.en : ast.ai_summary;
                            return (
                              <Fragment key={ast.id}>
                                <tr className={`hover:bg-white/[0.02] transition-colors cursor-pointer ${isSelected ? 'bg-primary/5' : ''}`}>
                                  <td className="py-3 font-semibold text-white">{ast.name}</td>
                                  <td className="py-3">
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                      ast.is_hazardous
                                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    }`}>
                                      {ast.is_hazardous ? 'HAZARDOUS' : 'SECURE'}
                                    </span>
                                  </td>
                                  <td className="py-3">{ast.metrics.diameter_meters.toFixed(0)}m</td>
                                  <td className="py-3">{(ast.metrics.velocity_km_h / 1e3).toFixed(0)}k km/h</td>
                                  <td className="py-3">{(ast.metrics.miss_distance_km / 1e6).toFixed(1)}M km</td>
                                  <td className="py-3 text-accent font-semibold">
                                    ${(ast.mining_economy.estimated_value_usd / 1e6).toFixed(1)}M
                                  </td>
                                  <td className="py-3 text-right">
                                    <button
                                      onClick={() => setSelectedAstId(isSelected ? null : ast.id)}
                                      className="text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 cursor-pointer"
                                    >
                                      {isSelected ? 'Collapse' : 'Analyze'}
                                    </button>
                                  </td>
                                </tr>

                                {/* Expanded Analysis row */}
                                {isSelected && (
                                  <tr>
                                    <td colSpan={7} className="py-4 px-6 bg-black/40 text-xs font-body leading-relaxed text-slate-300">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                          <span className="text-[9px] text-accent font-semibold tracking-wider font-mono uppercase block mb-1">Primary Materials</span>
                                          <div className="flex gap-1.5">
                                            {ast.mining_economy.primary_materials.map((m) => (
                                              <span key={m} className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-blue-500/10 text-blue-300 border border-blue-500/25 uppercase">
                                                {m}
                                              </span>
                                            ))}
                                          </div>
                                          <span className="text-[9px] text-accent font-semibold tracking-wider font-mono uppercase block mt-3 mb-1">Difficulty Status</span>
                                          <span className="text-xs uppercase font-mono text-slate-200">🔨 Mining Difficulty: {ast.mining_economy.mining_difficulty}</span>
                                        </div>
                                        <div className="border-t md:border-t-0 md:border-l border-white/5 pt-3 md:pt-0 md:pl-4">
                                          <span className="text-[9px] text-amber-400 font-semibold tracking-wider font-mono uppercase flex items-center gap-1 mb-1">
                                            <Sparkles className="h-3 w-3 text-amber-400" />
                                            Llama AI Interpretation
                                          </span>
                                          <p className="font-light italic text-slate-400 leading-normal">
                                            "{desc}"
                                          </p>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* API CREDENTIALS TAB */}
        {activeTab === 'credentials' && (
          <div className="space-y-6 max-w-3xl">
            <div className="border-b border-white/5 pb-4">
              <h2 className="text-2xl font-bold font-heading text-white">Developer API Key</h2>
              <p className="text-xs text-slate-400 mt-1">Use this key to authorize all requests to the SpaceFetch server.</p>
            </div>

            {/* Profile info card */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-white/5 bg-white/[0.01]">
                <span className="text-[10px] text-slate-400 font-mono block uppercase">Account Email</span>
                <span className="text-sm font-semibold text-white font-body truncate block mt-1">{user.email}</span>
              </div>
              <div className="p-4 rounded-xl border border-white/5 bg-white/[0.01]">
                <span className="text-[10px] text-slate-400 font-mono block uppercase">API Access Tier</span>
                <span className="text-sm font-semibold text-accent font-mono uppercase flex items-center gap-1.5 mt-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                  {user.tier} Plan (5 req/s)
                </span>
              </div>
            </div>

            {/* API Key Box */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-accent font-semibold tracking-wider font-mono uppercase">Your Access Key</label>
              <div className="p-4 rounded-xl border border-accent/20 bg-accent/5 flex items-center justify-between font-mono text-xs text-accent shadow-[inset_0_1px_15px_rgba(34,211,238,0.05)]">
                <span className="truncate mr-4 font-semibold select-all">
                  {showKey ? user.apiKey : `sf_live_${'•'.repeat(24)}`}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer"
                    title={showKey ? "Hide API Key" : "Reveal API Key"}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={handleCopyKey}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer"
                    title="Copy API Key"
                  >
                    {copiedKey ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Integration code blocks */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-accent font-semibold tracking-wider font-mono uppercase">Quick Integration Snippet</label>
                
                {/* Tabs */}
                <div className="flex gap-1 bg-black/40 border border-white/5 p-0.5 rounded-lg overflow-x-auto max-w-[200px] sm:max-w-none scrollbar-none">
                  {(['curl', 'js', 'python', 'go', 'rust', 'cpp'] as SnippetTab[]).map((t) => {
                    const label = t === 'cpp' ? 'C++' : t === 'js' ? 'JS' : t.toUpperCase();
                    return (
                      <button
                        key={t}
                        onClick={() => {
                          setActiveSnippetTab(t);
                          setCopiedSnippet(false);
                        }}
                        className={`px-2.5 py-1 text-[10px] font-mono rounded-md uppercase transition-colors cursor-pointer shrink-0 ${
                          activeSnippetTab === t ? 'bg-primary/20 text-white font-semibold' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Code Panel */}
              <div className="relative group rounded-xl border border-white/5 bg-black/60 p-4 font-mono text-xs text-slate-300 h-[190px] flex flex-col justify-start">
                <button
                  onClick={handleCopySnippet}
                  className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer z-10"
                  title="Copy Code Snippet"
                >
                  {copiedSnippet ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <pre className="overflow-auto whitespace-pre scrollbar-thin text-cyan-400/90 leading-relaxed pr-6 font-mono w-full h-full">
                  <code>{getSnippet()}</code>
                </pre>
              </div>
            </div>

            {/* Note */}
            <div className="p-3.5 rounded-xl border border-amber-500/10 bg-amber-500/[0.02] text-[11px] text-amber-300/80 font-body leading-relaxed flex gap-2.5">
              <ShieldAlert className="h-4.5 w-4.5 shrink-0 mt-0.5 text-amber-500" />
              <span>
                Keep your API key private. Do not commit it to public GitHub repositories or expose it in client-side production environments.
              </span>
            </div>
          </div>
        )}

        {/* LIVE LOGS TAB */}
        {activeTab === 'logs' && (
          <div className="space-y-6">
            <div className="border-b border-white/5 pb-4">
              <h2 className="text-2xl font-bold font-heading text-white font-semibold">Live System Logs</h2>
              <p className="text-xs text-slate-400 mt-1">Real-time developer API request stream from global servers.</p>
            </div>

            {/* Logs terminal shell */}
            <div className="rounded-xl border border-white/5 bg-[#03050a] flex flex-col overflow-hidden max-w-4xl shadow-2xl">
              {/* Terminal header */}
              <div className="bg-[#0b0e16]/80 px-4 py-2 border-b border-white/5 flex items-center justify-between font-mono text-[10px] text-slate-500 select-none">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500/20" />
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/20" />
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500/20" />
                </div>
                <span>ground-control@spacefetch: ~</span>
                <span className="text-accent/60">LIVE STREAM</span>
              </div>

              {/* Logs area */}
              <div
                ref={logTerminalRef}
                className="p-5 font-mono text-[11px] text-cyan-400/90 leading-relaxed h-[360px] overflow-y-auto scrollbar-thin space-y-1 bg-black/60"
              >
                {logs.map((log, i) => (
                  <div key={i} className="whitespace-pre-wrap select-text">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* API REFERENCE (DOCS) TAB */}
        {activeTab === 'docs' && (
          <div className="space-y-8 max-w-3xl">
            <div className="border-b border-white/5 pb-4">
              <h2 className="text-2xl font-bold font-heading text-white">API Reference Documentation</h2>
              <p className="text-xs text-slate-400 mt-1">Overview of the unified NASA developer endpoints.</p>
            </div>

            {/* General authorization info */}
            <div className="p-4 rounded-xl border border-white/5 bg-white/[0.01] space-y-2">
              <h4 className="text-xs font-mono font-semibold uppercase text-accent">Authorization Header</h4>
              <p className="text-xs text-slate-300 font-body leading-relaxed font-light">
                All requests must carry your key either in the header `X-API-Key` or as a query parameter `?api_key=`.
              </p>
            </div>

            {/* Endpoints */}
            <div className="space-y-6">
              
              {/* Endpoint 1: Asteroids */}
              <div className="glass-panel p-5 bg-[#060810]/40 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-primary/20 text-accent font-mono">GET</span>
                  <span className="text-xs font-mono font-semibold text-white">/v1/asteroids/today</span>
                </div>
                <p className="text-xs text-slate-400 font-body font-light">
                  Retrieves a list of all asteroids passing close to Earth today, mapped to estimated dollar worth, material components, and a Llama-3.3 generated translation/summary.
                </p>
                <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-[10px] font-mono text-slate-400">
                  <span className="text-slate-500">Query Parameters:</span>
                  <ul className="list-disc list-inside mt-1 ml-2">
                    <li>api_key (string, optional) - Pass credentials in URL if header is missing</li>
                  </ul>
                </div>
              </div>

              {/* Endpoint 2: APOD */}
              <div className="glass-panel p-5 bg-[#060810]/40 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-primary/20 text-accent font-mono">GET</span>
                  <span className="text-xs font-mono font-semibold text-white">/v1/apod</span>
                </div>
                <p className="text-xs text-slate-400 font-body font-light">
                  Returns the NASA Astronomy Picture of the Day, including high-res media links, capture metadata, and AI translations of the scientific observations.
                </p>
              </div>

              {/* Endpoint 3: EPIC */}
              <div className="glass-panel p-5 bg-[#060810]/40 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-primary/20 text-accent font-mono">GET</span>
                  <span className="text-xs font-mono font-semibold text-white">/v1/epic/latest</span>
                </div>
                <p className="text-xs text-slate-400 font-body font-light">
                  Fetches the latest full-disk color satellite photos of Earth captured by the EPIC camera on DSCOVR, together with geo-centroid coordinates.
                </p>
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  );
}
