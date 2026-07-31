// Plain string templates, not a templating engine or React Email -- this is
// the first transactional email this backend has ever sent, so there's no
// existing convention to match yet and no second template to justify the
// extra dependency. Revisit once there's a third template and the
// duplication actually hurts.

export interface OrderConfirmationItem {
  name: string;
  quantity: number;
  price: number;
}

export interface OrderConfirmationInput {
  orderId: string;
  customerName: string | null;
  items: OrderConfirmationItem[];
  subtotal: number;
  deliveryFee: number;
  discountAmount: number;
  finalAmount: number;
  addressLine: string;
}

const rupees = (amount: number) => `₹${amount.toFixed(2)}`;
const shortId = (id: string) => id.slice(0, 8).toUpperCase();

export function buildOrderConfirmationEmail(order: OrderConfirmationInput): { subject: string; html: string; text: string } {
  const greeting = order.customerName ? `Hi ${order.customerName},` : 'Hi,';
  const rows = order.items
    .map(
      (item) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #E6E9ED;">${item.name} &times; ${item.quantity}</td>` +
        `<td style="padding:8px 0;border-bottom:1px solid #E6E9ED;text-align:right;">${rupees(item.price * item.quantity)}</td></tr>`
    )
    .join('');

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1C2430;">
  <div style="background:#DA3830;padding:20px;text-align:center;">
    <span style="color:#fff;font-size:20px;font-weight:700;">MechBazar</span>
  </div>
  <div style="padding:24px;">
    <p>${greeting}</p>
    <p>Thanks for your order! We've received order <strong>#${shortId(order.orderId)}</strong> and it's being processed.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      ${rows}
    </table>
    <table style="width:100%;font-size:14px;">
      <tr><td>Subtotal</td><td style="text-align:right;">${rupees(order.subtotal)}</td></tr>
      <tr><td>Delivery Fee</td><td style="text-align:right;">${rupees(order.deliveryFee)}</td></tr>
      ${order.discountAmount > 0 ? `<tr><td>Discount</td><td style="text-align:right;">-${rupees(order.discountAmount)}</td></tr>` : ''}
      <tr style="font-weight:700;"><td style="padding-top:8px;">Total</td><td style="text-align:right;padding-top:8px;">${rupees(order.finalAmount)}</td></tr>
    </table>
    <p style="font-size:14px;color:#6B7480;margin-top:16px;">Delivering to: ${order.addressLine}</p>
    <p style="font-size:12px;color:#9AA5B1;margin-top:24px;">You can track this order any time in the MechBazar app under Orders.</p>
  </div>
</div>`.trim();

  const text =
    `${greeting}\n\nThanks for your order! We've received order #${shortId(order.orderId)} and it's being processed.\n\n` +
    order.items.map((i) => `${i.name} x ${i.quantity} - ${rupees(i.price * i.quantity)}`).join('\n') +
    `\n\nSubtotal: ${rupees(order.subtotal)}\nDelivery Fee: ${rupees(order.deliveryFee)}\n` +
    (order.discountAmount > 0 ? `Discount: -${rupees(order.discountAmount)}\n` : '') +
    `Total: ${rupees(order.finalAmount)}\n\nDelivering to: ${order.addressLine}\n`;

  return { subject: `Order Confirmed - #${shortId(order.orderId)}`, html, text };
}
