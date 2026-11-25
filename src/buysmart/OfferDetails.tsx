import { money } from "./format";
import type { Product } from "./model";

export function OfferDetails({ product }: { product: Product }) {
  const offer = product.offer;
  if (!offer) return null;
  return <div className="offer-details">
    <p>{offer.variant ?? "Verify the exact variant"}</p>
    <p>{offer.inStock === null ? "Stock unavailable" : offer.inStock ? "Reported in stock" : "Reported out of stock"}
      {offer.seller ? ` · Seller: ${offer.seller}` : " · Seller unavailable"}</p>
    <p>USD · US market · Shipping: {offer.shipping === null ? "unknown" : money(offer.shipping)} · Taxes excluded</p>
    <p>Observed <time dateTime={offer.observedAt}>{new Date(offer.observedAt).toLocaleString("en-US", { timeZoneName: "short" })}</time>. Verify the checkout total.</p>
  </div>;
}
