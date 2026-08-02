// Minimal HTML-entity escaping for interpolating untrusted text into the
// plain-string email templates in src/emails/ (customer names, delivery
// addresses, product names) -- those aren't a templating engine with
// automatic escaping, so without this a crafted name like
// `<img src=x onerror=...>` would be sent verbatim inside a real email from
// no-reply@mechbazar.com.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
