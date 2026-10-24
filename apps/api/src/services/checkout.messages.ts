/** The inbox message a vendor receives when a buyer pays online. */
export function formatOrderMessage(o: {
  orderNumber: string;
  /** What was bought: one entry per product. */
  lines: { name: string; brand: string | null; quantity: number }[];
  total: number;
  currency: string;
  fulfilment: "PICKUP" | "DELIVERY";
  deliveryAddress: string | null;
  buyerPhone: string;
}): string {
  const amount = new Intl.NumberFormat("en-NG", { style: "currency", currency: o.currency }).format(o.total);
  const how =
    o.fulfilment === "DELIVERY"
      ? `Delivery to: ${o.deliveryAddress ?? "(no address given)"}`
      : "Pickup from your store";
  return [
    `New paid order ${o.orderNumber}`,
    ...o.lines.map((l) => `${l.quantity} × ${l.name}${l.brand ? ` (${l.brand})` : ""}`),
    `Paid: ${amount} (online via Finder)`,
    how,
    `Buyer phone: ${o.buyerPhone}`,
    "",
    "Please confirm and arrange the handover here.",
  ].join("\n");
}
