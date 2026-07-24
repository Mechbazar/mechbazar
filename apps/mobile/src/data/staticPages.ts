// Content for the footer's Company/Policies links (About Us, Careers,
// Privacy Policy, Terms of Service, Return & Refund Policy, Shipping
// Policy, Become a Mechanic) -- previously rendered as plain non-interactive
// text with no backing page. Policy specifics here are kept consistent with
// what the app actually does today (COD-only checkout, 10-day return window
// -- matches HelpCenterScreen's existing FAQ answers) rather than generic
// boilerplate that would contradict the rest of the app.
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
  | 'about' | 'careers' | 'privacy' | 'terms' | 'returns' | 'shipping' | 'become-mechanic';

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
        body: 'To create your account and process orders, we collect your phone number, name, delivery addresses, saved vehicle details, and order/booking history. Payment is currently Cash on Delivery only, so we do not collect or store card or bank details.',
      },
      {
        heading: 'How we use your information',
        body: 'Your information is used to fulfil orders and service bookings, show you compatible parts for your saved vehicles, send order/booking status updates and notifications, and improve the catalog and service quality over time.',
      },
      {
        heading: 'Sharing with vendors and mechanics',
        body: 'When you place an order, the relevant vendor receives the order details and delivery address needed to fulfil it. When you book a service, the assigned mechanic receives your address and contact number to complete the visit. We do not sell your personal information to third parties.',
      },
      {
        heading: 'Your choices',
        body: 'You can review and update your profile, saved addresses, and saved vehicles at any time from your Account page, and delete individual addresses or vehicles you no longer want stored.',
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    updatedAt: '',
    sections: [
      {
        heading: 'Using MechBazar',
        body: 'By creating an account and placing orders or bookings, you agree to provide accurate information (your delivery address, vehicle details, and contact number) so vendors and mechanics can fulfil your request correctly.',
      },
      {
        heading: 'Orders and pricing',
        body: 'Prices, discounts, and stock levels shown in the app are set by individual vendors and can change without notice. An order is confirmed once placed; availability is still subject to the vendor’s stock at fulfilment time.',
      },
      {
        heading: 'Service bookings',
        body: 'Doorstep service bookings are fulfilled by independent verified mechanics through the platform. Estimated arrival times are best-effort and can shift based on the mechanic’s schedule and location.',
      },
      {
        heading: 'Payments',
        body: 'Cash on Delivery is currently the only supported payment method for both parts and services. Payment is collected by the delivery partner or mechanic at the time of fulfilment.',
      },
      {
        heading: 'Account responsibility',
        body: 'You’re responsible for keeping your account’s registered phone number accurate, since order and booking updates, and OTP-based login, are both tied to it.',
      },
    ],
  },
  returns: {
    title: 'Return & Refund Policy',
    updatedAt: '',
    sections: [
      {
        heading: '10-day return window',
        body: 'Unused spare parts in their original packaging can be returned within 10 days of delivery. Start a return from the order in your Orders page.',
      },
      {
        heading: 'What isn’t eligible',
        body: 'Parts that have been installed or show signs of use, and items missing their original packaging, aren’t eligible for return. Doorstep services already carried out aren’t refundable once completed, but you can cancel a booking before the mechanic starts work.',
      },
      {
        heading: 'Refunds on Cash on Delivery orders',
        body: 'Since checkout is Cash on Delivery, approved returns are refunded to the same bank/UPI details you provide during the return request rather than reversed on a card, as there’s no online payment to reverse.',
      },
    ],
  },
  shipping: {
    title: 'Shipping Policy',
    updatedAt: '',
    sections: [
      {
        heading: 'Delivery',
        body: 'Orders are fulfilled by the vendor and handed to a delivery partner for last-mile delivery. You can track an order’s status from the Orders tab at any time after it’s placed.',
      },
      {
        heading: 'Delivery timing',
        body: 'Delivery timing depends on the vendor’s location and stock availability, and can vary by item and by pincode.',
      },
      {
        heading: 'Delivery address',
        body: 'Delivery goes to the address selected at checkout. You can manage saved addresses from Account → Addresses, including setting a default address for faster checkout.',
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
