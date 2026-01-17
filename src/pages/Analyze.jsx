import { useState } from "react";
import { analyzeFlights } from "../api/client.js";
import ConflictsTable from "../components/ConflictsTable";
import HotspotsList from "../components/HotSpotsList";
import MapView from "../components/MapView";

export default function Analyze() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRunAnalysis() {
    setLoading(true);
    setError("");

    // TEMP: mock flights until you connect real data/file upload
    const mockFlights = [
      {
        id: "F1",
        departure_time: "2026-01-17T12:00:00Z",
        speed_kts: 450,
        altitude_ft: 30000,
        waypoints: [
          { lat: 45.0, lon: -75.0 },
          { lat: 46.0, lon: -74.0 },
        ],
      },
      {
        id: "F2",
        departure_time: "2026-01-17T12:00:00Z",
        speed_kts: 455,
        altitude_ft: 30000,
        waypoints: [
          { lat: 45.02, lon: -75.02 },
          { lat: 46.02, lon: -74.02 },
        ],
      },
    ];

    try {
      const r = await analyzeFlights(mockFlights);
      setResults(r);
    } catch (e) {
      setError("Failed to call /analyze. Is the backend running on :8000?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ padding: "10px", backgroundColor: "blue", color: "white", fontWeight: "bold", fontSize: "20px" }}>
        DEBUG: Analyze.jsx is rendering
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button onClick={handleRunAnalysis} disabled={loading}>
          {loading ? "Running..." : "Run Analysis"}
        </button>
        {error && <span style={{ color: "crimson" }}>{error}</span>}
      </div>

      {!results ? (
        <div style={{ opacity: 0.75 }}>
          Click <b>Run Analysis</b> to generate conflicts/hotspots from mock flights.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ display: "grid", gap: 16 }}>
            <ConflictsTable conflicts={results.conflicts || []} />
            <HotspotsList hotspots={results.hotspots || []} />
          </div>
          <MapView conflicts={results.conflicts || []} hotspots={results.hotspots || []} />
        </div>
      )}
    </div>
  );
}
