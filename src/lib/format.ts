/**
 * Format cents to currency string (e.g., €1,234.56)
 */
export function formatCurrency(forint: number | string | null | undefined): string {
  if (forint === null || forint === undefined) return "0 Ft";
  return new Intl.NumberFormat("hu-HU", {
    style: "currency",
    currency: "HUF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(forint));
}

/**
 * Format a decimal as percentage (e.g., 0.039 → "3.90%")
 */
export function formatPercent(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "0.00%";
  return `${(Number(value) * 100).toFixed(2)}%`;
}

/**
 * Format a number with 2 decimal places
 */
export function formatHours(hours: number | string | null | undefined): string {
  if (hours === null || hours === undefined) return "0.00";
  return Number(hours).toFixed(2);
}

/**
 * Parse a currency string to forint integer
 */
export function parseCurrencyToCents(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const amount = parseFloat(cleaned);
  if (isNaN(amount)) return 0;
  return Math.round(amount);
}

/**
 * Format month/year display
 */
export function formatPeriod(month: number, year: number): string {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("en-IE", { month: "long", year: "numeric" });
}

/**
 * Format a date string to display format
 */
export function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format forint integer for input fields (e.g., 123456 → "123456")
 */
export function centsToEuroString(forint: number): string {
  return String(Math.round(forint));
}

/**
 * Parse forint string to integer (e.g., "123456" → 123456)
 */
export function euroStringToCents(value: string): number {
  const amount = parseFloat(value.replace(/[\s,]/g, ""));
  if (isNaN(amount)) return 0;
  return Math.round(amount);
}
