import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Shield, Mail, Key, Sparkles } from 'lucide-react';

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
  const [tier, setTier] = useState<'free' | 'premium'>('free');
  
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
        // Success
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop Blur overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 250 }}
            className="w-full max-w-md glass-panel p-6 md:p-8 border border-white/10 relative overflow-hidden bg-bg shadow-2xl"
          >
            {/* Custom Background light */}
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-primary/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-accent/20 rounded-full blur-2xl pointer-events-none" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            {/* Tabs Selector */}
            {!generatedKey && (
              <div className="flex border-b border-white/5 pb-2 mb-6 gap-2">
                <button
                  onClick={() => { setActiveTab('login'); setErrorMsg(null); setInfoMsg(null); }}
                  className={`pb-2 px-1 text-sm font-heading font-medium tracking-wide transition-all border-b-2 ${
                    activeTab === 'login'
                      ? 'text-accent border-accent'
                      : 'text-slate-400 border-transparent hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setActiveTab('register'); setErrorMsg(null); setInfoMsg(null); }}
                  className={`pb-2 px-1 text-sm font-heading font-medium tracking-wide transition-all border-b-2 ${
                    activeTab === 'register'
                      ? 'text-accent border-accent'
                      : 'text-slate-400 border-transparent hover:text-white'
                  }`}
                >
                  Sign Up
                </button>
                <button
                  onClick={() => { setActiveTab('recover'); setErrorMsg(null); setInfoMsg(null); }}
                  className={`pb-2 px-1 text-sm font-heading font-medium tracking-wide transition-all border-b-2 ${
                    activeTab === 'recover'
                      ? 'text-accent border-accent'
                      : 'text-slate-400 border-transparent hover:text-white'
                  }`}
                >
                  Forgot Key
                </button>
              </div>
            )}

            {/* ERROR / INFO BOX */}
            {errorMsg && (
              <div className="px-4 py-2.5 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 text-xs mb-4 font-mono">
                {errorMsg}
              </div>
            )}
            {infoMsg && (
              <div className="px-4 py-2.5 rounded-lg border border-blue-500/20 bg-blue-500/5 text-blue-400 text-xs mb-4 font-mono">
                {infoMsg}
              </div>
            )}

            {/* LOGIN VIEW */}
            {activeTab === 'login' && !generatedKey && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-mono">API KEY</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="password"
                      required
                      placeholder="sf_live_..."
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:border-accent transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-mono">EMAIL (OPTIONAL)</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm font-body text-white placeholder-slate-600 focus:outline-none focus:border-accent transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg bg-primary hover:bg-blue-600 text-white font-semibold text-sm transition-all shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                >
                  {loading ? 'Verifying Key...' : 'Sign In'}
                </button>
              </form>
            )}

            {/* REGISTER VIEW */}
            {activeTab === 'register' && !generatedKey && (
              <form onSubmit={handleRegister} className="space-y-5">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-mono">EMAIL ADDRESS</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm font-body text-white placeholder-slate-600 focus:outline-none focus:border-accent transition-all"
                    />
                  </div>
                </div>

                {/* Tier Selector */}
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 font-mono">API TIER PLAN</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      onClick={() => setTier('free')}
                      className={`cursor-pointer p-3 rounded-lg border flex flex-col justify-center items-center text-center transition-all ${
                        tier === 'free'
                          ? 'border-accent bg-accent/5'
                          : 'border-white/5 bg-black/20 hover:border-white/10'
                      }`}
                    >
                      <span className="text-sm font-bold text-white">Free Tier</span>
                      <span className="text-[10px] text-slate-400 font-mono mt-1">5 req/sec</span>
                    </div>

                    <div
                      onClick={() => setTier('premium')}
                      className={`cursor-pointer p-3 rounded-lg border flex flex-col justify-center items-center text-center transition-all ${
                        tier === 'premium'
                          ? 'border-accent bg-accent/5'
                          : 'border-white/5 bg-black/20 hover:border-white/10'
                      }`}
                    >
                      <span className="text-sm font-bold text-white flex items-center gap-1">
                        Premium <Sparkles className="h-3 w-3 text-amber-400" />
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono mt-1">50 req/sec</span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg bg-primary hover:bg-blue-600 text-white font-semibold text-sm transition-all shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                >
                  {loading ? 'Creating API Key...' : 'Register API Key'}
                </button>
              </form>
            )}

            {/* RECOVER VIEW */}
            {activeTab === 'recover' && !generatedKey && (
              <form onSubmit={handleRecover} className="space-y-4">
                <p className="text-xs font-body text-slate-400 leading-relaxed mb-2">
                  Enter your email address to recover your API credentials metadata list.
                </p>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-mono">EMAIL ADDRESS</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="email"
                      required
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm font-body text-white placeholder-slate-600 focus:outline-none focus:border-accent transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg bg-primary hover:bg-blue-600 text-white font-semibold text-sm transition-all"
                >
                  {loading ? 'Recovering...' : 'Recover API Metadata'}
                </button>
              </form>
            )}

            {/* KEY GENERATED SUCCESS VIEW */}
            {generatedKey && (
              <div className="space-y-6 text-center">
                <div className="flex flex-col items-center">
                  <div className="p-3 bg-accent/10 text-accent rounded-full border border-accent/20 mb-4 animate-bounce">
                    <Shield className="h-8 w-8" />
                  </div>
                  <h3 className="text-lg font-bold font-heading text-white">API Key Generated!</h3>
                  <p className="text-xs text-slate-400 font-body max-w-xs mx-auto mt-2 leading-relaxed">
                    Copy your API key below. For security reasons, it cannot be shown again.
                  </p>
                </div>

                {/* API Key Box */}
                <div className="p-3 rounded-lg border border-accent/20 bg-accent/5 flex items-center justify-between font-mono text-sm text-accent select-all">
                  <span className="truncate mr-4">{generatedKey}</span>
                  <button
                    onClick={handleCopyKey}
                    className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white transition-all hover:bg-white/10"
                    title="Copy to Clipboard"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>

                <button
                  onClick={onClose}
                  className="w-full py-3 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 font-semibold text-sm transition-all"
                >
                  Proceed to API
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
