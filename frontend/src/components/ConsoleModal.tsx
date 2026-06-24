import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Eye, EyeOff, ShieldAlert, Cpu } from 'lucide-react';

interface ConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: { email: string; apiKey: string; tier: string } | null;
}

type SnippetTab = 'curl' | 'js';

export default function ConsoleModal({ isOpen, onClose, user }: ConsoleModalProps) {
  const [showKey, setShowKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [activeTab, setActiveTab] = useState<SnippetTab>('curl');

  if (!user) return null;

  const handleCopyKey = () => {
    navigator.clipboard.writeText(user.apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const getSnippet = () => {
    if (activeTab === 'curl') {
      return `curl -i -H "X-API-Key: ${user.apiKey}" \\
  https://api.spacefetch.dev/v1/asteroids/today`;
    }
    return `fetch("https://api.spacefetch.dev/v1/asteroids/today", {
  headers: {
    "X-API-Key": "${user.apiKey}"
  }
})
  .then(res => res.json())
  .then(data => console.log(data));`;
  };

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(getSnippet());
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop (high-performance dark fill, no backdrop-blur to avoid WebGL lag) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/85"
          />

          {/* Modal Container */}
          <motion.div
            key="console-modal-wrapper"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", damping: 30, stiffness: 350 }}
            className="w-full max-w-lg bg-gradient-to-br from-white/10 to-transparent p-[1px] rounded-2xl shadow-[0_0_50px_rgba(59,130,246,0.15)] relative overflow-hidden"
          >
            {/* Ambient glows */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-accent/20 rounded-full blur-3xl pointer-events-none" />

            <div className="bg-[#070b19]/95 p-8 rounded-2xl relative">
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer border border-white/5"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Title */}
              <div className="mb-6">
                <h3 className="text-xl font-bold font-heading text-white tracking-wide flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-accent animate-pulse" />
                  Developer Console
                </h3>
                <p className="text-xs text-slate-400 font-body mt-1">
                  Manage your credentials and integrate clean space data feeds.
                </p>
              </div>

              {/* Console Dashboard Details */}
              <div className="space-y-6">
                {/* Profile detail card */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3.5 rounded-xl border border-white/5 bg-white/[0.01]">
                    <span className="text-[10px] text-slate-400 font-mono block uppercase">Account Email</span>
                    <span className="text-xs font-semibold text-white font-body truncate block mt-1">{user.email}</span>
                  </div>
                  <div className="p-3.5 rounded-xl border border-white/5 bg-white/[0.01]">
                    <span className="text-[10px] text-slate-400 font-mono block uppercase">API Access Tier</span>
                    <span className="text-xs font-semibold text-accent font-mono uppercase flex items-center gap-1.5 mt-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                      {user.tier} Plan (5 req/s)
                    </span>
                  </div>
                </div>

                {/* API Key Box */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-accent font-semibold tracking-wider font-mono uppercase">Your Access Key</label>
                  <div className="p-3.5 rounded-xl border border-accent/20 bg-accent/5 flex items-center justify-between font-mono text-xs text-accent shadow-[inset_0_1px_15px_rgba(34,211,238,0.05)]">
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

                {/* Code Snippets Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-accent font-semibold tracking-wider font-mono uppercase">Quick Integration</label>
                    
                    {/* Tabs */}
                    <div className="flex gap-2 bg-black/40 border border-white/5 p-0.5 rounded-lg">
                      <button
                        onClick={() => setActiveTab('curl')}
                        className={`px-2.5 py-1 text-[10px] font-mono rounded-md uppercase transition-colors cursor-pointer ${
                          activeTab === 'curl' ? 'bg-primary/20 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        cURL
                      </button>
                      <button
                        onClick={() => setActiveTab('js')}
                        className={`px-2.5 py-1 text-[10px] font-mono rounded-md uppercase transition-colors cursor-pointer ${
                          activeTab === 'js' ? 'bg-primary/20 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Fetch (JS)
                      </button>
                    </div>
                  </div>

                  {/* Code View Panel */}
                  <div className="relative group rounded-xl border border-white/5 bg-black/60 p-4 font-mono text-xs text-slate-300 min-h-[90px] flex flex-col justify-center">
                    <button
                      onClick={handleCopySnippet}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                      title="Copy Code Snippet"
                    >
                      {copiedSnippet ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <pre className="overflow-x-auto whitespace-pre scrollbar-thin text-cyan-400/90 leading-relaxed pr-6 font-mono">
                      {getSnippet()}
                    </pre>
                  </div>
                </div>

                {/* Important notice */}
                <div className="p-3.5 rounded-xl border border-amber-500/10 bg-amber-500/[0.02] text-[11px] text-amber-300/80 font-body leading-relaxed flex gap-2.5">
                  <ShieldAlert className="h-4.5 w-4.5 shrink-0 mt-0.5 text-amber-500" />
                  <span>
                    Keep your API key private. Do not commit it to public GitHub repositories or expose it in client-side production environments.
                  </span>
                </div>

                {/* Primary Proceed Button */}
                <button
                  onClick={onClose}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-primary to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-semibold text-xs tracking-wider uppercase transition-all duration-300 shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(34,211,238,0.5)] border border-cyan-400/20 cursor-pointer"
                >
                  Return to Dashboard
                </button>
              </div>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
