export const money = (n: number | null) =>
  n === null
    ? "Unavailable"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(n);

export function productLinkLabel(url: string) {
  const host = new URL(url).hostname;
  return /(^|\.)amazon\.[a-z.]+$/.test(host)
    ? "Amazon listing (may include affiliate tag)"
    : "Original product research source";
}
