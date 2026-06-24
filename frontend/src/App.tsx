import { Suspense, lazy } from 'react';
import ProblemSolution from './components/ProblemSolution';
import Features from './components/Features';
import LiveDemo from './components/LiveDemo';
import CTA from './components/CTA';
import Footer from './components/Footer';

// Lazy load 3D heavy components for optimized load time
const StarField = lazy(() => import('./components/StarField'));
const Hero = lazy(() => import('./components/Hero'));

export default function App() {
  return (
    <div className="relative min-h-screen text-slate-200">
      {/* 3D Starfield Background */}
      <Suspense fallback={null}>
        <StarField />
      </Suspense>

      {/* Main Layout */}
      <div className="relative z-10">
        <Suspense fallback={
          <div className="flex h-screen w-full items-center justify-center text-accent/50 font-mono animate-pulse">
            LOADING SPACE ENVIRONMENT...
          </div>
        }>
          <Hero />
        </Suspense>

        <ProblemSolution />
        <Features />
        <LiveDemo />
        <CTA />
        <Footer />
      </div>
    </div>
  );
}
