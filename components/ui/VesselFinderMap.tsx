// components/ui/VesselFinderMap.tsx
"use client"

/**
 * Embeds MarineTraffic's free AIS map for Port Houston area,
 * centered between Barbours Cut and Bayport terminals.
 */
export function VesselFinderMap() {
  // MarineTraffic iframe embed:
  // centery/centerx = Port Houston coordinates
  // zoom=11 for port area
  // maptype=0 (normal map)
  // shownames=true to display vessel names
  // showmenu=false for clean embed
  const src =
    "https://www.marinetraffic.com/en/ais/embed" +
    "/zoom:11" +
    "/centery:29.645" +
    "/centerx:-95.00" +
    "/maptype:4" +
    "/shownames:true" +
    "/mmsi:0/shipid:0" +
    "/fleet:/fleet_id:" +
    "/vtypes:" +
    "/showmenu:false" +
    "/remember:false"

  return (
    <div className="bg-[#111827] rounded-xl border border-white/5 p-5 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Live Vessel Map</h3>
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">Filter to Cargo Vessels</span>
      </div>
      <div className="rounded-lg overflow-hidden flex-1" style={{ minHeight: "280px" }}>
        <iframe
          src={src}
          width="100%"
          height="100%"
          style={{ border: "none", minHeight: "280px" }}
          allowFullScreen
          loading="lazy"
          title="Port Houston Live Vessel Map"
        />
      </div>
    </div>
  )
}
