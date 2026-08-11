import { formatInTimeZone } from "date-fns-tz";

const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kuala_Lumpur";

/**
 * Format a date for display in the app timezone (Malaysia UTC+8).
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatInTimeZone(d, APP_TIMEZONE, "dd MMM yyyy");
}

/**
 * Format a date-time for display in the app timezone.
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatInTimeZone(d, APP_TIMEZONE, "dd MMM yyyy, HH:mm");
}

/**
 * Format a number as currency (MYR).
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a number with comma separators.
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-MY").format(num);
}

/**
 * Combine CSS class names, filtering out falsy values.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Get the transaction type display label and color class.
 */
export function getTransactionTypeInfo(type: string): {
  label: string;
  colorClass: string;
} {
  switch (type) {
    case "receive":
      return { label: "Received", colorClass: "badge-success" };
    case "issue":
      return { label: "Issued", colorClass: "badge-danger" };
    case "transfer":
      return { label: "Transfer", colorClass: "badge-info" };
    case "adjust":
      return { label: "Adjustment", colorClass: "badge-warning" };
    default:
      return { label: type, colorClass: "badge-default" };
  }
}

/**
 * Calculate days until a date. Returns negative for past dates.
 */
export function daysUntil(date: Date | string): number {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Debounce a function call.
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
