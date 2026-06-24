import { useRef, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import AsteroidBelt from './AsteroidBelt';
import RadarDetailsCard from './RadarDetailsCard';
import { useLanguage } from '../i18n/LanguageContext';

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

const mockAsteroids: AsteroidData[] = [
  {
    id: "3724056",
    name: "(2015 NG13)",
    is_hazardous: false,
    metrics: {
      diameter_meters: 45.0,
      velocity_km_h: 64186.3,
      miss_distance_km: 63745553.1
    },
    mining_economy: {
      estimated_value_usd: 4566651,
      primary_materials: ["nickel", "iron"],
      mining_difficulty: "low"
    },
    ai_summary: {
      en: "Asteroid (2015 NG13) is a 45-meter space rock hurtling at 64,186 km/h. Packed with iron and nickel worth $4.5M.",
      ru: "Астероид (2015 NG13) — 45-метровый космический камень, летящий со скоростью 64186 км/ч. Оценочная стоимость: $4.5 млн."
    }
  },
  {
    id: "99942",
    name: "(99942 Apophis)",
    is_hazardous: true,
    metrics: {
      diameter_meters: 370.0,
      velocity_km_h: 110290.0,
      miss_distance_km: 37900.0
    },
    mining_economy: {
      estimated_value_usd: 87900000000,
      primary_materials: ["nickel", "iron", "cobalt"],
      mining_difficulty: "high"
    },
    ai_summary: {
      en: "Apophis is a massive 370-meter asteroid. Extremely close flyby, packed with industrial cobalt and nickel worth $87.9B.",
      ru: "Апофис — массивный 370-метровый астероид. Пролетит экстремально близко к Земле. Богат кобальтом на $87.9 млрд."
    }
  },
  {
    id: "101955",
    name: "(101955 Bennu)",
    is_hazardous: true,
    metrics: {
      diameter_meters: 490.0,
      velocity_km_h: 101000.0,
      miss_distance_km: 2030000.0
    },
    mining_economy: {
      estimated_value_usd: 672000000000,
      primary_materials: ["water", "platinum", "gold"],
      mining_difficulty: "medium"
    },
    ai_summary: {
      en: "Bennu is a major water and gold rich carbonaceous asteroid, containing reserves valued at $672B.",
      ru: "Бенну — богатый водой и золотом углеродистый астероид. Запасы платины и золота оцениваются в $672 млрд."
    }
  },
  {
    id: "2026SF",
    name: "(2026 SpaceFetch)",
    is_hazardous: false,
    metrics: {
      diameter_meters: 95.0,
      velocity_km_h: 42100.0,
      miss_distance_km: 14200000.0
    },
    mining_economy: {
      estimated_value_usd: 12500000,
      primary_materials: ["silicates", "platinum"],
      mining_difficulty: "low"
    },
    ai_summary: {
      en: "A newly normalized target. Easy mining difficulty, containing silicates and platinum worth $12.5M.",
      ru: "Вновь обнаруженный астероид. Низкая сложность освоения, содержит силикаты и платину на $12.5 млн."
    }
  }
];

function InteractiveEarth() {
  const outerGroupRef = useRef<THREE.Group>(null);
  const innerGroupRef = useRef<THREE.Group>(null);
  const satelliteRef = useRef<THREE.Mesh>(null);
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useFrame((state, delta) => {
    // Continuous rotation for Earth
    if (innerGroupRef.current) {
      innerGroupRef.current.rotation.y += delta * 0.15;
    }

    // Parallax tilt based on mouse position
    if (outerGroupRef.current) {
      outerGroupRef.current.rotation.x = THREE.MathUtils.lerp(
        outerGroupRef.current.rotation.x,
        mouse.current.y * 0.25,
        0.05
      );
      outerGroupRef.current.rotation.y = THREE.MathUtils.lerp(
        outerGroupRef.current.rotation.y,
        mouse.current.x * 0.25,
        0.05
      );
    }

    // Satellite Orbit
    if (satelliteRef.current) {
      const time = state.clock.getElapsedTime();
      satelliteRef.current.position.x = Math.cos(time * 0.8) * 3.8;
      satelliteRef.current.position.z = Math.sin(time * 0.8) * 3.8;
      satelliteRef.current.position.y = Math.sin(time * 0.4) * 1.5;
      satelliteRef.current.rotation.y -= delta * 0.5;
    }
  });

  return (
    <group ref={outerGroupRef}>
      {/* Interactive low-poly Earth */}
      <group ref={innerGroupRef}>
        {/* Solid Ocean Globe */}
        <mesh castShadow receiveShadow>
          <icosahedronGeometry args={[2.2, 2]} />
          <meshStandardMaterial
            color="#0B132B"
            roughness={0.8}
            metalness={0.2}
            flatShading={true}
          />
        </mesh>

        {/* Wireframe Landmass / Atmosphere Globe */}
        <mesh>
          <icosahedronGeometry args={[2.24, 2]} />
          <meshStandardMaterial
            color="#3B82F6"
            wireframe={true}
            transparent={true}
            opacity={0.35}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>

      {/* Satellite Probe */}
      <mesh ref={satelliteRef}>
        <boxGeometry args={[0.2, 0.2, 0.3]} />
        <meshStandardMaterial color="#22D3EE" emissive="#22D3EE" emissiveIntensity={1} />
        {/* Solar panels */}
        <mesh position={[0.25, 0, 0]}>
          <boxGeometry args={[0.3, 0.02, 0.15]} />
          <meshStandardMaterial color="#3B82F6" />
        </mesh>
        <mesh position={[-0.25, 0, 0]}>
          <boxGeometry args={[0.3, 0.02, 0.15]} />
          <meshStandardMaterial color="#3B82F6" />
        </mesh>
      </mesh>

      {/* Orbit ring visual */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.78, 3.82, 64]} />
        <meshBasicMaterial color="#22D3EE" transparent={true} opacity={0.05} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

interface SceneProps {
  asteroids: AsteroidData[];
  selectedId: string | null;
  onSelectAsteroid: (asteroid: AsteroidData) => void;
}

function Scene({ asteroids, selectedId, onSelectAsteroid }: SceneProps) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1.5} castShadow />
      <pointLight position={[-5, -5, -5]} intensity={0.5} color="#3B82F6" />
      <InteractiveEarth />
      
      {/* 3D Asteroid radar objects */}
      <AsteroidBelt
        asteroids={asteroids}
        selectedId={selectedId}
        onSelect={onSelectAsteroid}
      />
      
      <EffectComposer>
        <Bloom luminanceThreshold={0.15} luminanceSmoothing={0.8} height={300} opacity={0.8} />
      </EffectComposer>
    </>
  );
}

