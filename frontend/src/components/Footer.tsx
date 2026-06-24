import { useLanguage } from '../i18n/LanguageContext';

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-white/5 bg-black/20 py-12 relative z-10">
      <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <span className="font-heading text-lg font-bold text-white tracking-wider uppercase">
            Space<span className="text-accent">Fetch</span>
          </span>
          <span className="text-[10px] font-mono bg-blue-500/10 text-accent px-2 py-0.5 rounded border border-blue-500/20">
            v1.0.0
          </span>
        </div>

        {/* Links */}
        <div className="flex flex-wrap gap-8 text-sm font-body text-slate-400">
          <a href="#problem-solution" className="hover:text-white transition-colors">{t('header.comparison')}</a>
          <a href="#features" className="hover:text-white transition-colors">{t('header.features')}</a>
          <a href="#demo" className="hover:text-white transition-colors">{t('header.demo')}</a>
          <a href="https://github.com/sargisis/SpaceFetch" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">{t('header.github')}</a>
        </div>

        {/* Copyright */}
        <div className="text-xs font-mono text-slate-500">
          &copy; {new Date().getFullYear()} {t('footer.desc')}
        </div>
      </div>
    </footer>
  );
}
