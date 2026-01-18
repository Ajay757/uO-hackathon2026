import { createContext, useContext, useMemo } from "react";
import flightsData from "../db/flights.json";
import { buildWaypointToAcidsMap } from "../utils/routeUtils";

const FlightsDataContext = createContext(null);

export function FlightsDataProvider({ children }) {
  const flights = flightsData;

  const waypointToAcids = useMemo(() => buildWaypointToAcidsMap(flights), [flights]);

  const value = useMemo(
    () => ({
      flights,
      waypointToAcids,
      numFlights: flights?.length ?? 0,
      numWaypoints: Object.keys(waypointToAcids || {}).length,
    }),
    [flights, waypointToAcids]
  );

  return (
    <FlightsDataContext.Provider value={value}>
      {children}
    </FlightsDataContext.Provider>
  );
}

export function useFlightsData() {
  const ctx = useContext(FlightsDataContext);
  if (!ctx) throw new Error("useFlightsData must be used within <FlightsDataProvider />");
  return ctx;
}

