import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
