import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Zap, Shield, Layers, Code, Globe } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  index: number;
}

function TiltCard({ icon, title, description, index }: FeatureCardProps) {
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    // Calculate rotation angles
    setCoords({ x: x * 12, y: -y * 12 });

    // Track mouse coordinates relative to the card for cursor glow
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 35 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setCoords({ x: 0, y: 0 });
      }}
      className="group relative overflow-hidden glass-panel glass-panel-hover p-8 flex flex-col items-start cursor-default select-none h-full"
      style={{
        transform: isHovered
          ? `perspective(1000px) rotateX(${coords.y}deg) rotateY(${coords.x}deg) scale3d(1.02, 1.02, 1.02)`
          : `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`,
        transition: isHovered ? 'none' : 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), border-color 0.3s ease, shadow 0.3s ease',
      }}
    >
      {/* Glow track overlay */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none -z-10"
        style={{
          background: `radial-gradient(circle 180px at ${mousePos.x}px ${mousePos.y}px, rgba(34, 211, 238, 0.08), transparent 80%)`,
        }}
      />

      {/* Border glow overlay */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-xl border border-accent/20"
        style={{
          maskImage: `radial-gradient(circle 120px at ${mousePos.x}px ${mousePos.y}px, black, transparent)`,
          WebkitMaskImage: `radial-gradient(circle 120px at ${mousePos.x}px ${mousePos.y}px, black, transparent)`,
        }}
      />

      {/* Feature Icon */}
      <div className="p-3.5 bg-blue-500/10 rounded-lg text-accent mb-6 group-hover:text-white transition-colors duration-300 border border-blue-500/20 group-hover:bg-primary group-hover:border-transparent">
        {icon}
      </div>

      <h3 className="text-xl font-bold font-heading mb-3 text-white">
        {title}
      </h3>

      <p className="text-slate-400 font-body font-light text-sm leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
}

export default function Features() {
  const { t } = useLanguage();

  const list = [
    {
      icon: <Sparkles className="h-6 w-6" />,
      title: t('features.f1Title'),
      description: t('features.f1Desc'),
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: t('features.f2Title'),
      description: t('features.f2Desc'),
    },
    {
      icon: <Layers className="h-6 w-6" />,
      title: t('features.f3Title'),
      description: t('features.f3Desc'),
    },
    {
      icon: <Globe className="h-6 w-6" />,
      title: t('features.f4Title'),
      description: t('features.f4Desc'),
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: t('features.f5Title'),
      description: t('features.f5Desc'),
    },
    {
      icon: <Code className="h-6 w-6" />,
      title: t('features.f6Title'),
      description: t('features.f6Desc'),
    },
  ];

  return (
    <section id="features" className="py-24 relative">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-20">
          <h2 className="text-3xl md:text-5xl font-bold font-heading mb-4 text-white">
            {t('features.title')}
          </h2>
          <p className="text-slate-400 font-body font-light">
            {t('features.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {list.map((item, idx) => (
            <TiltCard
              key={idx}
              icon={item.icon}
              title={item.title}
              description={item.description}
              index={idx}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
