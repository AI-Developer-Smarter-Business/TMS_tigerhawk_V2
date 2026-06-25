"use client"

import { useState, useEffect, type ComponentType } from "react"
import dynamic from "next/dynamic"

type Coords = { lat: number; lng: number }

type RouteSegment = {
  coordinates: [number, number][]
  distanceMiles: number
}

type LoadSidebarMapProps = {
  pickupLocation: string | null
  deliveryLocation: string | null
  returnLocation?: string | null
  onDistanceCalculated?: (totalMiles: number) => void
  /** Live driver position (PP2 8.12) — updated via Realtime in parent */
  driverLocation?: {
    lat: number
    lng: number
    lastSeenLabel: string
  } | null
}

// In-memory geocode cache (persists across re-renders, clears on page reload)
const geocodeCache = new Map<string, Coords | null>()

/** Geocoding runs on the server (Nominatim + throttle + US bbox); routing stays on the client (OSRM). */
async function geocodeAddress(address: string): Promise<Coords | null> {
  const cacheKey = address.trim().toLowerCase()
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey) ?? null
  }

  try {
    const res = await fetch("/api/geocoding/forward", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ query: address.trim(), mode: "address_fallbacks" }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { found?: boolean; lat?: number; lng?: number }
    if (data.found && typeof data.lat === "number" && typeof data.lng === "number") {
      const coords: Coords = { lat: data.lat, lng: data.lng }
      geocodeCache.set(cacheKey, coords)
      return coords
    }
    geocodeCache.set(cacheKey, null)
  } catch {
    // Don't cache network errors so they can be retried
  }
  return null
}

// Fetch road route between two points using OSRM
async function fetchRoute(from: Coords, to: Coords): Promise<RouteSegment | null> {
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
    )
    const data = await res.json()
    if (data.code === "Ok" && data.routes?.length > 0) {
      const route = data.routes[0]
      return {
        coordinates: route.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]),
        distanceMiles: Math.round((route.distance / 1609.344) * 10) / 10,
      }
    }
  } catch {
    // silently fail — will fall back to straight line
  }
  return null
}

type MapPoint = { coords: Coords; label: string; color: string; meta?: string; size?: number }

type InnerMapProps = {
  points: MapPoint[]
  routeSegments: RouteSegment[]
  boundsPoints: MapPoint[]
}

