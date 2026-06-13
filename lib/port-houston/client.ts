// lib/port-houston/client.ts
// HTTP client for Port Houston Navis N4/EVP API with retry and pagination

import { getToken, invalidateToken } from "./auth"
import type {
  PHVesselVisit,
  PHUnit,
  PHPagedResponse,
} from "./types"

const API_URL = process.env.PORT_HOUSTON_API_URL!
const OPERATOR = process.env.PORT_HOUSTON_OPERATOR || "POHA"

const MAX_RETRIES = 2
const RETRY_BASE_MS = 500
const REQUEST_TIMEOUT_MS = 20000 // 20s per individual API call

// ============================================================
// Core Fetch with Auth + Retry + Timeout
// ============================================================

interface FetchOptions {
  path: string
  params?: Record<string, string>
  method?: "GET" | "POST" | "PUT" | "DELETE"
  body?: unknown
  retries?: number
  timeoutMs?: number
}

async function phFetch<T>(options: FetchOptions): Promise<T> {
  const {
    path,
    params,
    method = "GET",
    body,
    retries = 0,
    timeoutMs = REQUEST_TIMEOUT_MS,
  } = options

  const url = new URL(`${API_URL}${path}`)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
  }

  const token = await getToken()
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  }
  if (body) {
    headers["Content-Type"] = "application/json"
  }

  // Timeout via AbortController
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // Handle 401 — invalidate token and retry once
    if (response.status === 401 && retries < 1) {
      invalidateToken()
      return phFetch({ ...options, retries: retries + 1 })
    }

    // Handle retriable errors (429, 500, 502, 503, 504)
    if (
      [429, 500, 502, 503, 504].includes(response.status) &&
      retries < MAX_RETRIES
    ) {
      const delay = RETRY_BASE_MS * Math.pow(2, retries)
      await new Promise((r) => setTimeout(r, delay))
      return phFetch({ ...options, retries: retries + 1 })
    }

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `PH API error ${response.status} on ${method} ${path}: ${errorText}`
      )
    }

    return response.json()
  } catch (err) {
    clearTimeout(timeoutId)

    // Determine if this is a retriable network error (timeout, DNS, TLS, connection reset)
    const isTimeout = err instanceof DOMException && err.name === "AbortError"
    const isNetworkError = err instanceof TypeError && /fetch failed|network|ECONNR|ENOTFOUND|EAI_AGAIN/i.test(err.message)

    if ((isTimeout || isNetworkError) && retries < MAX_RETRIES) {
      const reason = isTimeout ? "timeout" : "network error"
      const delay = RETRY_BASE_MS * Math.pow(2, retries)
      console.warn(`[PH Client] ${reason} on ${method} ${path}, retrying in ${delay}ms (attempt ${retries + 1})...`)
      await new Promise((r) => setTimeout(r, delay))
      return phFetch({ ...options, retries: retries + 1 })
    }

    if (isTimeout) {
      throw new Error(
        `PH API timeout after ${timeoutMs}ms on ${method} ${path}`
      )
    }
    throw err
  }
}

// ============================================================
// Vessel Visits
// ============================================================

interface VesselQueryOptions {
  facility?: string // "BPT" or "BCT"
  etaFrom?: string // ISO date
  etaTo?: string // ISO date
  fields?: string[]
  size?: number
}

/**
 * Fetch vessel visits from Port Houston, handling pagination.
 * Returns all pages concatenated.
 */
export async function fetchVesselVisits(
  options: VesselQueryOptions = {}
): Promise<PHVesselVisit[]> {
  const {
    facility,
    etaFrom,
    etaTo,
    fields,
    size = 100,
  } = options

  // Build predicate for date range
  const predicateParts: string[] = []
  if (etaFrom) predicateParts.push(`eta>=${etaFrom}`)
  if (etaTo) predicateParts.push(`etd<=${etaTo}`)

  const params: Record<string, string> = {
    operator: OPERATOR,
    size: size.toString(),
  }
  if (facility) params.facility = facility
  if (predicateParts.length > 0) {
    params.predicate = predicateParts.join(" and ")
  }
  if (fields && fields.length > 0) {
    params.fields = fields.join(",")
  }

  const allVessels: PHVesselVisit[] = []
  let nextCursor: string | undefined = undefined
  let pageCount = 0
  const maxPages = 10 // Safety cap

  do {
    const pageParams = { ...params }
    if (nextCursor) pageParams.next = nextCursor

    const page = await phFetch<PHPagedResponse<PHVesselVisit>>({
      path: "/vessel/vesselvisits",
      params: pageParams,
    })

    if (page.content) {
      allVessels.push(...page.content)
    }

    nextCursor = page.paging?.next
    pageCount++
  } while (nextCursor && pageCount < maxPages)

  if (pageCount >= maxPages) {
    console.warn(
      `[PH Client] Vessel fetch hit max pages (${maxPages}), got ${allVessels.length} vessels`
    )
  }

  return allVessels
}

// ============================================================
// Container / Unit Inventory
// ============================================================

interface UnitQueryOptions {
  facility?: string
  predicate?: string // Raw predicate string (e.g. "category=IMPRT")
  fields?: string[]
  size?: number
  maxPages?: number
  timeoutMs?: number // Override per-request timeout (default: 15s)
}

/**
 * Fetch container/unit inventory from Port Houston, handling pagination.
 */
export async function fetchUnits(
  options: UnitQueryOptions = {}
): Promise<PHUnit[]> {
  const { facility, predicate, fields, size = 100, maxPages = 3, timeoutMs } = options

  const params: Record<string, string> = {
    operator: OPERATOR,
    size: size.toString(),
  }
  if (facility) params.facility = facility
  if (predicate) params.predicate = predicate
  if (fields && fields.length > 0) {
    params.fields = fields.join(",")
  }

  const allUnits: PHUnit[] = []
  let nextCursor: string | undefined = undefined
  let pageCount = 0

  do {
    const pageParams = { ...params }
    if (nextCursor) pageParams.next = nextCursor

    const page = await phFetch<PHPagedResponse<PHUnit>>({
      path: "/inventory/units",
      params: pageParams,
      ...(timeoutMs ? { timeoutMs } : {}),
    })

    if (page.content) {
      allUnits.push(...page.content)
    }

    nextCursor = page.paging?.next
    pageCount++
  } while (nextCursor && pageCount < maxPages)

  if (pageCount >= maxPages && nextCursor && maxPages > 1) {
    console.warn(
      `[PH Client] Unit fetch hit max pages (${maxPages}), got ${allUnits.length} units — results may be incomplete`
    )
  }

  return allUnits
}

