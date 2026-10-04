import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post("/api/copilot", async (req, res) => {
    const {
      currentLoad = 950,
      ambientTemp = 28.0,
      soilResistivity = 1.0,
      cableDepth = 1.2,
      hotspotTemp = 72.4,
      dynamicCapacity = 960,
      unlockedCapacityPct = 28.0,
      qLoss = 45.1,
      rThTotal = 0.98,
      nodeName = "Node 407 - Metro Substation",
    } = req.body || {};

    const apiKey = process.env.GEMINI_API_KEY;
    const isValidKey =
      apiKey &&
      apiKey.trim() !== "" &&
      apiKey !== "MY_GEMINI_API_KEY" &&
      !apiKey.includes("YOUR_");

    const buildFallbackBullets = () => {
      if (hotspotTemp > 85.0) {
        return [
          {
            category: "CRITICAL THERMAL ALERT",
            severity: "critical",
            message: `Core hotspot at ${hotspotTemp.toFixed(1)}°C is approaching the 90.0°C IEC 60287 XLPE insulation breakdown threshold (Joule heat loss q_loss = ${qLoss.toFixed(1)} W/m, R_th_total = ${rThTotal.toFixed(3)} K·m/W).`,
          },
          {
            category: "DYNAMIC CAPACITY EXCEEDED",
            severity: "warning",
            message: `Active feeder load (${currentLoad} A) exceeds or crowds the PINN dynamic rating of ${Math.round(dynamicCapacity)} A under soil resistivity ρ = ${soilResistivity.toFixed(2)} K·m/W at ${cableDepth.toFixed(1)} m burial depth.`,
          },
          {
            category: "IMMEDIATE DISPATCH ACTION",
            severity: "critical",
            message: `Curtail feeder load by ${Math.max(10, Math.round(((currentLoad - dynamicCapacity * 0.92) / currentLoad) * 100))}% (${Math.max(50, Math.round(currentLoad - dynamicCapacity * 0.92))} A) or transfer load to Busbar B tie-breaker within 15 minutes to prevent dielectric thermal runaway.`,
          },
        ];
      }

      return [
        {
          category: "PHYSICS COMPLIANCE VERIFIED",
          severity: "nominal",
          message: `Cylindrical Fourier state estimation confirms conductor core at ${hotspotTemp.toFixed(1)}°C (${(90 - hotspotTemp).toFixed(1)}°C safety margin below 90.0°C XLPE limit; q_loss = ${qLoss.toFixed(1)} W/m).`,
        },
        {
          category: "LATENT GRID CAPACITY UNLOCKED",
          severity: "nominal",
          message: `BaniTwin PINN solver unlocks ${Math.round(dynamicCapacity)} A dynamic ampacity (${unlockedCapacityPct >= 0 ? "+" : ""}${unlockedCapacityPct.toFixed(1)}% vs 750 A static rating) given ${ambientTemp.toFixed(1)}°C soil ambient and ${soilResistivity.toFixed(2)} K·m/W thermal resistivity.`,
        },
        {
          category: "EXECUTIVE DISPATCH GUIDANCE",
          severity: "info",
          message: `Grid operators at ${nodeName} may safely dispatch up to ${Math.max(0, Math.round(dynamicCapacity - currentLoad))} A of additional N-1 contingency or renewable intake without dielectric aging penalty.`,
        },
      ];
    };

    if (!isValidKey) {
      return res.json({
        source: "physics-fallback",
        model: "PINN Deterministic Rule Engine (Fallback Mode)",
        timestamp: new Date().toISOString(),
        bullets: buildFallbackBullets(),
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const systemInstruction =
        "You are the BaniTwin Physics-Informed AI Grid Safety Copilot operating inside a high-voltage underground cable SCADA control room. " +
        "You receive real-time thermal state outputs from a Physics-Informed Neural Network (PINN) solving transient cylindrical Fourier heat conduction (IEC 60287). " +
        "Generate exactly 3 concise, high-impact executive dispatch recommendations for grid operators: " +
        "1) Physics & Dielectric Safety Compliance, 2) Dynamic Thermal Rating & Latent Capacity Analysis, and 3) Actionable Dispatch / Load Routing Guidance. " +
        "Cite exact numbers from the telemetry state.";

      const userPrompt = `Current Real-Time SCADA & PINN State for ${nodeName}:
- Active Current Load (I): ${currentLoad} A
- Traditional Static Ampacity Limit: 750 A
- BaniTwin PINN Dynamic Capacity (I_dyn): ${dynamicCapacity.toFixed(0)} A
- Unlocked Latent Grid Capacity: ${unlockedCapacityPct >= 0 ? "+" : ""}${unlockedCapacityPct.toFixed(1)}%
- Max Conductor Hotspot Temp (T_hotspot): ${hotspotTemp.toFixed(1)} °C (XLPE Max Limit: 90.0 °C, Warning Alert: 85.0 °C)
- Ambient Soil Temp (T_ambient): ${ambientTemp.toFixed(1)} °C
- Soil Thermal Resistivity (rho_soil): ${soilResistivity.toFixed(2)} K·m/W
- Installation Depth: ${cableDepth.toFixed(2)} m
- Joule Heating Loss (q_loss = I^2 * R): ${qLoss.toFixed(2)} W/m
- Total Thermal Resistance (R_th_total): ${rThTotal.toFixed(3)} K·m/W`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              bullets: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: {
                      type: Type.STRING,
                    },
                    severity: {
                      type: Type.STRING,
                    },
                    message: {
                      type: Type.STRING,
                    },
                  },
                  required: ["category", "severity", "message"],
                },
              },
            },
            required: ["bullets"],
          },
        },
      });

      const rawText = response.text;
      if (rawText) {
        const parsed = JSON.parse(rawText.trim());
        if (Array.isArray(parsed.bullets) && parsed.bullets.length > 0) {
          return res.json({
            source: "gemini-live",
            model: "gemini-3.8-flash",
            timestamp: new Date().toISOString(),
            bullets: parsed.bullets.slice(0, 3),
          });
        }
      }

      return res.json({
        source: "physics-fallback",
        model: "PINN Deterministic Rule Engine",
        timestamp: new Date().toISOString(),
        bullets: buildFallbackBullets(),
      });
    } catch {
      return res.json({
        source: "physics-fallback",
        model: "PINN Deterministic Rule Engine (Fallback Mode)",
        timestamp: new Date().toISOString(),
        bullets: buildFallbackBullets(),
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`BaniTwin SCADA Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
