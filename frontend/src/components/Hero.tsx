import { useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { motion } from 'framer-motion';

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

function Scene() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1.5} castShadow />
      <pointLight position={[-5, -5, -5]} intensity={0.5} color="#3B82F6" />
      <InteractiveEarth />
      <EffectComposer>
        <Bloom luminanceThreshold={0.15} luminanceSmoothing={0.8} height={300} opacity={0.8} />
      </EffectComposer>
    </>
  );
}

export default function Hero() {
  return (
    <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
      {/* 3D Canvas Background */}
      <div className="absolute inset-0 w-full h-full -z-10">
        <Suspense fallback={
          <div className="flex h-full w-full items-center justify-center text-accent/50 font-mono animate-pulse">
            INITIALIZING 3D WORLD...
          </div>
        }>
          <Canvas
            camera={{ position: [0, 0, 6.5], fov: 45 }}
            gl={{ antialias: true, alpha: true }}
          >
            <Scene />
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
              Now active: Groq-powered normalization
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold font-heading mb-6 bg-gradient-to-r from-white via-slate-100 to-blue-400 bg-clip-text text-transparent leading-none">
            Raw NASA data in.<br />
            <span className="text-accent">Clean API out.</span>
          </h1>

          <p className="text-lg md:text-xl font-body text-slate-400 max-w-2xl mx-auto mb-8 font-light leading-relaxed">
            Stop scraping messy NASA endpoints. SpaceFetch cleans, structures, and serves APOD, NeoWs, EPIC, and Mars Rover data via a unified, blazingly fast endpoint.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <motion.a
              href="#demo"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-3.5 rounded-lg bg-primary hover:bg-blue-600 text-white font-semibold transition-all shadow-[0_0_20px_rgba(59,130,246,0.4)] border border-blue-400/20"
            >
              Get Started Free
            </motion.a>
            <motion.a
              href="#problem-solution"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-3.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-semibold border border-white/10 backdrop-blur-md transition-all"
            >
              Learn More
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
          <span className="text-[10px] tracking-widest font-mono text-accent uppercase">Explore</span>
          <div className="h-6 w-3.5 rounded-full border border-accent/40 flex justify-center p-1">
            <div className="h-1.5 w-1.5 rounded-full bg-accent" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
