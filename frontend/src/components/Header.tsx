import { useState } from 'react';
import { User, Languages, ChevronDown, Menu, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { languages } from '../i18n/translations';
import type { SessionUser } from '../types';

interface HeaderProps {
  user: SessionUser | null;
  onOpenAuth: (tab: 'login' | 'register') => void;
  onLogout: () => void;
  onOpenConsole: () => void;
  onGoHome?: () => void;
}

export default function Header({ user, onOpenAuth, onLogout, onOpenConsole, onGoHome }: HeaderProps) {
  const { language, setLanguage, t } = useLanguage();
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '#problem-solution', label: t('header.comparison') },
    { href: '#features', label: t('header.features') },
    { href: '#demo', label: t('header.demo') },
  ];

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
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="hover:text-white transition-colors">{link.label}</a>
          ))}
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
                    <span className="flex-1">{l.label}</span>
                    <span className="text-[9px] font-mono uppercase text-slate-500">{l.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {user ? (
            <div className="flex items-center gap-2 md:gap-4">
              {/* User Info Badge — email hidden on small screens to avoid overflow */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/5 bg-white/[0.02]">
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
                className="hidden sm:block text-xs font-body text-slate-400 hover:text-white hover:underline transition-all cursor-pointer"
              >
                {t('header.logout')}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenAuth('login')}
                className="hidden sm:block px-4 py-1.5 text-sm font-semibold text-slate-300 hover:text-white transition-all"
              >
                {t('header.signIn')}
              </button>
              <button
                onClick={() => onOpenAuth('register')}
                className="px-3 md:px-4 py-1.5 text-sm font-semibold rounded-lg bg-primary hover:bg-blue-600 text-white transition-all shadow-[0_0_15px_rgba(59,130,246,0.2)] border border-blue-400/20"
              >
                {t('header.signUp')}
              </button>
            </div>
          )}

          {/* Mobile burger button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg border border-white/5 bg-white/[0.02] text-slate-300 hover:text-white transition-all"
            aria-label="Menu"
          >
            {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile navigation panel */}
      {isMobileMenuOpen && (
        <nav className="md:hidden border-t border-white/5 bg-bg/95 backdrop-blur-md px-6 py-4 flex flex-col gap-1">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className="py-2.5 px-3 rounded-lg text-sm font-body text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              {link.label}
            </a>
          ))}
          <a
            href="https://github.com/sargisis/SpaceFetch"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsMobileMenuOpen(false)}
            className="py-2.5 px-3 rounded-lg text-sm font-body text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            {t('header.github')}
          </a>
          {user ? (
            <button
              onClick={() => { setIsMobileMenuOpen(false); onLogout(); }}
              className="py-2.5 px-3 rounded-lg text-sm font-body text-left text-slate-400 hover:text-white hover:bg-white/5 transition-colors sm:hidden"
            >
              {t('header.logout')}
            </button>
          ) : (
            <button
              onClick={() => { setIsMobileMenuOpen(false); onOpenAuth('login'); }}
              className="py-2.5 px-3 rounded-lg text-sm font-body text-left text-slate-300 hover:text-white hover:bg-white/5 transition-colors sm:hidden"
            >
              {t('header.signIn')}
            </button>
          )}
        </nav>
      )}
    </header>
  );
}
