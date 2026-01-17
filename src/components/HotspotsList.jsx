export default function HotspotsList({ hotspots }) {
    return (
      <div>
        <h2>Hotspots ({hotspots.length})</h2>
        <pre style={{ maxHeight: 250, overflow: "auto", background: "#111", color: "#ddd", padding: 12, borderRadius: 8 }}>
          {JSON.stringify(hotspots, null, 2)}
        </pre>
      </div>
    );
  }
  