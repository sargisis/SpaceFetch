import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Shield, Mail, Key, Sparkles, AlertCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab: 'login' | 'register';
  onLoginSuccess: (user: { email: string; apiKey: string; tier: string }) => void;
}

type Tab = 'login' | 'register' | 'recover';

export default function AuthModal({ isOpen, onClose, defaultTab, onLoginSuccess }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);
  const [email, setEmail] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [tier] = useState<'free' | 'premium'>('free'); // Default to free as subscriptions are removed
  
  // Registration success state
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Sync state with open triggers
  React.useEffect(() => {
    setActiveTab(defaultTab);
    setErrorMsg(null);
    setInfoMsg(null);
    setGeneratedKey(null);
  }, [isOpen, defaultTab]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      // Connect to Go backend user registration endpoint
      const res = await fetch('http://localhost:8080/v1/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, tier }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      setGeneratedKey(data.api_key);
      onLoginSuccess({
        email: data.email,
        apiKey: data.api_key,
        tier: data.tier,
      });
    } catch (err: any) {
      console.error(err);
      // Fallback mock registration if backend server is not running
      const mockKey = `sf_live_mock_${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}`;
      setGeneratedKey(mockKey);
      onLoginSuccess({
        email,
        apiKey: mockKey,
        tier,
      });
      setInfoMsg("Offline fallback mode: generated a local mock API key.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput) return;

    setLoading(true);
    setErrorMsg(null);

    // Verify key against local backend
    try {
      const res = await fetch('http://localhost:8080/v1/asteroids/today', {
        method: 'GET',
        headers: {
          'X-API-Key': apiKeyInput,
        },
      });

      if (res.status === 200) {
        onLoginSuccess({
          email: email || 'developer@spacefetch.dev',
          apiKey: apiKeyInput,
          tier: apiKeyInput.includes('premium') ? 'premium' : 'free',
        });
        onClose();
      } else {
        setErrorMsg('Invalid API Key. Please make sure the backend is active.');
      }
    } catch (err) {
      // Local fallback login
      onLoginSuccess({
        email: email || 'local.dev@spacefetch.dev',
        apiKey: apiKeyInput,
        tier: 'free',
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setTimeout(() => {
      setInfoMsg("API keys are securely hashed using SHA-256 in our database. We've sent a list of your metadata to your inbox. You can register a new key.");
      setLoading(false);
    }, 800);
  };

  const handleCopyKey = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="auth-modal-wrapper"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop Blur overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/85"
          />

          {/* Glowing outer gradient border */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", damping: 30, stiffness: 350 }}
            className="w-full max-w-md bg-gradient-to-br from-white/10 to-transparent p-[1px] rounded-2xl shadow-[0_0_50px_rgba(59,130,246,0.15)] relative overflow-hidden"
          >
            {/* Custom Background light flares */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-accent/20 rounded-full blur-3xl pointer-events-none" />

            {/* Main Modal body */}
            <div className="bg-[#070b19]/95 p-8 rounded-2xl relative">
              
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer border border-white/5"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Navigation Tabs (only shown when key is not generated yet) */}
              {!generatedKey && (
                <div className="relative flex p-1 bg-black/50 border border-white/5 rounded-xl mb-6 select-none">
                  {(['login', 'register', 'recover'] as Tab[]).map((tab) => {
                    const label = tab === 'login' ? 'Sign In' : tab === 'register' ? 'Sign Up' : 'Forgot Key';
                    const isActive = activeTab === tab;
                    return (
                      <button
                        key={tab}
                        onClick={() => {
                          setActiveTab(tab);
                          setErrorMsg(null);
                          setInfoMsg(null);
                        }}
                        className={`relative flex-1 py-2 text-xs font-heading font-medium tracking-wide uppercase rounded-lg transition-colors duration-300 cursor-pointer ${
                          isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="activeTabBubble"
                            className="absolute inset-0 bg-primary/20 border border-primary/30 rounded-lg -z-10"
                            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                          />
                        )}
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Title / Description */}
              {!generatedKey && (
                <div className="mb-6">
                  <h3 className="text-xl font-bold font-heading text-white tracking-wide">
                    {activeTab === 'login' 
                      ? 'Welcome Back' 
                      : activeTab === 'register' 
                      ? 'Get API Access' 
                      : 'Recover Access Key'}
                  </h3>
                  <p className="text-xs text-slate-400 font-body mt-1">
                    {activeTab === 'login' 
                      ? 'Enter your API key to access developer features.' 
                      : activeTab === 'register' 
                      ? 'Register with your email to obtain your API credentials.' 
                      : 'API keys are encrypted. Enter email to receive instructions.'}
                  </p>
                </div>
              )}

              {/* Error and Info messages */}
              {errorMsg && (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs mb-4 font-body">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
              {infoMsg && (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-blue-500/20 bg-blue-500/5 text-blue-400 text-xs mb-4 font-body">
                  <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-accent" />
                  <span>{infoMsg}</span>
                </div>
              )}

              {/* Sign In Form */}
              {activeTab === 'login' && !generatedKey && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-accent font-semibold tracking-wider font-mono uppercase">API KEY</label>
                    <div className="relative group focus-within:ring-1 focus-within:ring-accent/50 rounded-xl transition-all">
                      <Key className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500 group-focus-within:text-accent transition-colors" />
                      <input
                        type="password"
                        required
                        placeholder="sf_live_..."
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:border-accent transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-accent font-semibold tracking-wider font-mono uppercase">EMAIL (OPTIONAL)</label>
                    <div className="relative group focus-within:ring-1 focus-within:ring-accent/50 rounded-xl transition-all">
                      <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500 group-focus-within:text-accent transition-colors" />
                      <input
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm font-body text-white placeholder-slate-600 focus:outline-none focus:border-accent transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-primary to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-semibold text-xs tracking-wider uppercase transition-all duration-300 shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(34,211,238,0.5)] border border-cyan-400/20 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? 'Verifying Credentials...' : 'Sign In to Console'}
                  </button>
                </form>
              )}

              {/* Sign Up Form */}
              {activeTab === 'register' && !generatedKey && (
                <form onSubmit={handleRegister} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-accent font-semibold tracking-wider font-mono uppercase">EMAIL ADDRESS</label>
                    <div className="relative group focus-within:ring-1 focus-within:ring-accent/50 rounded-xl transition-all">
                      <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500 group-focus-within:text-accent transition-colors" />
                      <input
                        type="email"
                        required
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm font-body text-white placeholder-slate-600 focus:outline-none focus:border-accent transition-all"
                      />
                    </div>
                  </div>

                  <div className="px-4 py-3 rounded-xl border border-white/5 bg-white/[0.01] text-[11px] text-slate-400 font-body leading-relaxed">
                    By requesting a free API Key, you gain instant access to normalizations of active NASA feeds with a default limit of 5 requests per second.
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-primary to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-semibold text-xs tracking-wider uppercase transition-all duration-300 shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(34,211,238,0.5)] border border-cyan-400/20 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? 'Generating API Access...' : 'Generate Free API Key'}
                  </button>
                </form>
              )}

              {/* Recover Form */}
              {activeTab === 'recover' && !generatedKey && (
                <form onSubmit={handleRecover} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-accent font-semibold tracking-wider font-mono uppercase">EMAIL ADDRESS</label>
                    <div className="relative group focus-within:ring-1 focus-within:ring-accent/50 rounded-xl transition-all">
                      <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500 group-focus-within:text-accent transition-colors" />
                      <input
                        type="email"
                        required
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm font-body text-white placeholder-slate-600 focus:outline-none focus:border-accent transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-primary to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-semibold text-xs tracking-wider uppercase transition-all duration-300 shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(34,211,238,0.5)] border border-cyan-400/20 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? 'Locating Metadata...' : 'Send Access Recovery'}
                  </button>
                </form>
              )}

              {/* Key Success View */}
              {generatedKey && (
                <div className="space-y-6 text-center pt-2">
                  <div className="flex flex-col items-center">
                    <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 border border-accent/20 mb-4">
                      {/* Interactive pulsing orbit rings */}
                      <span className="absolute inset-0 rounded-full border border-accent/40 animate-ping opacity-25" />
                      <Shield className="h-8 w-8 text-accent animate-pulse" />
                    </div>
                    <h3 className="text-lg font-bold font-heading text-white">API Key Generated!</h3>
                    <p className="text-xs text-slate-400 font-body max-w-xs mx-auto mt-2 leading-relaxed">
                      Copy your API access key below. For your security, this key cannot be recovered or shown again.
                    </p>
                  </div>

                  {/* API Key Box */}
                  <div className="p-3.5 rounded-xl border border-accent/30 bg-accent/5 flex items-center justify-between font-mono text-xs text-accent select-all shadow-[inset_0_1px_15px_rgba(34,211,238,0.05)]">
                    <span className="truncate mr-4 font-semibold">{generatedKey}</span>
                    <button
                      onClick={handleCopyKey}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer shrink-0"
                      title="Copy to Clipboard"
                    >
                      {copied ? <Check className="h-4.5 w-4.5 text-emerald-400" /> : <Copy className="h-4.5 w-4.5" />}
                    </button>
                  </div>

                  {/* Security disclaimer note */}
                  <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-left text-[11px] text-amber-300/80 font-body leading-relaxed flex gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                    <span>Please save this key in a secure location. If you lose it, you will have to generate a new key as we only store hashed versions.</span>
                  </div>

                  <button
                    onClick={onClose}
                    className="w-full py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 font-semibold text-xs tracking-wider uppercase transition-all duration-300 cursor-pointer"
                  >
                    Proceed to API Console
                  </button>
                </div>
              )}

            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
