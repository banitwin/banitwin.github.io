import React, { useEffect, useState, useCallback } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Code2,
  Copy,
  Cpu,
  Download,
  Gauge,
  Layers,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import {
  CABLE_CONSTANTS,
  CablePhysicsInput,
  calculateThermalState,
} from "./utils/physicsEngine";
import { CableThermalHeatmap } from "./components/CableThermalHeatmap";
import { DTRTimeSeriesChart } from "./components/DTRTimeSeriesChart";
import { STREAMLIT_APP_PY_CODE } from "./utils/streamlitCodeTemplate";

interface CopilotBullet {
  category: string;
  severity: "nominal" | "warning" | "critical" | "info" | string;
  message: string;
}

interface CopilotResponse {
  source: string;
  model: string;
  timestamp: string;
  bullets: CopilotBullet[];
}

const DEFAULT_SCADA_INPUTS: CablePhysicsInput = {
  currentLoad: 950,
  ambientTemp: 28.0,
  soilResistivity: 1.0,
  cableDepth: 1.2,
};

const SCADA_PRESETS: Array<{
  id: string;
  label: string;
  desc: string;
  values: CablePhysicsInput;
}> = [
  {
    id: "nominal",
    label: "Nominal Dispatch (950A)",
    desc: "Standard Metro Substation load (+28.0% unlocked capacity)",
    values: { currentLoad: 950, ambientTemp: 28.0, soilResistivity: 1.0, cableDepth: 1.2 },
  },
  {
    id: "heatwave",
    label: "Emergency N-1 Overload (1180A)",
    desc: "High feeder current + dry soil triggering >85°C thermal alert",
    values: { currentLoad: 1180, ambientTemp: 34.5, soilResistivity: 1.4, cableDepth: 1.4 },
  },
  {
    id: "winter-wind",
    label: "Cool Soil High Renewables (1060A)",
    desc: "Low soil resistivity unlocking >1150A dynamic ampacity",
    values: { currentLoad: 1060, ambientTemp: 16.0, soilResistivity: 0.7, cableDepth: 1.0 },
  },
];

