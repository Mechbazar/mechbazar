// Shared by every screen/component under screens/services and
// components/services -- matches the app-wide brand palette (also used
// directly, via local literals, by most other screens after the 2026-07-24
// unification that replaced the legacy #E23B22 red and the older #034C8C
// blue -- previously used by Garage/VehicleSelection/DeliveryTracking -- with
// one consistent set of colors).
// Brand palette: Primary #E53935 (nudged to #DA3830 for AA contrast on
// white-text buttons -- see apps/mobile/src/theme/tokens.ts for the same
// nudge rationale), Dark #1B1B1B, Light #F8F9FA, Accent #2ECC71.
export const colors = {
  primary: '#DA3830',
  darkInk: '#1B1B1B',
  steel: '#242C35',
  pageBg: '#F8F9FA',
  white: '#FFFFFF',
  borderLight: '#E3E6EA',
  textDark: '#1B1B1B',
  textMuted: '#6B7480',
  accent: '#2ECC71',
  success: '#1E9E5A',
  warning: '#F5A300',
  danger: '#D32F2F',
};
