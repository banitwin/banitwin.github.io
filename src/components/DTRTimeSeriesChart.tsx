import React, { useState } from "react";
import { CablePhysicsState } from "../utils/physicsEngine";

interface DTRTimeSeriesChartProps {
  physics: CablePhysicsState;
}

export const DTRTimeSeriesChart: React.FC<DTRTimeSeriesChartProps> = ({ physics }) => {
  const [hoveredHour, setHoveredHour] = useState<number | null>(18);
  const { hourlySchedule, staticLimit } = physics;

  const svgWidth = 640;
  const svgHeight = 320;
  const padLeft = 48;
  const padRight = 18;
  const padTop = 24;
  const padBottom = 34;

  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const minY = 200;
  const maxY = 1550;

  const xPos = (hour: number) => padLeft + (hour / 24) * plotW;
  const yPos = (amps: number) =>
    padTop + plotH - ((Math.max(minY, Math.min(maxY, amps)) - minY) / (maxY - minY)) * plotH;

  const loadPoints = hourlySchedule.map((pt) => `${xPos(pt.hour).toFixed(1)},${yPos(pt.actualLoad).toFixed(1)}`);
  const dynPoints = hourlySchedule.map((pt) => `${xPos(pt.hour).toFixed(1)},${yPos(pt.dynamicLimit).toFixed(1)}`);
  const staticY = yPos(staticLimit);

  const loadLinePath = `M ${loadPoints.join(" L ")}`;
  const dynLinePath = `M ${dynPoints.join(" L ")}`;

  const latentAreaPath = [
    `M ${xPos(0).toFixed(1)},${staticY.toFixed(1)}`,
    ...hourlySchedule.map((pt) => `L ${xPos(pt.hour).toFixed(1)},${yPos(pt.dynamicLimit).toFixed(1)}`),
    `L ${xPos(24).toFixed(1)},${staticY.toFixed(1)}`,
    "Z",
  ].join(" ");

  const activePoint =
    hourlySchedule.find((p) => p.hour === (hoveredHour ?? 18)) || hourlySchedule[18];

  const yTicks = [400, 600, 800, 1000, 1200, 1400];
  const xTicks = [0, 4, 8, 12, 16, 20, 24];

  return (
    <div className="bg-[#161A22] border border-[#262C3A] rounded-lg p-4 flex flex-col justify-between h-full">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#262C3A]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#FF9100]" />
            <h3 className="font-display text-sm font-semibold tracking-wide text-[#00E5FF] uppercase">
              24H Dynamic Thermal Rating vs Load Curve
            </h3>
          </div>
          <p className="text-xs text-[#8E96AA] mt-0.5">
            Real-Time PINN Ampacity Envelope vs IEC Static Rating (750A) & Feeder Load
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono-tabular">
          <span className="flex items-center gap-1.5 text-[#00E5FF]">
            <span className="w-3 h-0.5 bg-[#00E5FF] inline-block" />
            Actual Load
          </span>
          <span className="flex items-center gap-1.5 text-[#FF9100]">
            <span className="w-3 h-0.5 border-b-2 border-dashed border-[#FF9100] inline-block" />
            PINN Dynamic Limit
          </span>
          <span className="flex items-center gap-1.5 text-[#FF1744]">
            <span className="w-3 h-0.5 border-b-2 border-dotted border-[#FF1744] inline-block" />
            Static (750A)
          </span>
        </div>
      </div>

      <div className="my-3 bg-[#0E1117] border border-[#262C3A] rounded p-2 relative">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-[270px] overflow-visible select-none"
          onMouseLeave={() => setHoveredHour(18)}
        >
          <defs>
            <linearGradient id="latentBandGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00E676" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#00E676" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {yTicks.map((tick) => {
            const y = yPos(tick);
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={svgWidth - padRight}
                  y2={y}
                  stroke="#1F2633"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-[#8E96AA] text-[10px] font-mono-tabular"
                >
                  {tick}A
                </text>
              </g>
            );
          })}

          {xTicks.map((hr) => {
            const x = xPos(hr);
            return (
              <g key={hr}>
                <line
                  x1={x}
                  y1={padTop}
                  x2={x}
                  y2={svgHeight - padBottom}
                  stroke="#1F2633"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={svgHeight - 10}
                  textAnchor="middle"
                  className="fill-[#8E96AA] text-[10px] font-mono-tabular"
                >
                  {String(hr).padStart(2, "0")}:00
                </text>
              </g>
            );
          })}

          <path d={latentAreaPath} fill="url(#latentBandGrad)" />

          <line
            x1={padLeft}
            y1={staticY}
            x2={svgWidth - padRight}
            y2={staticY}
            stroke="#FF1744"
            strokeWidth="2"
            strokeDasharray="3 4"
          />

          <path
            d={dynLinePath}
            fill="none"
            stroke="#FF9100"
            strokeWidth="2.4"
            strokeDasharray="6 4"
          />

          <path d={loadLinePath} fill="none" stroke="#00E5FF" strokeWidth="2.6" />

          <line
            x1={xPos(18)}
            y1={padTop}
            x2={xPos(18)}
            y2={svgHeight - padBottom}
            stroke="#00E676"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <text
            x={xPos(18)}
            y={padTop - 7}
            textAnchor="middle"
            className="fill-[#00E676] text-[10px] font-mono-tabular font-bold"
          >
            LIVE T=18:00
          </text>

          {hourlySchedule.map((pt) => {
            const cx = xPos(pt.hour);
            const cyLoad = yPos(pt.actualLoad);
            const cyDyn = yPos(pt.dynamicLimit);
            const isSelected = activePoint.hour === pt.hour;

            return (
              <g key={pt.hour}>
                {isSelected && (
                  <line
                    x1={cx}
                    y1={padTop}
                    x2={cx}
                    y2={svgHeight - padBottom}
                    stroke="rgba(0, 229, 255, 0.35)"
                    strokeWidth="1"
                  />
                )}
                <circle
                  cx={cx}
                  cy={cyLoad}
                  r={pt.isCurrentHour ? 5 : isSelected ? 4.5 : 2.5}
                  fill={pt.isCurrentHour ? "#00E676" : "#00E5FF"}
                  stroke="#0E1117"
                  strokeWidth="1.5"
                />
                {isSelected && (
                  <circle
                    cx={cx}
                    cy={cyDyn}
                    r={4}
                    fill="#FF9100"
                    stroke="#0E1117"
                    strokeWidth="1.5"
                  />
                )}
                <rect
                  x={cx - plotW / 50}
                  y={padTop}
                  width={plotW / 25}
                  height={plotH}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredHour(pt.hour)}
                />
              </g>
            );
          })}
        </svg>

        <div className="mt-1 pt-2 border-t border-[#1F2633] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono-tabular">
          <div className="flex items-center gap-2">
            <span className="text-[#8E96AA]">INSPECTED WINDOW:</span>
            <span className="text-[#00E676] font-semibold">
              {activePoint.timeLabel} {activePoint.isCurrentHour ? "(LIVE SCADA)" : ""}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span>
              Load: <strong className="text-[#00E5FF]">{activePoint.actualLoad} A</strong>
            </span>
            <span>
              PINN Limit: <strong className="text-[#FF9100]">{activePoint.dynamicLimit} A</strong>
            </span>
            <span>
              Static: <strong className="text-[#FF1744]">{activePoint.staticLimit} A</strong>
            </span>
            <span>
              Hotspot: <strong className="text-[#E0E0E0]">{activePoint.hotspotTemp.toFixed(1)} °C</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="pt-2.5 border-t border-[#262C3A] flex flex-wrap items-center justify-between gap-2 text-xs text-[#8E96AA] font-mono-tabular">
        <div>
          Dielectric Ceiling: <span className="text-[#E0E0E0]">T_max = 90.0 °C (XLPE)</span>
        </div>
        <div>
          Headroom vs Dynamic Limit:{" "}
          <span
            className={
              physics.dynamicCapacity - activePoint.actualLoad >= 0
                ? "text-[#00E676] font-semibold"
                : "text-[#FF1744] font-semibold"
            }
          >
            {physics.dynamicCapacity - activePoint.actualLoad >= 0 ? "+" : ""}
            {Math.round(physics.dynamicCapacity - activePoint.actualLoad)} A
          </span>
        </div>
      </div>
    </div>
  );
};
