import { Suspense, lazy, useState, useEffect } from 'react';
import Header from './components/Header';
import AuthModal from './components/AuthModal';
import ProblemSolution from './components/ProblemSolution';
import Features from './components/Features';
import LiveDemo from './components/LiveDemo';
import CTA from './components/CTA';
import Footer from './components/Footer';

// Lazy load 3D heavy components for optimized load time
const StarField = lazy(() => import('./components/StarField'));
const Hero = lazy(() => import('./components/Hero'));

export default function App() {
  const [user, setUser] = useState<{ email: string; apiKey: string; tier: string } | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');

  useEffect(() => {
    const savedUser = localStorage.getItem('sf_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Failed to parse saved user from local storage', e);
      }
    }
  }, []);

  const handleLoginSuccess = (userData: { email: string; apiKey: string; tier: string }) => {
    setUser(userData);
    localStorage.setItem('sf_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('sf_user');
  };

  const handleOpenAuth = (tab: 'login' | 'register') => {
    setAuthTab(tab);
    setIsAuthOpen(true);
  };

  return (
    <div className="relative min-h-screen text-slate-200">
      {/* 3D Starfield Background */}
      <Suspense fallback={null}>
        <StarField />
      </Suspense>

      {/* Main Layout */}
      <div className="relative z-10">
        <Header user={user} onOpenAuth={handleOpenAuth} onLogout={handleLogout} />

        <Suspense fallback={
          <div className="flex h-screen w-full items-center justify-center text-accent/50 font-mono animate-pulse">
            LOADING SPACE ENVIRONMENT...
          </div>
        }>
          <Hero user={user} onOpenAuth={handleOpenAuth} />
        </Suspense>

        <ProblemSolution />
        <Features />
        <LiveDemo user={user} />
        <CTA user={user} onOpenAuth={handleOpenAuth} />
        <Footer />
      </div>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        defaultTab={authTab}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}
