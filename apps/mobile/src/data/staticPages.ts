// Content for the footer's Company/Policies links and the in-app Legal
// section. Policy specifics here are deliberately kept consistent with what
// the app actually does today rather than generic boilerplate:
//
//   * MechBazar is CASH ON DELIVERY ONLY. There is no payment gateway, no
//     UPI/card/net-banking/wallet payment, and no prepaid option anywhere in
//     the product (see apps/backend/src/services/payment.service.ts, which
//     hard-locks the payment method server-side). No page here may mention or
//     imply online payment.
//   * The return window is 10 days, matching HelpCenterScreen's FAQ answers.
//   * Account deletion is self-service via Account > Security > Delete
//     Account, backed by DELETE /customers/me.
//
// The full, legally-complete versions of these documents live in docs/legal/
// and are published at the website URLs referenced below; these are the
// in-app summaries. Keep the two in sync.
export interface StaticPageSection {
  heading: string;
  body: string;
}

export interface StaticPageContent {
  title: string;
  updatedAt: string;
  sections: StaticPageSection[];
}

export type StaticPageKey =
  | 'about'
  | 'careers'
  | 'privacy'
  | 'terms'
  | 'returns'
  | 'refund'
  | 'shipping'
  | 'cancellation'
  | 'account-deletion'
  | 'contact'
  | 'become-mechanic';

