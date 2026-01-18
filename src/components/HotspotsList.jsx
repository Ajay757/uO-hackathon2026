import "./HotSpotsList.css";

export default function HotspotsList({ hotspots, threshold, avg }) {
  if (!hotspots || hotspots.length === 0) {
    return (
      <div className="hotspots-list-container">
        <h2>Hotspots (0)</h2>
        <p className="empty-message">No hotspots detected</p>
      </div>
    );
  }

  // Hotspots are already sorted by airplane count descending
  const sortedHotspots = [...hotspots].sort((a, b) => (b.airplanes || 0) - (a.airplanes || 0));

  return (
    <div className="hotspots-list-container">
      <h2>Hotspots ({hotspots.length})</h2>
      {threshold != null && avg != null && (
        <p className="hotspot-threshold">
          Hotspot threshold: {threshold} flights (avg {avg.toFixed(2)})
        </p>
      )}
      <div className="table-wrapper">
        <table className="hotspots-table">
          <thead>
            <tr>
              <th>Hotspot ID</th>
              <th className="numeric">Latitude</th>
              <th className="numeric">Longitude</th>
              <th className="numeric">Number of airplanes</th>
            </tr>
          </thead>
          <tbody>
            {sortedHotspots.map((hotspot) => {
              // Handle both old format (with count) and new format (with airplanes)
              const airplaneCount = hotspot.airplanes ?? hotspot.count ?? 0;
              const hotspotId = hotspot.hotspotId ?? hotspot.id ?? null;
              
              // Only render if we have valid coordinates
              if (hotspot.lat == null || hotspot.lon == null) return null;
              
              return (
                <tr key={`hotspot-${hotspotId || hotspot.waypoint || hotspot.lat}-${hotspot.lon}`}>
                  <td>{hotspotId != null ? hotspotId : "N/A"}</td>
                  <td className="numeric">{hotspot.lat.toFixed(4)}</td>
                  <td className="numeric">{hotspot.lon.toFixed(4)}</td>
                  <td className="numeric">{airplaneCount.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
  