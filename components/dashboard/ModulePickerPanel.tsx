// components/dashboard/ModulePickerPanel.tsx
// Slide-out panel for enabling/disabling and reordering dashboard modules
"use client"

import { useCallback } from "react"
import {
  DashboardModuleLayout,
  MODULE_REGISTRY,
  DashboardModuleId,
} from "@/types/dashboard-modules"

interface ModulePickerPanelProps {
  open: boolean
  onClose: () => void
  layout: DashboardModuleLayout[]
  onToggle: (id: string) => void
  onReorder: (fromIndex: number, toIndex: number) => void
  saving: boolean
}

export function ModulePickerPanel({
  open,
  onClose,
  layout,
  onToggle,
  onReorder,
  saving,
}: ModulePickerPanelProps) {
  const enabledModules = layout
    .filter((m) => m.enabled)
    .sort((a, b) => a.order - b.order)
  const disabledModules = layout.filter((m) => !m.enabled)

  const getLabel = useCallback((id: DashboardModuleId) => {
    return MODULE_REGISTRY.find((m) => m.id === id)?.label || id
  }, [])

  const getDescription = useCallback((id: DashboardModuleId) => {
    return MODULE_REGISTRY.find((m) => m.id === id)?.description || ""
  }, [])

  const moveUp = useCallback(
    (index: number) => {
      if (index > 0) onReorder(index, index - 1)
    },
    [onReorder]
  )

  const moveDown = useCallback(
    (index: number) => {
      if (index < enabledModules.length - 1) onReorder(index, index + 1)
    },
    [onReorder, enabledModules.length]
  )

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-[#111827] border-l border-white/10 z-50 overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div>
            <h2 className="text-base font-semibold text-white">
              Dashboard Modules
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Enable, disable, and reorder modules
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            aria-label="Close settings"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {saving && (
          <div className="px-6 py-2 bg-[#E8700A]/10 text-xs text-[#E8700A]">
            Saving...
          </div>
        )}

        {/* Enabled modules */}
        <div className="px-6 py-4">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
            Active Modules
          </h3>
          <div className="space-y-2">
            {enabledModules.map((mod, index) => (
              <div
                key={mod.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5"
              >
                {/* Reorder arrows */}
                <div className="flex flex-col shrink-0">
                  <button
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="p-0.5 text-gray-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    aria-label={`Move ${getLabel(mod.id)} up`}
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 15l7-7 7 7"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => moveDown(index)}
                    disabled={index === enabledModules.length - 1}
                    className="p-0.5 text-gray-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    aria-label={`Move ${getLabel(mod.id)} down`}
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                </div>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200">
                    {getLabel(mod.id)}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {getDescription(mod.id)}
                  </p>
                </div>

                {/* Toggle */}
                <button
                  onClick={() => onToggle(mod.id)}
                  className="shrink-0 w-9 h-5 bg-[#E8700A] rounded-full relative transition-colors"
                  aria-label={`Disable ${getLabel(mod.id)}`}
                >
                  <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform" />
                </button>
              </div>
            ))}
            {enabledModules.length === 0 && (
              <p className="text-xs text-gray-500 py-3 text-center">
                No modules enabled
              </p>
            )}
          </div>
        </div>

        {/* Disabled modules */}
        {disabledModules.length > 0 && (
          <div className="px-6 py-4 border-t border-white/5">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
              Available Modules
            </h3>
            <div className="space-y-2">
              {disabledModules.map((mod) => (
                <div
                  key={mod.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.01] border border-white/5 opacity-60"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-300">
                      {getLabel(mod.id)}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {getDescription(mod.id)}
                    </p>
                  </div>
                  <button
                    onClick={() => onToggle(mod.id)}
                    className="shrink-0 w-9 h-5 bg-white/10 rounded-full relative transition-colors"
                    aria-label={`Enable ${getLabel(mod.id)}`}
                  >
                    <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-gray-400 rounded-full shadow transition-transform" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