export const STATIC_PAGES: Record<StaticPageKey, StaticPageContent> = {
  about: {
    title: 'About Us',
    updatedAt: '',
    sections: [
      {
        heading: 'Who we are',
        body: 'MechBazar is an online marketplace for genuine automotive spare parts and doorstep mechanic services, built for car and bike owners who want reliable parts and trustworthy service without the hassle of visiting a garage in person.',
      },
      {
        heading: 'What we offer',
        body: 'Browse and buy spare parts filtered to fit your exact vehicle, book verified mechanics for doorstep servicing, track your orders and service bookings in real time, and manage a garage of saved vehicles for faster, more accurate shopping.',
      },
      {
        heading: 'Our vendors and mechanics',
        body: 'Every product on MechBazar is listed by a vetted vendor, and every service is carried out by a verified technician. Vendors go through an approval process before their listings go live, and mechanics accept and complete bookings through the same platform you use to book them.',
      },
      {
        heading: 'How you pay',
        body: 'MechBazar is Cash on Delivery only. You pay in cash when your parts are delivered, or to the mechanic once your service is complete. We do not accept online payments and never ask for money in advance.',
      },
    ],
  },
  careers: {
    title: 'Careers',
    updatedAt: '',
    sections: [
      {
        heading: 'Join MechBazar',
        body: 'We’re building the platform car and bike owners rely on for parts and service. If you’re interested in opportunities at MechBazar — engineering, operations, vendor partnerships, or customer support — we’d like to hear from you.',
      },
      {
        heading: 'How to apply',
        body: 'We don’t have open listings published in-app yet. Reach out through Help Center with a short note about your background and the kind of role you’re looking for, and our team will follow up.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    updatedAt: '',
    sections: [
      {
        heading: 'Information we collect',
        body: 'To create your account and process orders we collect your mobile number, name, delivery and service addresses, saved vehicle details, and your order and booking history. We also collect device information, app usage and crash diagnostics, and — with your permission — your location and photos you attach to a return or support request.',
      },
      {
        heading: 'No payment or financial data',
        body: 'MechBazar is Cash on Delivery only. We do not operate a payment gateway and never collect card numbers, UPI IDs, net-banking credentials, CVVs or PINs. The only financial detail we may hold is a bank account or UPI ID you voluntarily provide so we can pay you a refund on an approved return.',
      },
      {
        heading: 'How we use your information',
        body: 'Your information is used to fulfil orders and service bookings, show you parts that fit your saved vehicles, send order and booking updates, respond to support requests, prevent fraud, and improve the catalogue and service quality over time.',
      },
      {
        heading: 'Permissions we ask for',
        body: 'Location is used to check serviceability, fill in your delivery address and show live delivery or mechanic tracking. Camera and photo access is used only when you attach an image to a return, review or support request. Notifications are used for order and booking updates. You can decline any permission and continue using the app with that feature disabled.',
      },
      {
        heading: 'Sharing with vendors and mechanics',
        body: 'When you place an order, the relevant vendor and delivery partner receive the order details, delivery address and contact number needed to fulfil it. When you book a service, the assigned mechanic receives your address, contact number and vehicle details. We do not sell your personal information to anyone.',
      },
      {
        heading: 'Your rights',
        body: 'You can review and update your profile, addresses and saved vehicles at any time under Account, and delete any address or vehicle you no longer want stored. You can delete your entire account from Account > Security > Delete Account. Write to us to request access to, or correction of, any other data we hold about you.',
      },
      {
        heading: 'Full policy',
        body: 'This is a summary. The complete Privacy Policy, including retention periods, third-party processors and grievance redressal, is published on the MechBazar website.',
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    updatedAt: '',
    sections: [
      {
        heading: 'Using MechBazar',
        body: 'You must be 18 or older to place an order or booking. By registering you agree to provide accurate information — your delivery address, vehicle details and contact number — so vendors and mechanics can fulfil your request correctly.',
      },
      {
        heading: 'A marketplace, not a seller',
        body: 'MechBazar is a marketplace. Parts are sold and fulfilled by independent vendors, and doorstep services are performed by independent verified mechanics. The contract of sale is between you and that vendor or mechanic; MechBazar operates the platform, verifies participants and handles grievance redressal.',
      },
      {
        heading: 'Fitment is yours to confirm',
        body: 'Fitment filters based on your saved vehicle are an aid, not a guarantee. Fitment can vary with facelifts, variants and prior repairs. Check the part number against the component on your vehicle, or ask a qualified mechanic, before fitting anything.',
      },
      {
        heading: 'Orders and pricing',
        body: 'Prices, discounts and stock levels are set by individual vendors and can change without notice. An order is an offer to purchase and is confirmed when the vendor accepts it; availability remains subject to stock at the time of fulfilment. All charges are shown in full before you confirm an order.',
      },
      {
        heading: 'Service bookings',
        body: 'Doorstep bookings are fulfilled by independent verified mechanics. Arrival times are best-effort estimates. If extra parts or labour are needed, the mechanic will ask you to approve the revised cost before proceeding. Do not share your completion OTP until the work is actually done.',
      },
      {
        heading: 'Payment — Cash on Delivery only',
        body: 'Cash on Delivery is the only payment method MechBazar supports. Payment is collected in cash by the delivery partner at handover, or by the mechanic once the service is complete. We do not accept UPI, cards, net banking, wallets or any other online payment, and no money is ever taken in advance. Always pay the exact invoice amount and collect a receipt.',
      },
      {
        heading: 'Account responsibility',
        body: 'You’re responsible for keeping your registered mobile number accurate, since order updates and OTP-based login are both tied to it. Never share your login OTP — MechBazar staff will never ask for it.',
      },
      {
        heading: 'Governing law',
        body: 'These terms are governed by the laws of India. Nothing here limits your rights under the Consumer Protection Act, 2019.',
      },
    ],
  },
  returns: {
    title: 'Return & Replacement Policy',
    updatedAt: '',
    sections: [
      {
        heading: '10-day return window',
        body: 'Unused spare parts in their original, unopened packaging can be returned within 10 days of delivery. Start a return from the order in your Orders page. Wrong items, transit damage and shortages should be reported within 48 hours of delivery, with photographs.',
      },
      {
        heading: 'What isn’t eligible',
        body: 'Parts that have been installed, fitted or show signs of use; electrical and electronic components once installed or tested; fluids, oils and consumables with a broken seal; batteries showing installation marks; made-to-order or special-order parts; and items missing their original packaging, seals or accessories are not returnable. Services already carried out are not refundable once complete, but you can cancel a booking before the mechanic starts work.',
      },
      {
        heading: 'Replacement',
        body: 'Where the item delivered was wrong, damaged in transit or defective on arrival, you can choose a free replacement instead of a refund, with free reverse pick-up. Replacements carry the remainder of the original warranty.',
      },
      {
        heading: 'Warranty',
        body: 'Manufacturer or vendor warranty runs separately from the 10-day return window, on the terms stated on the product page. Workmanship on doorstep services is warranted for 30 days or 1,000 kilometres, whichever comes first.',
      },
    ],
  },
  refund: {
    title: 'Refund Policy',
    updatedAt: '',
    sections: [
      {
        heading: 'Nothing is charged before delivery',
        body: 'MechBazar is Cash on Delivery only. You pay nothing when you place an order or booking, so cancelling before delivery or before the mechanic starts work costs you nothing and there is no refund to process.',
      },
      {
        heading: 'When a refund is due',
        body: 'A refund arises only where you have already paid cash and are entitled to money back — an approved return, a wrong or damaged item you have already paid for, or a service charged but not delivered. In those cases the full amount you paid is refunded, including delivery charges where the fault was ours or the vendor’s.',
      },
      {
        heading: 'How refunds are paid',
        body: 'Because you paid in cash, there is no original transaction to reverse. Refunds are paid to the bank account or UPI ID you provide with your return request. Please enter the account holder name, account number and IFSC — or a valid UPI ID — carefully, as refunds delayed by incorrect details can only be re-issued once you supply corrected ones.',
      },
      {
        heading: 'Timelines',
        body: 'Refunds are approved within 2 business days of the returned item passing inspection, and credited within 5–10 business days after that, depending on your bank. You can track progress under Orders > Refund Status.',
      },
      {
        heading: 'What is not refunded',
        body: 'Delivery and handling charges on change-of-mind returns, items outside the return window, non-returnable categories, and services already completed are not refunded.',
      },
    ],
  },
  shipping: {
    title: 'Shipping & Delivery Policy',
    updatedAt: '',
    sections: [
      {
        heading: 'Delivery',
        body: 'Orders are fulfilled by the vendor and handed to a delivery partner for last-mile delivery. You can track an order’s status from the Orders tab at any time after it’s placed.',
      },
      {
        heading: 'Delivery timing',
        body: 'Delivery timing depends on the vendor’s location and stock availability, and can vary by item and by pincode. Estimated delivery dates shown at checkout are estimates, not guarantees, and can be affected by weather, traffic and local restrictions.',
      },
      {
        heading: 'Delivery address',
        body: 'Delivery goes to the address selected at checkout, and cannot be changed once the order is dispatched. You can manage saved addresses from Account → Addresses, including setting a default address for faster checkout.',
      },
      {
        heading: 'Paying at the door',
        body: 'All orders are Cash on Delivery. Please keep the exact invoice amount ready — delivery partners may not carry change — and inspect the package before accepting it. If the packaging is torn, wet or visibly tampered with, refuse the delivery and report it immediately.',
      },
      {
        heading: 'Failed deliveries',
        body: 'Our delivery partners make up to three attempts. If nobody is available, the address is incorrect, or the amount is not paid, the shipment is returned to the vendor and the order is cancelled.',
      },
    ],
  },
  cancellation: {
    title: 'Cancellation Policy',
    updatedAt: '',
    sections: [
      {
        heading: 'Cancelling an order',
        body: 'You can cancel an order free of charge from Orders → Cancel Order at any time before it is dispatched. Once it is out for delivery the in-app cancel option is no longer available — you can simply refuse the package at the door instead, at no cost, since nothing has been paid.',
      },
      {
        heading: 'Cancelling a service booking',
        body: 'You can cancel or reschedule a booking free of charge up to 4 hours before the scheduled slot. Cancelling later, or after the mechanic has already travelled to your address, may attract a visitation charge shown at booking. Once work has begun you are liable for the parts fitted and labour performed to that point.',
      },
      {
        heading: 'No cancellation charges before dispatch',
        body: 'Because every order is Cash on Delivery, cancelling before dispatch costs you nothing — no money has changed hands and there is nothing to refund.',
      },
      {
        heading: 'When we may cancel',
        body: 'We or a vendor may cancel an order if the item is out of stock, the address is outside our serviceable area, there is a pricing or listing error, or the order is flagged for suspected fraud or abuse. We will always tell you why, and nothing will have been charged.',
      },
      {
        heading: 'Repeated cancellations',
        body: 'Repeatedly refusing deliveries or missing service appointments may lead to restrictions on your account, since each one costs a vendor, rider or mechanic real time and money.',
      },
    ],
  },
  'account-deletion': {
    title: 'Account Deletion',
    updatedAt: '',
    sections: [
      {
        heading: 'How to delete your account',
        body: 'Go to Account → Security → Delete Account and confirm. Your account is deleted immediately and you are signed out. You can also request deletion by contacting support from the Help Center, or from the MechBazar website without installing the app.',
      },
      {
        heading: 'Before you delete',
        body: 'You cannot delete your account while an order is in transit or a service booking is in progress. Wait for it to be delivered or completed, or cancel it, and then delete.',
      },
      {
        heading: 'What is deleted',
        body: 'Your name, email, mobile number, profile photo, saved delivery and service addresses, garage vehicles, wishlist, notifications and push tokens are erased or irreversibly anonymised. You will not be able to sign in again, and your order and booking history will no longer be available to you.',
      },
      {
        heading: 'What we must keep',
        body: 'Invoices, tax records and transaction records are retained for 8 years, as required by the Companies Act, 2013 and GST law. These are held in restricted-access archives and are not used for any operational or marketing purpose. Reviews you posted remain published but are detached from your identity.',
      },
      {
        heading: 'This cannot be undone',
        body: 'Deletion is permanent. If you register again later with the same mobile number, it will be a completely new account with no previous history.',
      },
    ],
  },
  contact: {
    title: 'Contact Us',
    updatedAt: '',
    sections: [
      {
        heading: 'Customer support',
        body: 'The fastest way to reach us is from the order or booking itself — open Orders, select the item, and tap Report an Issue. It reaches us with your order details already attached. You can also reach the team from Account → Help Center.',
      },
      {
        heading: 'Grievance redressal',
        body: 'If your issue is not resolved by customer support, you can escalate it to our Grievance Officer. Complaints are acknowledged within 48 hours and resolved within 30 days, in line with the Consumer Protection (E-Commerce) Rules, 2020. Contact details are published on the MechBazar website.',
      },
      {
        heading: 'Beware of payment fraud',
        body: 'MechBazar never asks for advance payment, card details, UPI PIN, bank passwords or your login OTP, and never asks you to install a screen-sharing app. Every order is paid in cash at delivery. Report any such request to us immediately, and to the national cybercrime helpline on 1930.',
      },
    ],
  },
  'become-mechanic': {
    title: 'Become a Mechanic',
    updatedAt: '',
    sections: [
      {
        heading: 'Join our network of verified mechanics',
        body: 'MechBazar connects customers with verified mechanics for doorstep vehicle servicing. Mechanics on the platform accept bookings, get routed to the customer’s address, and get paid for completed jobs.',
      },
      {
        heading: 'How to apply',
        body: 'Mechanic onboarding isn’t self-serve from the customer app yet. Reach out through Help Center with your experience and the areas you service, and our team will guide you through verification.',
      },
    ],
  },
};
