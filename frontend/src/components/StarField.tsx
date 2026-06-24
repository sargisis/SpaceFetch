import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function Stars() {
  const ref = useRef<THREE.Points>(null);

  // Generate star positions in a 3D sphere
  const [positions] = useMemo(() => {
    const count = 3000;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 20 + Math.random() * 80;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    return [positions];
  }, []);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.015;
      ref.current.rotation.x += delta * 0.005;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.18}
        color="#22D3EE"
        sizeAttenuation={true}
        transparent={true}
        opacity={0.7}
        depthWrite={false}
      />
    </points>
  );
}

export default function StarField() {
  return (
    <div className="fixed inset-0 -z-20 pointer-events-none bg-[#05070D]">
      <Canvas camera={{ position: [0, 0, 50], fov: 60 }}>
        <color attach="background" args={["#05070D"]} />
        <Stars />
      </Canvas>
    </div>
  );
}
