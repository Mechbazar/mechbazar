// Plain module-level store (same shape as desktopFullPageScreenStore.ts) --
// no React, no persistence. Lets a web-only guest-auth redirect (set from
// App.web.tsx's RequireAuth guard, or from a protected action like Cart
// checkout / DesktopHeader's wishlist icon) survive the trip through
// WelcomeScreen and land the user back where they were trying to go instead
// of always dropping them on Home after login.
//
// Native never calls setPendingRedirect (only App.web.tsx, which is never
// bundled for native, does) -- WelcomeScreen.tsx's consumer side is also
// gated on Platform.OS === 'web', so this is a no-op import on native.
type RedirectTarget = { screen: string; params?: object };

let pending: RedirectTarget | null = null;

export function setPendingRedirect(target: RedirectTarget) {
  pending = target;
}

export function consumePendingRedirect(): RedirectTarget | null {
  const target = pending;
  pending = null;
  return target;
}
