'use client';

import { Canvas } from '@react-three/fiber';
import { Float, Line } from '@react-three/drei';
import { useRef, Suspense } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

// Node positions for the network
const KNOWN_NODES: [number, number, number][] = [
  [-2.5, 2, 0], [-0.5, 2.2, 0.3], [1.5, 1.8, -0.2], [3, 2.5, 0.1],
  [-3, 0.5, 0.5], [-1, 0.8, 0], [1, 0.5, 0.3], [2.5, 1, -0.3], [3.5, 0.2, 0.2],
  [-2, -0.5, 0.2], [0, -0.3, -0.2], [2, -0.8, 0.4],
];

const UNKNOWN_NODES: [number, number, number][] = [
  [-3.5, -1.5, 0.8], [-1.5, -2, 0.5], [0.5, -1.8, 0.3], [2.5, -2.2, 0.6], [3.8, -1.2, 0.4],
];

const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [0, 4], [1, 5], [2, 6], [3, 7],
  [4, 5], [5, 6], [6, 7], [7, 8], [4, 9], [5, 10], [6, 11], [9, 10], [10, 11],
];

function NetworkNode({ position, isKnown, pulseOffset = 0 }: { position: [number, number, number]; isKnown: boolean; pulseOffset?: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current && isKnown) {
      const pulse = Math.sin(state.clock.elapsedTime * 2 + pulseOffset) * 0.1 + 1;
      meshRef.current.scale.setScalar(pulse);
    }
    if (glowRef.current && isKnown) {
      const glowPulse = Math.sin(state.clock.elapsedTime * 1.5 + pulseOffset) * 0.15 + 0.85;
      glowRef.current.scale.setScalar(glowPulse * 2.5);
    }
  });

  const nodeColor = isKnown ? '#3B82F6' : '#94A3B8';
  const nodeSize = isKnown ? 0.12 : 0.08;

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[nodeSize, 16, 16]} />
        <meshStandardMaterial color={nodeColor} emissive={isKnown ? '#3B82F6' : '#000000'} emissiveIntensity={isKnown ? 0.5 : 0} roughness={0.3} metalness={0.2} />
      </mesh>
      {isKnown && (
        <mesh ref={glowRef}>
          <sphereGeometry args={[nodeSize * 2, 16, 16]} />
          <meshBasicMaterial color="#3B82F6" transparent opacity={0.15} />
        </mesh>
      )}
    </group>
  );
}

function ConnectionLine({ start, end }: { start: [number, number, number]; end: [number, number, number] }) {
  return <Line points={[start, end]} color="#3B82F6" lineWidth={1.5} transparent opacity={0.35} />;
}

function DisconnectedLine({ start, end }: { start: [number, number, number]; end: [number, number, number] }) {
  const midPoint: [number, number, number] = [
    start[0] + (end[0] - start[0]) * 0.3,
    start[1] + (end[1] - start[1]) * 0.3,
    start[2] + (end[2] - start[2]) * 0.3,
  ];
  return <Line points={[start, midPoint]} color="#CBD5E1" lineWidth={1} transparent opacity={0.2} dashed dashSize={0.05} gapSize={0.03} />;
}

function YourProductNode() {
  const nodeRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (nodeRef.current) {
      nodeRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.1;
      const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.1 + 1;
      nodeRef.current.scale.setScalar(pulse);
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.elapsedTime * 0.3;
      const ringPulse = Math.sin(state.clock.elapsedTime * 1.5) * 0.1 + 1;
      ringRef.current.scale.setScalar(ringPulse);
    }
  });

  return (
    <group position={[0, -2.5, 1]}>
      <mesh ref={nodeRef}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#F59E0B" emissive="#F59E0B" emissiveIntensity={0.4} roughness={0.3} metalness={0.2} />
      </mesh>
      <mesh><sphereGeometry args={[0.25, 16, 16]} /><meshBasicMaterial color="#F59E0B" transparent opacity={0.1} /></mesh>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.35, 0.012, 8, 32]} /><meshBasicMaterial color="#F59E0B" transparent opacity={0.25} /></mesh>
      <DisconnectedLine start={[0, 0, 0]} end={[-1.5, 2, -0.5]} />
      <DisconnectedLine start={[0, 0, 0]} end={[0, 2.2, -0.3]} />
      <DisconnectedLine start={[0, 0, 0]} end={[1.5, 2, -0.3]} />
    </group>
  );
}

function Scene() {
  return (
    <Float speed={0.4} rotationIntensity={0.08} floatIntensity={0.2}>
      <group>
        {CONNECTIONS.map(([startIdx, endIdx], i) => (
          <ConnectionLine key={`conn-${i}`} start={KNOWN_NODES[startIdx]} end={KNOWN_NODES[endIdx]} />
        ))}
        {KNOWN_NODES.map((pos, i) => <NetworkNode key={`known-${i}`} position={pos} isKnown={true} pulseOffset={i * 0.5} />)}
        {UNKNOWN_NODES.map((pos, i) => <NetworkNode key={`unknown-${i}`} position={pos} isKnown={false} />)}
        <YourProductNode />
      </group>
    </Float>
  );
}

export default function FloatingBubbles() {
  return (
    <div className="absolute inset-0 pointer-events-none z-0 opacity-70">
      <Canvas camera={{ position: [0, 0, 7], fov: 50 }} dpr={[1, 1.5]} className="!absolute inset-0">
        <Suspense fallback={null}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={0.6} />
          <pointLight position={[-3, 2, 2]} intensity={0.4} color="#3B82F6" />
          <pointLight position={[0, -2, 3]} intensity={0.2} color="#F59E0B" />
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}
