import React, { useEffect, useRef, useState } from "react";
import {
  CABLE_CONSTANTS,
  CablePhysicsState,
  evaluateRadialTemperature,
  sampleInfernoColormap,
} from "../utils/physicsEngine";

interface CableThermalHeatmapProps {
  physics: CablePhysicsState;
  ambientTemp: number;
  cableDepth: number;
}

interface ProbeState {
  xMeters: number;
  yMeters: number;
  rMeters: number;
  tempC: number;
  zoneName: string;
}

export const CableThermalHeatmap: React.FC<CableThermalHeatmapProps> = ({
  physics,
  ambientTemp,
  cableDepth,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [probe, setProbe] = useState<ProbeState | null>(null);
  const [showIsotherms, setShowIsotherms] = useState(true);
  const [showLayerBoundaries, setShowLayerBoundaries] = useState(true);

  const { hotspotTemp, xlpeOuterTemp, sheathSurfaceTemp } = physics;
  const { R_CORE_M, R_XLPE_M, R_SHEATH_M, R_DOMAIN_MAX_M } = CABLE_CONSTANTS;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    const minTemp = Math.min(ambientTemp, 15);
    const maxTemp = Math.max(hotspotTemp, 92);
    const tempSpan = Math.max(1, maxTemp - minTemp);

    for (let py = 0; py < height; py++) {
      const yM = ((height / 2 - py) / (height / 2)) * R_DOMAIN_MAX_M;
      for (let px = 0; px < width; px++) {
        const xM = ((px - width / 2) / (width / 2)) * R_DOMAIN_MAX_M;
        const rM = Math.sqrt(xM * xM + yM * yM);

        const temp = evaluateRadialTemperature(
          rM,
          hotspotTemp,
          xlpeOuterTemp,
          sheathSurfaceTemp,
          ambientTemp
        );

        const norm = (temp - minTemp) / tempSpan;
        let [r, g, b] = sampleInfernoColormap(norm);

        if (showIsotherms) {
          const contourStep = 4.0;
          const distToIso = Math.abs(temp - Math.round(temp / contourStep) * contourStep);
          if (distToIso < 0.16 && rM < R_DOMAIN_MAX_M * 0.94) {
            r = Math.min(255, r + 28);
            g = Math.min(255, g + 28);
            b = Math.min(255, b + 28);
          }
        }

        const idx = (py * width + px) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    const cx = width / 2;
    const cy = height / 2;
    const scale = (width / 2) / R_DOMAIN_MAX_M;

    ctx.save();
    ctx.strokeStyle = "rgba(224, 224, 224, 0.12)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(width, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, height);
    ctx.stroke();
    ctx.restore();

    if (showLayerBoundaries) {
      const rings = [
        { radiusM: R_CORE_M, color: "#FFFFFF", dash: [] },
        { radiusM: R_XLPE_M, color: "#FF9100", dash: [3, 3] },
        { radiusM: R_SHEATH_M, color: "#00E5FF", dash: [6, 4] },
        { radiusM: 0.25, color: "rgba(0, 229, 255, 0.28)", dash: [2, 6] },
      ];

      rings.forEach((ring) => {
        const rPx = ring.radiusM * scale;
        ctx.save();
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = ring.radiusM === R_SHEATH_M ? 1.8 : 1.2;
        ctx.setLineDash(ring.dash);
        ctx.beginPath();
        ctx.arc(cx, cy, rPx, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });
    }
  }, [
    hotspotTemp,
    xlpeOuterTemp,
    sheathSurfaceTemp,
    ambientTemp,
    showIsotherms,
    showLayerBoundaries,
    R_CORE_M,
    R_XLPE_M,
    R_SHEATH_M,
    R_DOMAIN_MAX_M,
  ]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const xMeters = ((px - rect.width / 2) / (rect.width / 2)) * R_DOMAIN_MAX_M;
    const yMeters = ((rect.height / 2 - py) / (rect.height / 2)) * R_DOMAIN_MAX_M;
    const rMeters = Math.sqrt(xMeters * xMeters + yMeters * yMeters);

    const tempC = evaluateRadialTemperature(
      rMeters,
      hotspotTemp,
      xlpeOuterTemp,
      sheathSurfaceTemp,
      ambientTemp
    );

    let zoneName = "Surrounding Soil Medium";
    if (rMeters <= R_CORE_M) zoneName = "Conductor Core (Cu)";
    else if (rMeters <= R_XLPE_M) zoneName = "XLPE Dielectric Insulation";
    else if (rMeters <= R_SHEATH_M) zoneName = "Polymeric Outer Sheath";

    setProbe({
      xMeters,
      yMeters,
      rMeters,
      tempC,
      zoneName,
    });
  };

  const minScaleTemp = Math.min(ambientTemp, 15);
  const maxScaleTemp = Math.max(hotspotTemp, 92);

  return (
    <div className="bg-[#161A22] border border-[#262C3A] rounded-lg p-4 flex flex-col justify-between h-full">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#262C3A]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00E5FF]" />
            <h3 className="font-display text-sm font-semibold tracking-wide text-[#00E5FF] uppercase">
              2D Cable Thermal Heatmap (Cross-Section)
            </h3>
          </div>
          <p className="text-xs text-[#8E96AA] mt-0.5">
            Fourier Radial Conduction · Core → XLPE → Outer Sheath → Soil (Depth {cableDepth.toFixed(1)}m)
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowIsotherms((prev) => !prev)}
            className={`px-2.5 py-1 text-[11px] font-mono-tabular rounded border transition-colors whitespace-nowrap ${
              showIsotherms
                ? "bg-[#00E5FF]/15 border-[#00E5FF] text-[#00E5FF]"
                : "bg-[#0E1117] border-[#262C3A] text-[#8E96AA] hover:text-white"
            }`}
          >
            Isotherms
          </button>
          <button
            type="button"
            onClick={() => setShowLayerBoundaries((prev) => !prev)}
            className={`px-2.5 py-1 text-[11px] font-mono-tabular rounded border transition-colors whitespace-nowrap ${
              showLayerBoundaries
                ? "bg-[#00E5FF]/15 border-[#00E5FF] text-[#00E5FF]"
                : "bg-[#0E1117] border-[#262C3A] text-[#8E96AA] hover:text-white"
            }`}
          >
            Geometry Rings
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 my-3 items-center">
        <div className="relative flex items-center justify-center bg-[#0E1117] border border-[#262C3A] rounded p-2 overflow-hidden">
          <canvas
            ref={canvasRef}
            width={340}
            height={340}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setProbe(null)}
            className="w-full max-w-[330px] aspect-square cursor-crosshair rounded"
          />

          <div className="pointer-events-none absolute bottom-2 left-3 text-[10px] font-mono-tabular text-[#8E96AA]">
            X: [-0.50m, +0.50m]
          </div>
          <div className="pointer-events-none absolute top-2 left-3 text-[10px] font-mono-tabular text-[#8E96AA]">
            Y: [-0.50m, +0.50m]
          </div>

          {probe && (
            <div className="pointer-events-none absolute top-2 right-2 bg-[#0E1117]/95 border border-[#00E5FF]/60 rounded px-2.5 py-1.5 text-[11px] font-mono-tabular shadow-lg">
              <div className="text-[#00E5FF] font-semibold">{probe.zoneName}</div>
              <div className="text-[#E0E0E0] flex items-center justify-between gap-3 mt-0.5">
                <span>r = {(probe.rMeters * 1000).toFixed(0)} mm</span>
                <span className="font-bold text-[#FF9100]">{probe.tempC.toFixed(1)} °C</span>
              </div>
              <div className="text-[#8E96AA] text-[10px]">
                ({probe.xMeters.toFixed(2)}m, {probe.yMeters.toFixed(2)}m)
              </div>
            </div>
          )}
        </div>

        <div className="flex md:flex-col justify-between gap-3 bg-[#0E1117] border border-[#262C3A] rounded p-3 h-full min-w-[155px]">
          <div className="flex items-center gap-2.5 flex-1">
            <div
              className="w-3.5 h-44 md:h-48 rounded-sm border border-[#262C3A] shrink-0"
              style={{
                background:
                  "linear-gradient(to top, rgb(10,12,24) 0%, rgb(48,18,82) 18%, rgb(118,28,109) 38%, rgb(188,55,84) 58%, rgb(237,105,37) 76%, rgb(251,182,28) 90%, rgb(252,255,164) 100%)",
              }}
            />
            <div className="flex flex-col justify-between h-44 md:h-48 text-[11px] font-mono-tabular text-[#E0E0E0]">
              <span>{maxScaleTemp.toFixed(0)} °C</span>
              <span className="text-[#FF9100]">
                {((maxScaleTemp + minScaleTemp) * 0.65).toFixed(0)} °C
              </span>
              <span className="text-[#8E96AA]">
                {((maxScaleTemp + minScaleTemp) * 0.5).toFixed(0)} °C
              </span>
              <span className="text-[#8E96AA]">{minScaleTemp.toFixed(0)} °C</span>
            </div>
          </div>

          <div className="border-t border-[#262C3A] pt-2.5 space-y-1.5 text-[11px] font-mono-tabular">
            <div className="text-[10px] uppercase tracking-wider text-[#8E96AA]">
              Radial Nodes
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#E0E0E0]">Core (0–20mm)</span>
              <span className="text-[#FF9100] font-semibold">{hotspotTemp.toFixed(1)}°C</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#E0E0E0]">XLPE (20–42mm)</span>
              <span className="text-[#00E5FF]">{xlpeOuterTemp.toFixed(1)}°C</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#E0E0E0]">Sheath (50mm)</span>
              <span className="text-[#00E676]">{sheathSurfaceTemp.toFixed(1)}°C</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#8E96AA]">Far Soil (500mm)</span>
              <span className="text-[#8E96AA]">{ambientTemp.toFixed(1)}°C</span>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-2.5 border-t border-[#262C3A] flex flex-wrap items-center justify-between gap-2 text-xs text-[#8E96AA] font-mono-tabular">
        <div>
          Fourier Gradient: <span className="text-[#E0E0E0]">T(r) = T_amb + q_loss · R_th(r)</span>
        </div>
        <div>
          Joule Flux: <span className="text-[#00E5FF]">{physics.qLoss.toFixed(1)} W/m</span> ·{" "}
          R_th: <span className="text-[#FF9100]">{physics.rThTotal.toFixed(3)} K·m/W</span>
        </div>
      </div>
    </div>
  );
};