export function App() {
  const [inputs, setInputs] = useState<CablePhysicsInput>(DEFAULT_SCADA_INPUTS);
  const [activeView, setActiveView] = useState<"scada" | "physics" | "streamlit" | "github">("scada");
  const [copilotData, setCopilotData] = useState<CopilotResponse | null>(null);
  const [isCopilotLoading, setIsCopilotLoading] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const physics = calculateThermalState(inputs);

  const fetchCopilotGuidance = useCallback(async (stateInput: CablePhysicsInput) => {
    setIsCopilotLoading(true);
    const computed = calculateThermalState(stateInput);
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentLoad: stateInput.currentLoad,
          ambientTemp: stateInput.ambientTemp,
          soilResistivity: stateInput.soilResistivity,
          cableDepth: stateInput.cableDepth,
          hotspotTemp: computed.hotspotTemp,
          dynamicCapacity: computed.dynamicCapacity,
          unlockedCapacityPct: computed.unlockedCapacityPct,
          qLoss: computed.qLoss,
          rThTotal: computed.rThTotal,
          nodeName: "Node 407 - Metro Substation",
        }),
      });
      if (res.ok) {
        const json: CopilotResponse = await res.json();
        setCopilotData(json);
      }
    } catch {
      // Local fallback
    } finally {
      setIsCopilotLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCopilotGuidance(inputs);
    }, 350);
    return () => clearTimeout(timer);
  }, [inputs, fetchCopilotGuidance]);

  const handleCopyStreamlitCode = () => {
    navigator.clipboard.writeText(STREAMLIT_APP_PY_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadStreamlitFile = () => {
    const blob = new Blob([STREAMLIT_APP_PY_CODE], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "app.py";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#0E1117] text-[#E0E0E0] flex flex-col">
      <header className="bg-[#11151C] border-b border-[#262C3A] px-6 py-3 flex items-center justify-between gap-4">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveView("scada");
          }}
          className="font-display text-lg font-bold tracking-wider text-white flex items-center gap-2 whitespace-nowrap"
        >
          <Zap className="w-5 h-5 text-[#00E5FF]" />
          <span>BaniTwin</span>
        </a>

        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-[#8E96AA]">
          <button
            type="button"
            onClick={() => setActiveView("scada")}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap ${
              activeView === "scada"
                ? "border-[#00E5FF] text-white"
                : "border-transparent hover:text-white"
            }`}
          >
            SCADA Control Room
          </button>
          <button
            type="button"
            onClick={() => setActiveView("physics")}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap ${
              activeView === "physics"
                ? "border-[#00E5FF] text-white"
                : "border-transparent hover:text-white"
            }`}
          >
            PINN Physics Engine
          </button>
          <button
            type="button"
            onClick={() => setActiveView("github")}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap ${
              activeView === "github"
                ? "border-[#00E5FF] text-white"
                : "border-transparent hover:text-white"
            }`}
          >
            GitHub Pages Guide
          </button>
          <button
            type="button"
            onClick={() => setActiveView("streamlit")}
            className={`py-1 border-b-2 transition-colors whitespace-nowrap ${
              activeView === "streamlit"
                ? "border-[#00E5FF] text-white"
                : "border-transparent hover:text-white"
            }`}
          >
            Streamlit app.py
          </button>
        </nav>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setActiveView(activeView === "github" ? "scada" : "github")}
            className="px-3 py-1.5 text-xs font-mono-tabular rounded border border-[#262C3A] bg-[#161A22] text-[#E0E0E0] hover:border-[#00E5FF] hover:text-[#00E5FF] transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <span>آموزش GitHub Pages</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadStreamlitFile}
            className="px-3.5 py-1.5 text-xs font-mono-tabular font-semibold rounded bg-[#00E5FF] text-[#0E1117] hover:bg-[#33ECFF] transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download app.py</span>
          </button>
        </div>
      </header>

      <div className="bg-[#161A22] border-b border-[#262C3A] px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 text-xs font-mono-tabular">
        <div className="flex items-center gap-2">
          <span className="text-[#8E96AA]">SYSTEM STATUS:</span>
          <span className="inline-flex items-center gap-1.5 text-[#00E676] font-bold">
            <span className="w-2 h-2 rounded-full bg-[#00E676] animate-pulse" />
            LIVE
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[#8E96AA]">GRID OPERATOR NODE:</span>
          <span className="text-[#00E5FF] font-semibold">Node 407 - Metro Substation</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[#8E96AA]">PINN SOLVER LATENCY:</span>
          <span className="text-[#FF9100] font-semibold">
            {physics.pinnLatencySec.toFixed(2)}s
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[#8E96AA]">PHYSICS LOSS CONVERGENCE:</span>
          <span className="text-[#FF9100] font-semibold">
            {physics.physicsLossMse.toFixed(5)}
          </span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[320px_1fr]">
        <aside className="bg-[#11151C] border-b lg:border-b-0 lg:border-r border-[#262C3A] p-5 flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-[#262C3A] pb-3">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-[#00E5FF]" />
                <h2 className="font-display text-sm font-bold tracking-wider uppercase text-white">
                  SCADA Control Panel
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setInputs(DEFAULT_SCADA_INPUTS)}
                title="Reset to default SCADA values"
                className="text-[11px] font-mono-tabular text-[#8E96AA] hover:text-[#00E5FF] flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="slider-load" className="text-[#E0E0E0] font-medium">
                  Current Load (I)
                </label>
                <span className="font-mono-tabular font-bold text-[#00E5FF] text-sm">
                  {inputs.currentLoad} A
                </span>
              </div>
              <input
                id="slider-load"
                type="range"
                min={400}
                max={1400}
                step={10}
                value={inputs.currentLoad}
                onChange={(e) =>
                  setInputs((prev) => ({ ...prev, currentLoad: Number(e.target.value) }))
                }
                className="w-full scada-slider"
              />
              <div className="flex justify-between text-[10px] font-mono-tabular text-[#8E96AA]">
                <span>400 A</span>
                <span>Static: 750 A</span>
                <span>1400 A</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="slider-ambient" className="text-[#E0E0E0] font-medium">
                  Ambient Soil Temp (T_amb)
                </label>
                <span className="font-mono-tabular font-bold text-[#00E5FF] text-sm">
                  {inputs.ambientTemp.toFixed(1)} °C
                </span>
              </div>
              <input
                id="slider-ambient"
                type="range"
                min={10.0}
                max={45.0}
                step={0.5}
                value={inputs.ambientTemp}
                onChange={(e) =>
                  setInputs((prev) => ({ ...prev, ambientTemp: Number(e.target.value) }))
                }
                className="w-full scada-slider"
              />
              <div className="flex justify-between text-[10px] font-mono-tabular text-[#8E96AA]">
                <span>10.0 °C</span>
                <span>Default: 28.0 °C</span>
                <span>45.0 °C</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="slider-rho" className="text-[#E0E0E0] font-medium">
                  Soil Thermal Resistivity (ρ)
                </label>
                <span className="font-mono-tabular font-bold text-[#00E5FF] text-sm">
                  {inputs.soilResistivity.toFixed(2)} K·m/W
                </span>
              </div>
              <input
                id="slider-rho"
                type="range"
                min={0.5}
                max={2.5}
                step={0.05}
                value={inputs.soilResistivity}
                onChange={(e) =>
                  setInputs((prev) => ({ ...prev, soilResistivity: Number(e.target.value) }))
                }
                className="w-full scada-slider"
              />
              <div className="flex justify-between text-[10px] font-mono-tabular text-[#8E96AA]">
                <span>0.5 (Moist)</span>
                <span>1.0 K·m/W</span>
                <span>2.5 (Dry)</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="slider-depth" className="text-[#E0E0E0] font-medium">
                  Installation Depth (z)
                </label>
                <span className="font-mono-tabular font-bold text-[#00E5FF] text-sm">
                  {inputs.cableDepth.toFixed(2)} m
                </span>
              </div>
              <input
                id="slider-depth"
                type="range"
                min={0.8}
                max={2.5}
                step={0.05}
                value={inputs.cableDepth}
                onChange={(e) =>
                  setInputs((prev) => ({ ...prev, cableDepth: Number(e.target.value) }))
                }
                className="w-full scada-slider"
              />
              <div className="flex justify-between text-[10px] font-mono-tabular text-[#8E96AA]">
                <span>0.80 m</span>
                <span>1.20 m</span>
                <span>2.50 m</span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#262C3A] space-y-2">
              <div className="text-[11px] font-mono-tabular uppercase tracking-wider text-[#8E96AA]">
                Grid Scenario Presets
              </div>
              <div className="space-y-1.5">
                {SCADA_PRESETS.map((preset) => {
                  const isCurrent =
                    inputs.currentLoad === preset.values.currentLoad &&
                    inputs.ambientTemp === preset.values.ambientTemp &&
                    inputs.soilResistivity === preset.values.soilResistivity &&
                    inputs.cableDepth === preset.values.cableDepth;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setInputs(preset.values)}
                      className={`w-full text-left p-2 rounded border transition-colors ${
                        isCurrent
                          ? "bg-[#00E5FF]/10 border-[#00E5FF] text-white"
                          : "bg-[#161A22] border-[#262C3A] text-[#E0E0E0] hover:border-[#3E485E]"
                      }`}
                    >
                      <div className="text-xs font-semibold font-mono-tabular text-[#00E5FF]">
                        {preset.label}
                      </div>
                      <div className="text-[11px] text-[#8E96AA] mt-0.5 leading-snug">
                        {preset.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-[#161A22] border border-[#262C3A] rounded p-3 space-y-1.5 font-mono-tabular text-[11px]">
            <div className="text-[#00E5FF] font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              <span>Cable Twin Specification</span>
            </div>
            <div className="text-[#8E96AA] space-y-1 pt-1">
              <div className="flex justify-between">
                <span>Model:</span>
                <span className="text-[#E0E0E0]">BaniTwin PINN v2.4</span>
              </div>
              <div className="flex justify-between">
                <span>Geometry:</span>
                <span className="text-[#E0E0E0]">Cylindrical 110kV Cu</span>
              </div>
              <div className="flex justify-between">
                <span>Insulation:</span>
                <span className="text-[#E0E0E0]">XLPE (T_max = 90.0°C)</span>
              </div>
              <div className="flex justify-between">
                <span>Joule Loss (q):</span>
                <span className="text-[#FF9100]">{physics.qLoss.toFixed(1)} W/m</span>
              </div>
              <div className="flex justify-between">
                <span>Total R_th:</span>
                <span className="text-[#00E5FF]">{physics.rThTotal.toFixed(3)} K·m/W</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="p-5 lg:p-6 space-y-5 overflow-x-hidden">
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div
              className={`bg-[#161A22] border border-[#262C3A] rounded-lg p-4 border-l-4 transition-colors ${
                physics.isOverheatingAlert ? "border-l-[#FF1744]" : "border-l-[#00E676]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono-tabular uppercase tracking-wider text-[#8E96AA]">
                  Max Cable Hotspot Temp
                </span>
                {physics.isOverheatingAlert ? (
                  <AlertTriangle className="w-4 h-4 text-[#FF1744]" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-[#00E676]" />
                )}
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span
                  className={`text-3xl font-bold font-mono-tabular ${
                    physics.isOverheatingAlert ? "text-[#FF1744]" : "text-[#00E676]"
                  }`}
                >
                  {physics.hotspotTemp.toFixed(1)}
                </span>
                <span className="text-sm font-mono-tabular text-[#8E96AA]">°C</span>
              </div>
              <div className="mt-2 text-[11px] font-mono-tabular flex items-center justify-between">
                <span className="text-[#8E96AA]">XLPE Limit: 90.0°C</span>
                <span
                  className={
                    physics.isOverheatingAlert ? "text-[#FF1744] font-semibold" : "text-[#00E676]"
                  }
                >
                  {physics.isOverheatingAlert
                    ? "▲ ALERT (>85°C)"
                    : `● Margin ${physics.thermalMarginC.toFixed(1)}°C`}
                </span>
              </div>
            </div>

            <div className="bg-[#161A22] border border-[#262C3A] rounded-lg p-4 border-l-4 border-l-[#00E5FF]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono-tabular uppercase tracking-wider text-[#8E96AA]">
                  Traditional Static Limit
                </span>
                <Layers className="w-4 h-4 text-[#00E5FF]" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-3xl font-bold font-mono-tabular text-white">
                  {physics.staticLimit.toFixed(0)}
                </span>
                <span className="text-sm font-mono-tabular text-[#8E96AA]">A</span>
              </div>
              <div className="mt-2 text-[11px] font-mono-tabular flex items-center justify-between text-[#8E96AA]">
                <span>IEC 60287 Conservative</span>
                <span>Fixed Seasonal Cap</span>
              </div>
            </div>

            <div className="bg-[#161A22] border border-[#262C3A] rounded-lg p-4 border-l-4 border-l-[#FF9100]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono-tabular uppercase tracking-wider text-[#8E96AA]">
                  BaniTwin PINN Dynamic Capacity
                </span>
                <Activity className="w-4 h-4 text-[#FF9100]" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-3xl font-bold font-mono-tabular text-[#FF9100]">
                  {physics.dynamicCapacity.toFixed(0)}
                </span>
                <span className="text-sm font-mono-tabular text-[#8E96AA]">A</span>
              </div>
              <div className="mt-2 text-[11px] font-mono-tabular flex items-center justify-between">
                <span className="text-[#8E96AA]">Real-Time DTR Ceiling</span>
                <span className="text-[#FF9100]">
                  {physics.unlockedAmps >= 0 ? "+" : ""}
                  {physics.unlockedAmps.toFixed(0)} A vs Static
                </span>
              </div>
            </div>

            <div className="bg-[#161A22] border border-[#262C3A] rounded-lg p-4 border-l-4 border-l-[#00E676]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono-tabular uppercase tracking-wider text-[#8E96AA]">
                  Unlocked Latent Grid Capacity
                </span>
                <Zap className="w-4 h-4 text-[#00E676]" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span
                  className={`text-3xl font-bold font-mono-tabular ${
                    physics.unlockedCapacityPct >= 0 ? "text-[#00E676]" : "text-[#FF1744]"
                  }`}
                >
                  {physics.unlockedCapacityPct >= 0 ? "+" : ""}
                  {physics.unlockedCapacityPct.toFixed(1)}
                </span>
                <span className="text-sm font-mono-tabular text-[#8E96AA]">%</span>
              </div>
              <div className="mt-2 text-[11px] font-mono-tabular flex items-center justify-between text-[#8E96AA]">
                <span>Throughput Gain</span>
                <span className="text-[#00E676]">Zero CapEx Expansion</span>
              </div>
            </div>
          </section>

          {activeView === "scada" && (
            <>
              <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <CableThermalHeatmap
                  physics={physics}
                  ambientTemp={inputs.ambientTemp}
                  cableDepth={inputs.cableDepth}
                />
                <DTRTimeSeriesChart physics={physics} />
              </section>

              <section className="bg-[#161A22] border border-[#00E5FF]/60 rounded-lg p-5 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-[#262C3A]">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-5 h-5 text-[#00E5FF]" />
                    <div>
                      <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[#00E5FF]">
                        BaniTwin Physics-Informed AI Grid Safety Copilot
                      </h3>
                      <p className="text-xs text-[#8E96AA]">
                        Executive 3-Bullet Dispatch Recommendations Synthesized from Real-Time PINN Thermal State
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {copilotData && (
                      <span className="text-[11px] font-mono-tabular text-[#8E96AA]">
                        Engine: <strong className="text-[#E0E0E0]">{copilotData.model}</strong>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => fetchCopilotGuidance(inputs)}
                      disabled={isCopilotLoading}
                      className="px-3 py-1.5 text-xs font-mono-tabular rounded border border-[#00E5FF]/50 bg-[#0E1117] text-[#00E5FF] hover:bg-[#00E5FF]/15 transition-colors flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isCopilotLoading ? "animate-spin" : ""}`}
                      />
                      <span>{isCopilotLoading ? "Synthesizing..." : "Refresh Dispatch Brief"}</span>
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(copilotData?.bullets || []).map((bullet, idx) => {
                    const isCrit = bullet.severity === "critical";
                    const isWarn = bullet.severity === "warning";
                    const borderColor = isCrit
                      ? "border-[#FF1744]"
                      : isWarn
                      ? "border-[#FF9100]"
                      : "border-[#00E676]";
                    const titleColor = isCrit
                      ? "text-[#FF1744]"
                      : isWarn
                      ? "text-[#FF9100]"
                      : "text-[#00E676]";

                    return (
                      <div
                        key={idx}
                        className={`bg-[#0E1117] border border-[#262C3A] border-t-2 ${borderColor} rounded p-3.5 flex flex-col justify-between`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span
                              className={`text-xs font-mono-tabular font-bold uppercase tracking-wider ${titleColor}`}
                            >
                              0{idx + 1}. {bullet.category}
                            </span>
                            {isCrit ? (
                              <ShieldAlert className="w-4 h-4 text-[#FF1744] shrink-0" />
                            ) : isWarn ? (
                              <AlertTriangle className="w-4 h-4 text-[#FF9100] shrink-0" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-[#00E676] shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-[#E0E0E0] leading-relaxed">
                            {bullet.message}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {activeView === "github" && (
            <section className="bg-[#161A22] border border-[#262C3A] rounded-lg p-6 space-y-6">
              <div className="border-b border-[#262C3A] pb-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-display text-base font-bold text-[#00E5FF] uppercase tracking-wider">
                    راهنمای انتشار در GitHub Pages و استقرار اپلیکیشن
                  </h3>
                  <p className="text-xs text-[#8E96AA] mt-1">
                    چگونه اپلیکیشن React و نسخه پایتون Streamlit را در اینترنت به صورت عمومی نمایش دهید
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveView("scada")}
                  className="px-3 py-1.5 text-xs font-mono-tabular rounded border border-[#262C3A] bg-[#0E1117] text-[#00E5FF] hover:border-[#00E5FF]"
                >
                  بازگشت به مانیتورینگ زنده
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
                <div className="bg-[#0E1117] border border-[#262C3A] rounded p-5 space-y-3">
                  <div className="flex items-center gap-2 text-[#00E5FF] font-semibold text-base font-display">
                    <span>روش اول: استقرار وب اپلیکیشن React روی GitHub Pages</span>
                  </div>
                  <p className="text-xs text-[#8E96AA] leading-relaxed">
                    گیت‌هاب پیجز (GitHub Pages) برای میزبانی فایل‌های استاتیک HTML/CSS/JS است. چون رابط کاربری بنی‌تویین یک اپلیکیشن مدرن React + Vite + Tailwind است، می‌توانید نسخه کامپایل‌شده آن را به سادگی و رایگان روی GitHub Pages بالا بیاورید:
                  </p>

                  <ol className="list-decimal list-inside space-y-2 text-xs text-[#E0E0E0]">
                    <li>
                      یک مخزن (Repository) در گیت‌هاب بسازید (مثلاً <code className="bg-[#161A22] px-1.5 py-0.5 rounded text-[#00E5FF]">banitwin</code>).
                    </li>
                    <li>
                      در فایل <code className="bg-[#161A22] px-1.5 py-0.5 rounded text-[#00E5FF]">vite.config.ts</code> خط <code className="bg-[#161A22] px-1.5 py-0.5 rounded text-[#00E5FF]">base: '/banitwin/'</code> را اضافه کنید.
                    </li>
                    <li>
                      دستور <code className="bg-[#161A22] px-1.5 py-0.5 rounded text-[#00E676]">npm run build</code> را اجرا کنید تا پوشه <code className="bg-[#161A22] px-1.5 py-0.5 rounded text-[#00E5FF]">dist</code> ساخته شود.
                    </li>
                    <li>
                      با استفاده از پکیج <code className="bg-[#161A22] px-1.5 py-0.5 rounded text-[#FF9100]">gh-pages</code> یا از طریق یک GitHub Actions Workflow پوشه <code className="bg-[#161A22] px-1.5 py-0.5 rounded text-[#00E5FF]">dist</code> را در برنچ <code className="bg-[#161A22] px-1.5 py-0.5 rounded text-[#00E5FF]">gh-pages</code> منتشر کنید.
                    </li>
                  </ol>
                </div>

                <div className="bg-[#0E1117] border border-[#262C3A] rounded p-5 space-y-3">
                  <div className="flex items-center gap-2 text-[#FF9100] font-semibold text-base font-display">
                    <span>روش دوم: استقرار نسخه پایتون Streamlit</span>
                  </div>
                  <p className="text-xs text-[#8E96AA] leading-relaxed">
                    توجه داشته باشید که <strong>Streamlit یک سرور فعال پایتونی است</strong> و مستقیماً روی سرورهای فقط استاتیک مثل GitHub Pages اجرا نمی‌شود (مگر با فناوری Pyodide/Stlite)، اما ساده‌ترین و رایگان‌ترین راه اجرای آن چیست؟
                  </p>

                  <ol className="list-decimal list-inside space-y-2 text-xs text-[#E0E0E0]">
                    <li>
                      فایل <code className="bg-[#161A22] px-1.5 py-0.5 rounded text-[#00E5FF]">app.py</code> را از دکمه بالای صفحه دانلود کرده و در گیت‌هاب پوش کنید.
                    </li>
                    <li>
                      یک فایل <code className="bg-[#161A22] px-1.5 py-0.5 rounded text-[#00E5FF]">requirements.txt</code> کنار آن قرار دهید (شامل streamlit, plotly, pandas, numpy, google-generativeai).
                    </li>
                    <li>
                      به سایت <strong className="text-white">share.streamlit.io</strong> بروید و مخزن گیت‌هاب خود را وصل کنید؛ در کمتر از ۱ دقیقه لینک عمومی زنده دریافت خواهید کرد!
                    </li>
                  </ol>
                </div>
              </div>
            </section>
          )}

          {activeView === "physics" && (
            <section className="bg-[#161A22] border border-[#262C3A] rounded-lg p-6 space-y-6">
              <div className="border-b border-[#262C3A] pb-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-display text-base font-bold text-[#00E5FF] uppercase tracking-wider">
                    Cylindrical Transient & Steady-State Thermal Physics Engine
                  </h3>
                  <p className="text-xs text-[#8E96AA] mt-1">
                    Governing PDE & IEC 60287 Lumped-Parameter Formulation Verified at Node 407
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveView("scada")}
                  className="px-3 py-1.5 text-xs font-mono-tabular rounded border border-[#262C3A] bg-[#0E1117] text-[#00E5FF] hover:border-[#00E5FF]"
                >
                  Return to Live Charts
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono-tabular">
                <div className="bg-[#0E1117] border border-[#262C3A] rounded p-4 space-y-2">
                  <div className="text-xs text-[#8E96AA] uppercase">1. Joule Heating Power Loss</div>
                  <div className="text-sm font-bold text-[#00E5FF]">
                    q_loss = I² · R_ac
                  </div>
                  <div className="text-xs text-[#E0E0E0] pt-1">
                    = ({inputs.currentLoad} A)² × {CABLE_CONSTANTS.R_AC_BASE.toExponential(2)} Ω/m
                  </div>
                  <div className="text-lg font-bold text-[#FF9100]">
                    = {physics.qLoss.toFixed(2)} W/m
                  </div>
                </div>

                <div className="bg-[#0E1117] border border-[#262C3A] rounded p-4 space-y-2">
                  <div className="text-xs text-[#8E96AA] uppercase">
                    2. Kennelly Soil & Cable Resistance
                  </div>
                  <div className="text-sm font-bold text-[#00E5FF]">
                    R_th_total = R_cable + (ρ / 2π)·ln(2z / D_e)
                  </div>
                  <div className="text-xs text-[#E0E0E0] pt-1">
                    = {physics.rThCoreToSheath.toFixed(3)} + {physics.rThSoil.toFixed(3)} K·m/W
                  </div>
                  <div className="text-lg font-bold text-[#FF9100]">
                    = {physics.rThTotal.toFixed(3)} K·m/W
                  </div>
                </div>

                <div className="bg-[#0E1117] border border-[#262C3A] rounded p-4 space-y-2">
                  <div className="text-xs text-[#8E96AA] uppercase">
                    3. Hotspot & PINN Dynamic Rating
                  </div>
                  <div className="text-sm font-bold text-[#00E5FF]">
                    T_hotspot = T_amb + q_loss · R_th_total
                  </div>
                  <div className="text-xs text-[#E0E0E0] pt-1">
                    = {inputs.ambientTemp.toFixed(1)}°C + {(physics.qLoss * physics.rThTotal).toFixed(1)}°C
                  </div>
                  <div className="text-lg font-bold text-[#00E676]">
                    T_hot = {physics.hotspotTemp.toFixed(1)} °C · I_dyn = {physics.dynamicCapacity.toFixed(0)} A
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeView === "streamlit" && (
            <section className="bg-[#161A22] border border-[#262C3A] rounded-lg p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#262C3A] pb-3">
                <div className="flex items-center gap-2.5">
                  <Terminal className="w-5 h-5 text-[#00E5FF]" />
                  <div>
                    <h3 className="font-display text-sm font-bold uppercase tracking-wider text-white">
                      Single-File Production Streamlit Application (app.py)
                    </h3>
                    <p className="text-xs text-[#8E96AA]">
                      Complete runnable Python script with Streamlit, Plotly Contour/Scatter, NumPy, Pandas, and Gemini API
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyStreamlitCode}
                    className="px-3 py-1.5 text-xs font-mono-tabular rounded border border-[#00E5FF] bg-[#00E5FF]/10 text-[#00E5FF] hover:bg-[#00E5FF]/20 transition-colors flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedCode ? "Copied to Clipboard!" : "Copy app.py"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadStreamlitFile}
                    className="px-3 py-1.5 text-xs font-mono-tabular font-semibold rounded bg-[#00E5FF] text-[#0E1117] hover:bg-[#33ECFF] transition-colors flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download app.py</span>
                  </button>
                </div>
              </div>

              <pre className="bg-[#0E1117] border border-[#262C3A] rounded p-4 text-xs font-mono-tabular text-[#E0E0E0] overflow-x-auto max-h-[540px] leading-relaxed">
                <code>{STREAMLIT_APP_PY_CODE}</code>
              </pre>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
