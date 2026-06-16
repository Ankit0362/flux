"use client";

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial, OrbitControls, Sphere } from '@react-three/drei';
import * as THREE from 'three';

function ParticleSwarm(props: any) {
  const ref = useRef<any>(null);
  const count = 5000;
  
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Generate points inside a sphere
      const r = 2 * Math.cbrt(Math.random());
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return pos;
  }, []);

  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.rotation.x -= delta / 10;
      ref.current.rotation.y -= delta / 15;
    }
  });

  return (
    <group rotation={[0, 0, Math.PI / 4]}>
      <Points ref={ref} positions={positions} stride={3} frustumCulled={false} {...props}>
        <PointMaterial
          transparent
          color="#00F0FF"
          size={0.015}
          sizeAttenuation={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </Points>
    </group>
  );
}

function CoreSphere() {
  const ref = useRef<any>(null);
  useFrame((_state) => {
    if (ref.current) {
      ref.current.rotation.y += 0.002;
      ref.current.rotation.x += 0.001;
    }
  });
  return (
    <Sphere ref={ref} args={[1, 32, 32]}>
      <meshStandardMaterial 
        color="#000000"
        emissive="#B200FF"
        emissiveIntensity={0.5}
        wireframe
        transparent
        opacity={0.15}
        blending={THREE.AdditiveBlending}
      />
    </Sphere>
  );
}

export default function NeuralCore() {
  return (
    <div className="absolute inset-0 z-0 pointer-events-auto">
      <Canvas camera={{ position: [0, 0, 4] }}>
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color="#00F0FF" />
        <ParticleSwarm />
        <CoreSphere />
        <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} enablePan={false} />
      </Canvas>
    </div>
  );
}
