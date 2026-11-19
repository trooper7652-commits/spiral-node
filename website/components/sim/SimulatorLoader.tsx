"use client";
import dynamic from "next/dynamic";
import type { SimControl } from "./Simulator";
import StillDevice from "./StillDevice";

// next/dynamic with ssr:false must live in a client component. Nothing of the simulator
// (worker, Pyodide, canvas) loads until this chunk is fetched, and Pyodide waits for "Power on".
const Simulator = dynamic(() => import("@/components/sim/Simulator"), { ssr: false, loading: () => <StillDevice /> });

export default function SimulatorLoader({ onControl }: { onControl?: (c: SimControl) => void }) {
  return <Simulator onControl={onControl} />;
}
