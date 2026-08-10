// Single source of truth for MechBazar's customer-support contact channels.
// Matches the "Customer Support Phone" MechBazar actually publishes in
// docs/legal/contact-us.md -- keep both in sync if the number ever changes.
export const SUPPORT_PHONE_E164 = '+919772704981';
export const SUPPORT_PHONE_DISPLAY = '+91 97727 04981';
export const SUPPORT_WHATSAPP_NUMBER = '919772704981';
export const SUPPORT_EMAIL = 'support@mechbazar.com';

export const buildSupportWhatsAppUrl = (message: string): string =>
  `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