interface HeroProps {
  user: { email: string; apiKey: string; tier: string } | null;
  onOpenAuth: (tab: 'login' | 'register') => void;
}

export default function Hero({ user, onOpenAuth }: HeroProps) {
  const { t } = useLanguage();
  const [asteroids, setAsteroids] = useState<AsteroidData[]>(mockAsteroids);
  const [selectedAsteroid, setSelectedAsteroid] = useState<AsteroidData | null>(null);

  useEffect(() => {
    if (user) {
      // Fetch live normalizations from local Go backend API using user credentials
      fetch('http://localhost:8080/v1/asteroids/today', {
        headers: {
          'X-API-Key': user.apiKey,
        },
      })
        .then((res) => {
          if (!res.ok) throw new Error('CORS or backend connection failed');
          return res.json();
        })
        .then((resData) => {
          if (resData.status === 'success' && Array.isArray(resData.data) && resData.data.length > 0) {
            setAsteroids(resData.data);
          }
        })
        .catch((err) => {
          console.warn('Backend server offline. Utilizing high-fidelity simulated asteroids.', err);
          setAsteroids(mockAsteroids);
        });
    } else {
      setAsteroids(mockAsteroids);
    }
  }, [user]);

  return (
    <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
      {/* 3D Canvas Background */}
      <div className="absolute inset-0 w-full h-full -z-10">
        <Suspense fallback={
          <div className="flex h-full w-full items-center justify-center text-accent/50 font-mono animate-pulse">
            {t('hero.loadingSpace')}
          </div>
        }>
          <Canvas
            camera={{ position: [0, 0, 6.5], fov: 45 }}
            gl={{ antialias: true, alpha: true }}
          >
            <Scene
              asteroids={asteroids}
              selectedId={selectedAsteroid ? selectedAsteroid.id : null}
              onSelectAsteroid={setSelectedAsteroid}
            />
          </Canvas>
        </Suspense>
      </div>

      {/* Content overlay */}
      <div className="container mx-auto px-6 z-10 text-center flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-4xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 mb-6 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-accent animate-ping" />
            <span className="text-xs font-mono tracking-wider uppercase text-accent font-semibold">
              {t('hero.badge')}
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold font-heading mb-6 bg-gradient-to-r from-white via-slate-100 to-blue-400 bg-clip-text text-transparent leading-none">
            {t('hero.title')}
          </h1>

          <p className="text-lg md:text-xl font-body text-slate-400 max-w-2xl mx-auto mb-8 font-light leading-relaxed">
            {t('hero.subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <motion.button
              onClick={() => {
                if (user) {
                  document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
                } else {
                  onOpenAuth('register');
                }
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-3.5 rounded-lg bg-primary hover:bg-blue-600 text-white font-semibold transition-all shadow-[0_0_20px_rgba(59,130,246,0.4)] border border-blue-400/20 cursor-pointer"
            >
              {user ? t('hero.demoButton') : t('hero.getStarted')}
            </motion.button>
            <motion.a
              href="#problem-solution"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-3.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-semibold border border-white/10 backdrop-blur-md transition-all"
            >
              {t('hero.learnMore')}
            </motion.a>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          className="absolute bottom-10 flex flex-col items-center gap-2 cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
          onClick={() => document.getElementById('problem-solution')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <span className="text-[10px] tracking-widest font-mono text-accent uppercase">{t('hero.explore')}</span>
          <div className="h-6 w-3.5 rounded-full border border-accent/40 flex justify-center p-1">
            <div className="h-1.5 w-1.5 rounded-full bg-accent" />
          </div>
        </motion.div>
      </div>

      {/* Floating Asteroid Radar details sidebar */}
      <AnimatePresence>
        {selectedAsteroid && (
          <RadarDetailsCard
            asteroid={selectedAsteroid}
            onClose={() => setSelectedAsteroid(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
