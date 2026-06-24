import { useState } from 'react';
import { User, Languages, ChevronDown } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { languages } from '../i18n/translations';

interface HeaderProps {
  user: { email: string; apiKey: string; tier: string } | null;
  onOpenAuth: (tab: 'login' | 'register') => void;
  onLogout: () => void;
  onOpenConsole: () => void;
  onGoHome?: () => void;
}

export default function Header({ user, onOpenAuth, onLogout, onOpenConsole, onGoHome }: HeaderProps) {
  const { language, setLanguage, t } = useLanguage();
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 left-0 right-0 z-50 w-full border-b border-white/5 bg-bg/60 backdrop-blur-md">
      {isLangDropdownOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsLangDropdownOpen(false)} />
      )}
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            if (onGoHome) onGoHome();
          }}
          className="flex items-center gap-2 group"
        >
          <span className="font-heading text-lg font-bold text-white tracking-wider uppercase transition-colors group-hover:text-accent">
            Space<span className="text-accent group-hover:text-white">Fetch</span>
          </span>
          <span className="text-[9px] font-mono bg-blue-500/10 text-accent px-1.5 py-0.5 rounded border border-blue-500/20">
            v1.0
          </span>
        </a>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-body text-slate-300">
          <a href="#problem-solution" className="hover:text-white transition-colors">{t('header.comparison')}</a>
          <a href="#features" className="hover:text-white transition-colors">{t('header.features')}</a>
          <a href="#demo" className="hover:text-white transition-colors">{t('header.demo')}</a>
          <a
            href="https://github.com/sargisis/SpaceFetch"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            {t('header.github')}
          </a>
        </nav>

        {/* Options */}
        <div className="flex items-center gap-4 relative z-50">
          {/* Language Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] text-xs font-mono text-slate-300 transition-all cursor-pointer select-none"
            >
              <Languages className="h-3.5 w-3.5 text-accent" />
              <span>{languages.find((l) => l.code === language)?.flag}</span>
              <span className="uppercase">{language}</span>
              <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isLangDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {isLangDropdownOpen && (
              <div className="absolute right-0 mt-2 w-40 rounded-xl border border-white/5 bg-bg/95 backdrop-blur-md p-1.5 shadow-2xl z-50 animate-in fade-in slide-in-from-top-1 duration-200 max-h-64 overflow-y-auto scrollbar-thin">
                {languages.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => {
                      setLanguage(l.code);
                      setIsLangDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-left font-body font-light transition-all cursor-pointer ${
                      language === l.code
                        ? 'bg-primary/20 text-accent font-medium'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="text-sm leading-none">{l.flag}</span>
                    <span>{l.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {user ? (
            <div className="flex items-center gap-3 md:gap-4">
              {/* User Info Badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/5 bg-white/[0.02]">
                <User className="h-3.5 w-3.5 text-accent" />
                <span className="text-xs font-mono text-slate-300 max-w-[120px] md:max-w-none truncate">
                  {user.email}
                </span>
                <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-bold ${
                  user.tier === 'premium' 
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                    : 'bg-slate-500/10 text-slate-400 border border-slate-500/25'
                }`}>
                  {user.tier}
                </span>
              </div>

              {/* API Console */}
              <button
                onClick={onOpenConsole}
                className="text-xs font-mono px-3 py-1.5 rounded-lg border border-accent/20 bg-accent/5 text-accent hover:bg-accent/10 transition-all cursor-pointer"
              >
                {t('header.console')}
              </button>

              {/* Log out */}
              <button
                onClick={onLogout}
                className="text-xs font-body text-slate-400 hover:text-white hover:underline transition-all cursor-pointer"
              >
                {t('header.logout')}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenAuth('login')}
                className="px-4 py-1.5 text-sm font-semibold text-slate-300 hover:text-white transition-all"
              >
                {t('header.signIn')}
              </button>
              <button
                onClick={() => onOpenAuth('register')}
                className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-primary hover:bg-blue-600 text-white transition-all shadow-[0_0_15px_rgba(59,130,246,0.2)] border border-blue-400/20"
              >
                {t('header.signUp')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