// Inner map component — loaded without SSR
function InnerMap({ points, routeSegments, boundsPoints }: InnerMapProps) {
  const L = require("leaflet")
  const { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } = require("react-leaflet")
  const { useEffect: useEffectLocal } = require("react")

  // Inject Leaflet CSS
  if (typeof document !== "undefined" && !document.getElementById("leaflet-sidebar-css")) {
    const link = document.createElement("link")
    link.id = "leaflet-sidebar-css"
    link.rel = "stylesheet"
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    document.head.appendChild(link)
  }

  // Create colored marker icons
  const createIcon = (color: string, size = 12) => {
    const anchor = size / 2
    return L.divIcon({
      className: "custom-marker",
      html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
      iconSize: [size, size],
      iconAnchor: [anchor, anchor],
    })
  }

  // Collect coordinates for bounds (stops + route only — driver marker does not re-fit)
  const allCoords: [number, number][] = boundsPoints.map((p) => [p.coords.lat, p.coords.lng] as [number, number])
  for (const seg of routeSegments) {
    for (const coord of seg.coordinates) {
      allCoords.push(coord as [number, number])
    }
  }

  // Component that fits bounds after mount
  function FitBounds({ coords }: { coords: [number, number][] }) {
    const map = useMap()
    useEffectLocal(() => {
      if (coords.length === 0) return
      if (coords.length === 1) {
        map.setView(coords[0], 12)
      } else {
        const bounds = L.latLngBounds(coords)
        map.fitBounds(bounds, { padding: [20, 20], maxZoom: 13 })
      }
    }, [map, coords])
    return null
  }

  // Fallback straight line if no route segments
  const fallbackPositions = points.map((p) => [p.coords.lat, p.coords.lng])

  // Initial center (will be overridden by FitBounds)
  const initCenter: [number, number] = allCoords.length > 0 ? allCoords[0] : [39.8, -98.5]

  return (
    <MapContainer
      center={initCenter}
      zoom={5}
      scrollWheelZoom={false}
      dragging={false}
      zoomControl={false}
      attributionControl={false}
      style={{ width: "100%", height: "100%", borderRadius: "0.5rem" }}
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
      <FitBounds coords={allCoords} />

      {/* Road route lines */}
      {routeSegments.length > 0
        ? routeSegments.map((seg, i) => (
            <Polyline
              key={`route-${i}`}
              positions={seg.coordinates}
              pathOptions={{ color: "#E8700A", weight: 3, opacity: 0.8 }}
            />
          ))
        : fallbackPositions.length > 1 && (
            <Polyline
              positions={fallbackPositions}
              pathOptions={{ color: "#E8700A", weight: 2, opacity: 0.7, dashArray: "6 4" }}
            />
          )}

      {/* Markers */}
      {points.map((point, i) => (
        <Marker
          key={i}
          position={[point.coords.lat, point.coords.lng]}
          icon={createIcon(point.color, point.size ?? 12)}
        >
          <Tooltip direction="top" offset={[0, -8]} permanent={false}>
            <span style={{ fontSize: "11px", fontWeight: 600 }}>{point.label}</span>
            {point.meta ? (
              <>
                <br />
                <span style={{ fontSize: "10px", fontWeight: 400 }}>{point.meta}</span>
              </>
            ) : null}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  )
}

// Dynamic import to avoid SSR — explicit props so `boundsPoints` type-checks at call site
const DynamicMap = dynamic<InnerMapProps>(
  () => Promise.resolve(InnerMap as ComponentType<InnerMapProps>),
  { ssr: false },
)

export function LoadSidebarMap({
  pickupLocation,
  deliveryLocation,
  returnLocation,
  onDistanceCalculated,
  driverLocation,
}: LoadSidebarMapProps) {
  const [points, setPoints] = useState<MapPoint[]>([])
  const [routeSegments, setRouteSegments] = useState<RouteSegment[]>([])
  const [totalDistance, setTotalDistance] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Merge live driver marker after stop geocoding (no re-geocode on GPS tick)
  const mapPoints = driverLocation
    ? [
        ...points,
        {
          coords: { lat: driverLocation.lat, lng: driverLocation.lng },
          label: "Driver",
          color: "#3b82f6",
          meta: `Last seen: ${driverLocation.lastSeenLabel}`,
          size: 14,
        },
      ]
    : points

  const boundsPoints =
    points.length > 0
      ? points
      : driverLocation
        ? [
            {
              coords: { lat: driverLocation.lat, lng: driverLocation.lng },
              label: "Driver",
              color: "#3b82f6",
            },
          ]
        : []

  useEffect(() => {
    let cancelled = false

    async function geocodeAndRoute() {
      setIsLoading(true)
      const resolvedPoints: MapPoint[] = []

      // Geocode all locations
      if (pickupLocation) {
        const coords = await geocodeAddress(pickupLocation)
        if (coords && !cancelled) resolvedPoints.push({ coords, label: "Pickup", color: "#22c55e" })
      }
      if (deliveryLocation) {
        const coords = await geocodeAddress(deliveryLocation)
        if (coords && !cancelled) resolvedPoints.push({ coords, label: "Delivery", color: "#E8700A" })
      }
      if (returnLocation) {
        const coords = await geocodeAddress(returnLocation)
        if (coords && !cancelled) resolvedPoints.push({ coords, label: "Return", color: "#8b5cf6" })
      }

      if (cancelled) return

      // Fetch road routes between consecutive points
      const segments: RouteSegment[] = []
      let totalMiles = 0
      for (let i = 0; i < resolvedPoints.length - 1; i++) {
        const route = await fetchRoute(resolvedPoints[i].coords, resolvedPoints[i + 1].coords)
        if (route && !cancelled) {
          segments.push(route)
          totalMiles += route.distanceMiles
        }
      }

      if (!cancelled) {
        setPoints(resolvedPoints)
        setRouteSegments(segments)
        const rounded = Math.round(totalMiles * 10) / 10
        setTotalDistance(segments.length > 0 ? rounded : null)
        if (segments.length > 0 && onDistanceCalculated) {
          onDistanceCalculated(rounded)
        }
        setIsLoading(false)
      }
    }

    geocodeAndRoute()
    return () => { cancelled = true }
  }, [pickupLocation, deliveryLocation, returnLocation, onDistanceCalculated])

  if (isLoading) {
    return (
      <div className="h-[160px] bg-white/5 rounded-lg flex items-center justify-center">
        <span className="text-xs text-gray-500">Loading map...</span>
      </div>
    )
  }

  if (points.length === 0 && !driverLocation) {
    return (
      <div className="h-[160px] bg-white/5 rounded-lg flex items-center justify-center">
        <span className="text-xs text-gray-500">No locations to map</span>
      </div>
    )
  }

  return (
    <div className="h-[160px] rounded-lg overflow-hidden">
      <DynamicMap points={mapPoints} routeSegments={routeSegments} boundsPoints={boundsPoints} />
    </div>
  )
}
