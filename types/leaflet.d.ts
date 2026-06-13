// Minimal type declarations for leaflet/react-leaflet
// (since @types/leaflet may not be available)
declare module "leaflet" {
  export interface LatLngExpression extends Array<number> {}
  export function icon(options: Record<string, unknown>): unknown
}

declare module "react-leaflet" {
  import { ComponentType, ReactNode } from "react"

  interface MapContainerProps {
    center: [number, number]
    zoom: number
    className?: string
    style?: React.CSSProperties
    scrollWheelZoom?: boolean
    dragging?: boolean
    zoomControl?: boolean
    attributionControl?: boolean
    children?: ReactNode
    key?: string | number
  }

  interface TileLayerProps {
    attribution?: string
    url: string
  }

  interface CircleProps {
    center: [number, number]
    radius: number
    pathOptions?: {
      color?: string
      fillColor?: string
      fillOpacity?: number
      weight?: number
      dashArray?: string
      opacity?: number
    }
    children?: ReactNode
  }

  interface MarkerProps {
    position: [number, number]
    icon?: unknown
    children?: ReactNode
  }

  interface PopupProps {
    children?: ReactNode
  }

  interface TooltipProps {
    permanent?: boolean
    direction?: string
    className?: string
    children?: ReactNode
  }

  export const MapContainer: ComponentType<MapContainerProps>
  export const TileLayer: ComponentType<TileLayerProps>
  export const Circle: ComponentType<CircleProps>
  export const Marker: ComponentType<MarkerProps>
  export const Popup: ComponentType<PopupProps>
  export const Tooltip: ComponentType<TooltipProps>
}
