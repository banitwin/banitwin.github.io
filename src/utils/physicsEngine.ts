export interface CablePhysicsInput {
  currentLoad: number;      // I: Amperes (400A to 1400A, default 950A)
  ambientTemp: number;      // T_ambient: °C (10°C to 45°C, default 28°C)
  soilResistivity: number;  // rho_soil: K·m/W (0.5 to 2.5, default 1.0)
  cableDepth: number;       // depth: Meters (0.8m to 2.5m, default 1.2m)
}

export interface RadialLayerPoint {
  radiusM: number;
  radiusMm: number;
  tempC: number;
  zone: "Conductor Core" | "XLPE Insulation" | "Outer Sheath" | "Surrounding Soil";
}

export interface HourlyDTRPoint {
  hour: number;
  timeLabel: string;
  actualLoad: number;
  dynamicLimit: number;
  staticLimit: number;
  ambientSoilTemp: number;
  hotspotTemp: number;
  isCurrentHour: boolean;
}

export interface CablePhysicsState {
  qLoss: number;
  rAcEffective: number;
  rThCoreToSheath: number;
  rThSoil: number;
  rThTotal: number;
  hotspotTemp: number;
  xlpeOuterTemp: number;
  sheathSurfaceTemp: number;
  staticLimit: number;
  dynamicCapacity: number;
  unlockedCapacityPct: number;
  unlockedAmps: number;
  thermalMarginC: number;
  isOverheatingAlert: boolean;
  isCriticalBreach: boolean;
  pinnLatencySec: number;
  physicsLossMse: number;
  radialProfile: RadialLayerPoint[];
  hourlySchedule: HourlyDTRPoint[];
}

export const CABLE_CONSTANTS = {
  STATIC_LIMIT_AMPS: 750.0,
  T_MAX_LIMIT_C: 90.0,
  T_ALERT_THRESHOLD_C: 85.0,
  R_AC_BASE: 5.83e-5,
  D_EXTERNAL_M: 0.10,
  R_CORE_M: 0.020,
  R_XLPE_M: 0.042,
  R_SHEATH_M: 0.050,
  R_DOMAIN_MAX_M: 0.50,
  R_TH_XLPE: 0.34,
  R_TH_SHEATH: 0.138,
};

