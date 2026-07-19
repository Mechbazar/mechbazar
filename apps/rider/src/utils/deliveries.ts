// Order.status values relevant to a rider (see prisma OrderStatus enum):
// PICKUP -> assigned, waiting for the rider to collect it
// ON_THE_WAY -> picked up, en route to the customer
// DELIVERED / RETURNED -> terminal states (RETURNED = rider reported an issue)
export type Delivery = {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  finalAmount: number;
  address: { line1: string; line2?: string | null; city: string; state: string; pincode: string };
  user: { name?: string | null; phone: string };
  payment?: { method: string; amount: number } | null;
  items: { id: string; quantity: number; product: { name: string } }[];
  proofImageUrl?: string | null;
  codCollected?: boolean;
  issueReason?: string | null;
};

export const isPendingPickup = (d: Delivery) => d.status === 'PICKUP';
export const isInProgress = (d: Delivery) => d.status === 'ON_THE_WAY';
export const isCompleted = (d: Delivery) => d.status === 'DELIVERED' || d.status === 'RETURNED';

export const isDeliveredToday = (d: Delivery) => {
  const updated = new Date(d.updatedAt);
  const now = new Date();
  return (
    d.status === 'DELIVERED' &&
    updated.getFullYear() === now.getFullYear() &&
    updated.getMonth() === now.getMonth() &&
    updated.getDate() === now.getDate()
  );
};
