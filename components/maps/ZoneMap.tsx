"use client"

import { useMemo, useEffect, useRef } from "react"
import dynamic from "next/dynamic"

// ─── Types ──────────────────────────────────────────────────
type Zone = {
  id: string
  zone_number: number
  name: string
  min_miles: number | null
  max_miles: number | null
  reference_city: string | null
}

interface ZoneMapProps {
  latitude: number
  longitude: number
  originName: string
  zones: Zone[]
}

// Miles to meters conversion (1 mile = 1609.34 meters)
const MILES_TO_METERS = 1609.34

// Zone ring colors — warm orange → purple gradient
const ZONE_COLORS = [
  { fill: "#E8700A", stroke: "#E8700A" },  // Zone 0 — bright orange
  { fill: "#E45F1A", stroke: "#E45F1A" },  // Zone 1 — deep orange
  { fill: "#D94E2A", stroke: "#D94E2A" },  // Zone 2 — red-orange
  { fill: "#C93D3A", stroke: "#C93D3A" },  // Zone 3 — warm red
  { fill: "#B4305A", stroke: "#B4305A" },  // Zone 4 — rose
  { fill: "#9B2878", stroke: "#9B2878" },  // Zone 5 — magenta
  { fill: "#832094", stroke: "#832094" },  // Zone 6 — purple
  { fill: "#6B1AAE", stroke: "#6B1AAE" },  // Zone 7 — deep purple
  { fill: "#5515C4", stroke: "#5515C4" },  // Zone 8 — violet
  { fill: "#4B0FA0", stroke: "#4B0FA0" },  // Zone 9 — dark purple (OTR)
]

// ─── Inner Map Component (loaded dynamically, no SSR) ────────
function ZoneMapInner({ latitude, longitude, originName, zones }: ZoneMapProps) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const L = require("leaflet")
  const { MapContainer, TileLayer, Circle, Marker, Tooltip } = require("react-leaflet")

  // Inject Leaflet CSS if not already present
  if (typeof document !== "undefined" && !document.getElementById("leaflet-css")) {
    const link = document.createElement("link")
    link.id = "leaflet-css"
    link.rel = "stylesheet"
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    link.crossOrigin = ""
    document.head.appendChild(link)
  }

  const center: [number, number] = [latitude, longitude]

  // Sort zones by max_miles descending so larger rings render first (behind smaller ones)
  const sortedZones = useMemo(() => {
    return [...zones]
      .filter((z) => z.max_miles || z.min_miles)
      .sort((a, b) => (b.max_miles || 999) - (a.max_miles || 999))
  }, [zones])

  // Calculate zoom level based on the largest zone
  const zoom = useMemo(() => {
    const maxMiles = Math.max(...zones.map((z) => z.max_miles || 100))
    if (maxMiles > 80) return 8
    if (maxMiles > 60) return 8.5
    if (maxMiles > 40) return 9
    return 9.5
  }, [zones])

  // Custom marker icon
  const markerIcon = L.divIcon({
    className: "custom-origin-marker",
    html: `<div style="
      width: 16px; height: 16px;
      background: #E8700A;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })

  return (
    <div className="relative rounded-lg overflow-hidden border border-white/10 h-full" style={{ minHeight: "300px" }}>
      <MapContainer
        center={center}
        zoom={zoom}
        className="z-0"
        style={{ height: "100%", width: "100%", background: "#0B1120" }}
        scrollWheelZoom={true}
        zoomControl={false}
        attributionControl={false}
        key={`${latitude}-${longitude}`}
        whenReady={(map: { target: { invalidateSize: () => void } }) => {
          // Fix partial tile rendering by invalidating size once the container is ready
          setTimeout(() => map.target.invalidateSize(), 200)
        }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a>'
        />

        {/* Concentric zone rings — largest first (renders behind) */}
        {sortedZones.map((zone) => {
          const colorIdx = zone.zone_number % ZONE_COLORS.length
          const color = ZONE_COLORS[colorIdx]
          const radiusMiles = zone.max_miles || (zone.min_miles ? zone.min_miles + 20 : 15)
          const radiusMeters = radiusMiles * MILES_TO_METERS

          return (
            <Circle
              key={zone.id}
              center={center}
              radius={radiusMeters}
              pathOptions={{
                color: color.stroke,
                fillColor: color.fill,
                fillOpacity: 0.06,
                weight: 1.5,
                dashArray: zone.zone_number === 9 ? "8 4" : undefined,
                opacity: 0.6,
              }}
            >
              {/* No tooltips on zone rings — legend + origin marker are sufficient */}
            </Circle>
          )
        })}

        {/* Origin marker */}
        <Marker position={center} icon={markerIcon}>
          <Tooltip permanent direction="top" className="origin-tooltip">
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#E8700A", background: "rgba(17,24,39,0.95)", padding: "3px 8px", borderRadius: "4px", border: "1px solid #E8700A40" }}>
              {originName}
            </span>
          </Tooltip>
        </Marker>
      </MapContainer>

      {/* Zone Legend */}
      <div className="absolute bottom-3 left-3 bg-[#111827]/90 backdrop-blur-sm rounded-lg border border-white/10 px-3 py-2 z-[1000]">
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          {zones
            .filter((z) => z.max_miles || z.min_miles)
            .sort((a, b) => a.zone_number - b.zone_number)
            .map((zone) => {
              const colorIdx = zone.zone_number % ZONE_COLORS.length
              return (
                <div key={zone.id} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: ZONE_COLORS[colorIdx].fill }}
                  />
                  <span className="text-[10px] text-gray-400 whitespace-nowrap">
                    {zone.name}
                  </span>
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}

// ─── Dynamic import wrapper (no SSR for Leaflet) ─────────────
const DynamicZoneMap = dynamic(
  () => Promise.resolve(ZoneMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="h-full min-h-[300px] rounded-lg border border-white/10 bg-[#0B1120] flex items-center justify-center">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-[#E8700A] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-gray-500">Loading map...</p>
        </div>
      </div>
    ),
  }
)

// ─── Export wrapper ──────────────────────────────────────────
export default function ZoneMap(props: ZoneMapProps) {
  if (!props.latitude || !props.longitude) {
    return (
      <div className="h-full min-h-[300px] rounded-lg border border-white/10 bg-[#0B1120] flex items-center justify-center">
        <p className="text-xs text-gray-500">No coordinates set for this origin</p>
      </div>
    )
  }

  return <DynamicZoneMap {...props} />
}
