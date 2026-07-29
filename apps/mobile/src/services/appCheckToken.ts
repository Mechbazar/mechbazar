// Native (iOS/Android) entrypoint -- Metro picks appCheckToken.web.ts instead
// for the web build, same platform-split convention as phoneAuth.ts /
// phoneAuth.web.ts. Keeps the web-only 'firebase' SDK (firebase.ts) out of
// the native bundle graph entirely, rather than gating it behind a runtime
// Platform.OS check in a file both platforms import.
export { getAppCheckToken } from './appCheck';
