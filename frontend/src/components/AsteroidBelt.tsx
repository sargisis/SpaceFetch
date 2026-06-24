import { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

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

interface AsteroidBeltProps {
  asteroids: AsteroidData[];
  selectedId: string | null;
  onSelect: (asteroid: AsteroidData) => void;
}

function SingleAsteroid({
  asteroid,
  index,
  isSelected,
  onSelect
}: {
  asteroid: AsteroidData;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Calculate stable orbit parameters based on unique indexes
  const orbitParams = useMemo(() => {
    const seed = index * 153.47;
    
    // Orbital distance spacing (between 3.3 and 5.5 units from Earth)
    const radius = 3.4 + index * 0.4;
    const speed = 0.08 + Math.abs(Math.sin(seed)) * 0.08;
    const startAngle = seed % (Math.PI * 2);
    
    // Orbital inclination planes (X and Z tilts)
    const inclinationX = Math.cos(seed * 2) * 0.35;
    const inclinationZ = Math.sin(seed * 3) * 0.15;
    
    // Scale mesh based on physical diameter meters
    const diameter = asteroid.metrics?.diameter_meters || 50;
    const scale = THREE.MathUtils.lerp(0.04, 0.14, Math.min(diameter / 250, 1.0));
    
    return { radius, speed, startAngle, inclinationX, inclinationZ, scale };
  }, [index, asteroid]);

  const angle = useRef(orbitParams.startAngle);

  // Animate asteroid movement on every frame
  useFrame((_, delta) => {
    angle.current += delta * orbitParams.speed;
    if (meshRef.current) {
      const x = Math.cos(angle.current) * orbitParams.radius;
      const z = Math.sin(angle.current) * orbitParams.radius;
      
      meshRef.current.position.set(x, 0, z);
      meshRef.current.rotation.y += delta * 0.4;
      meshRef.current.rotation.x += delta * 0.15;
    }
  });

  return (
    <group rotation={[orbitParams.inclinationX, 0, orbitParams.inclinationZ]}>
      {/* Trajectory Ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[orbitParams.radius - 0.005, orbitParams.radius + 0.005, 64]} />
        <meshBasicMaterial
          color={asteroid.is_hazardous ? '#EF4444' : '#22D3EE'}
          transparent={true}
          opacity={isSelected ? 0.3 : hovered ? 0.18 : 0.05}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Actual Space Rock (Icosahedron Geometry) */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
          document.body.style.cursor = 'default';
        }}
      >
        <icosahedronGeometry args={[orbitParams.scale, 1]} />
        <meshStandardMaterial
          color={isSelected ? '#FBBF24' : hovered ? '#22D3EE' : asteroid.is_hazardous ? '#EF4444' : '#A1A1AA'}
          emissive={isSelected ? '#FBBF24' : hovered ? '#22D3EE' : asteroid.is_hazardous ? '#EF4444' : '#000000'}
          emissiveIntensity={isSelected ? 1.4 : hovered ? 0.8 : asteroid.is_hazardous ? 0.5 : 0.0}
          flatShading={true}
          roughness={0.95}
          metalness={0.1}
        />
      </mesh>
    </group>
  );
}

export default function AsteroidBelt({ asteroids, selectedId, onSelect }: AsteroidBeltProps) {
  return (
    <group>
      {asteroids.map((asteroid, index) => (
        <SingleAsteroid
          key={asteroid.id}
          asteroid={asteroid}
          index={index}
          isSelected={selectedId === asteroid.id}
          onSelect={() => onSelect(asteroid)}
        />
      ))}
    </group>
  );
}
