// lib/utils.ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, formatStr: string = "MMM dd, yyyy") {
  return format(new Date(date), formatStr)
}

export function formatDateTime(date: string | Date) {
  return format(new Date(date), "MMM dd, yyyy h:mm a")
}

export function timeUntil(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function daysUntil(date: string | Date): number {
  const now = new Date()
  const target = new Date(date)
  const diff = target.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}
