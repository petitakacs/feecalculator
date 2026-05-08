/**
 * Format cents to currency string (e.g., €1,234.56)
 */
export function formatCurrency(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "€0.00";
  const amount = cents / 100;
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a decimal as percentage (e.g., 0.039 → "3.90%")
 */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "0.00%";
  return `${(value * 100).toFixed(2)}%`;
}

/**
 * Format a number with 2 decimal places
 */
export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return "0.00";
  return hours.toFixed(2);
}

/**
 * Parse a currency string to cents integer
 */
export function parseCurrencyToCents(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const amount = parseFloat(cleaned);
  if (isNaN(amount)) return 0;
  return Math.round(amount * 100);
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
 * Format cents to EUR amount for input fields (e.g., 123456 → "1234.56")
 */
export function centsToEuroString(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Parse EUR string to cents (e.g., "1234.56" → 123456)
 */
export function euroStringToCents(value: string): number {
  const amount = parseFloat(value.replace(/,/g, ""));
  if (isNaN(amount)) return 0;
  return Math.round(amount * 100);
}