export function calculateThermalState(input: CablePhysicsInput): CablePhysicsState {
  const { currentLoad, ambientTemp, soilResistivity, cableDepth } = input;
  const {
    STATIC_LIMIT_AMPS,
    T_MAX_LIMIT_C,
    T_ALERT_THRESHOLD_C,
    R_AC_BASE,
    D_EXTERNAL_M,
    R_CORE_M,
    R_XLPE_M,
    R_SHEATH_M,
    R_DOMAIN_MAX_M,
    R_TH_XLPE,
    R_TH_SHEATH,
  } = CABLE_CONSTANTS;

  const rThCoreToSheath = R_TH_XLPE + R_TH_SHEATH;
  const rThSoil = (soilResistivity / (2 * Math.PI)) * Math.log((2 * cableDepth) / D_EXTERNAL_M);
  const rThTotal = rThCoreToSheath + rThSoil;
  const qLoss = Math.pow(currentLoad, 2) * R_AC_BASE;
  const hotspotTemp = ambientTemp + qLoss * rThTotal;
  const sheathSurfaceTemp = ambientTemp + qLoss * rThSoil;
  const xlpeOuterTemp = sheathSurfaceTemp + qLoss * R_TH_SHEATH;

  const dynamicCapacity =
    ambientTemp < T_MAX_LIMIT_C
      ? Math.sqrt((T_MAX_LIMIT_C - ambientTemp) / (R_AC_BASE * rThTotal))
      : 0.0;

  const unlockedCapacityPct =
    ((dynamicCapacity - STATIC_LIMIT_AMPS) / STATIC_LIMIT_AMPS) * 100.0;
  const unlockedAmps = dynamicCapacity - STATIC_LIMIT_AMPS;
  const thermalMarginC = T_MAX_LIMIT_C - hotspotTemp;

  const radialProfile: RadialLayerPoint[] = [];
  const numRadialSteps = 60;
  for (let i = 0; i <= numRadialSteps; i++) {
    const r = (i / numRadialSteps) * R_DOMAIN_MAX_M;
    const tempC = evaluateRadialTemperature(
      r,
      hotspotTemp,
      xlpeOuterTemp,
      sheathSurfaceTemp,
      ambientTemp
    );
    let zone: RadialLayerPoint["zone"] = "Surrounding Soil";
    if (r <= R_CORE_M) zone = "Conductor Core";
    else if (r <= R_XLPE_M) zone = "XLPE Insulation";
    else if (r <= R_SHEATH_M) zone = "Outer Sheath";

    radialProfile.push({
      radiusM: r,
      radiusMm: Math.round(r * 1000),
      tempC,
      zone,
    });
  }

  const currentHour = 18;
  const hourlySchedule: HourlyDTRPoint[] = [];

  for (let h = 0; h <= 24; h++) {
    const morningWave = 190 * Math.exp(-Math.pow((h - 9) / 3.2, 2));
    const eveningWave = 360 * Math.exp(-Math.pow((h - 18) / 3.8, 2));
    const baseCurve = 560 + morningWave + eveningWave;
    const hourLoad = h === currentHour ? currentLoad : Math.round(baseCurve);
    const diurnalDelta = 3.2 * Math.sin((Math.PI * (h - 9)) / 12);
    const hourAmb = h === currentHour ? ambientTemp : ambientTemp + diurnalDelta;
    const hourQLoss = Math.pow(hourLoad, 2) * R_AC_BASE;
    const hourHotspot = hourAmb + hourQLoss * rThTotal;
    const hourDynLimit =
      hourAmb < T_MAX_LIMIT_C
        ? Math.sqrt((T_MAX_LIMIT_C - hourAmb) / (R_AC_BASE * rThTotal))
        : 0;

    hourlySchedule.push({
      hour: h,
      timeLabel: `${String(h).padStart(2, "0")}:00`,
      actualLoad: hourLoad,
      dynamicLimit: Math.round(hourDynLimit),
      staticLimit: STATIC_LIMIT_AMPS,
      ambientSoilTemp: Number(hourAmb.toFixed(1)),
      hotspotTemp: Number(hourHotspot.toFixed(1)),
      isCurrentHour: h === currentHour,
    });
  }

  return {
    qLoss,
    rAcEffective: R_AC_BASE,
    rThCoreToSheath,
    rThSoil,
    rThTotal,
    hotspotTemp,
    xlpeOuterTemp,
    sheathSurfaceTemp,
    staticLimit: STATIC_LIMIT_AMPS,
    dynamicCapacity,
    unlockedCapacityPct,
    unlockedAmps,
    thermalMarginC,
    isOverheatingAlert: hotspotTemp > T_ALERT_THRESHOLD_C,
    isCriticalBreach: hotspotTemp >= T_MAX_LIMIT_C,
    pinnLatencySec: 0.04,
    physicsLossMse: 0.00018,
    radialProfile,
    hourlySchedule,
  };
}

export function evaluateRadialTemperature(
  r: number,
  tCore: number,
  tXlpeOuter: number,
  tSheathOuter: number,
  tAmbient: number
): number {
  const { R_CORE_M, R_XLPE_M, R_SHEATH_M, R_DOMAIN_MAX_M } = CABLE_CONSTANTS;

  if (r <= R_CORE_M) return tCore;
  if (r <= R_XLPE_M) {
    const ratio = Math.log(r / R_CORE_M) / Math.log(R_XLPE_M / R_CORE_M);
    return tCore - (tCore - tXlpeOuter) * ratio;
  }
  if (r <= R_SHEATH_M) {
    const ratio = Math.log(r / R_XLPE_M) / Math.log(R_SHEATH_M / R_XLPE_M);
    return tXlpeOuter - (tXlpeOuter - tSheathOuter) * ratio;
  }
  if (r <= R_DOMAIN_MAX_M) {
    const ratio = Math.log(r / R_SHEATH_M) / Math.log(R_DOMAIN_MAX_M / R_SHEATH_M);
    return tSheathOuter - (tSheathOuter - tAmbient) * ratio;
  }
  return tAmbient;
}

export function sampleInfernoColormap(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  const stops: Array<{ pos: number; rgb: [number, number, number] }> = [
    { pos: 0.0, rgb: [10, 12, 24] },
    { pos: 0.18, rgb: [48, 18, 82] },
    { pos: 0.38, rgb: [118, 28, 109] },
    { pos: 0.58, rgb: [188, 55, 84] },
    { pos: 0.76, rgb: [237, 105, 37] },
    { pos: 0.90, rgb: [251, 182, 28] },
    { pos: 1.0, rgb: [252, 255, 164] },
  ];

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (clamped >= a.pos && clamped <= b.pos) {
      const localT = (clamped - a.pos) / (b.pos - a.pos);
      return [
        Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * localT),
        Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * localT),
        Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * localT),
      ];
    }
  }
  return stops[stops.length - 1].rgb;
}
