import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildWaypointToAcidsMap } from "../src/utils/routeUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try db/flights.json at project root first, fallback to src/db/flights.json
const rootDbPath = path.resolve(__dirname, "../db/flights.json");
const srcDbPath = path.resolve(__dirname, "../src/db/flights.json");
const flightsPath = fs.existsSync(rootDbPath) ? rootDbPath : srcDbPath;

// Output to db/waypointToAcids.json at project root
const outDir = path.resolve(__dirname, "../db");
const outPath = path.resolve(outDir, "waypointToAcids.json");

// Create db directory if it doesn't exist
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

if (!fs.existsSync(flightsPath)) {
  console.error("[exportWaypointToAcids] Missing file:", flightsPath);
  process.exit(1);
}

const flights = JSON.parse(fs.readFileSync(flightsPath, "utf8"));
const waypointToAcids = buildWaypointToAcidsMap(flights);

fs.writeFileSync(outPath, JSON.stringify(waypointToAcids, null, 2), "utf8");

const entries = Object.entries(waypointToAcids);
console.log("[exportWaypointToAcids] Flights loaded:", flights.length);
console.log("[exportWaypointToAcids] Unique waypoints:", entries.length);
console.log("[exportWaypointToAcids] Wrote:", outPath);

const top10 = entries
  .map(([wp, acids]) => ({ waypoint: wp, flights: acids.length }))
  .sort((a, b) => b.flights - a.flights)
  .slice(0, 10);

console.log("[exportWaypointToAcids] Top 10 busiest waypoints:");
top10.forEach((x, i) => {
  console.log(`  ${i + 1}) ${x.waypoint} -> ${x.flights} flights`);
});

