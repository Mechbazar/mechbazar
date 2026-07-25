import { Alert, Platform } from 'react-native';

// react-native-web's Alert is a stub -- `class Alert { static alert() {} }`
// (see node_modules/react-native-web/dist/exports/Alert). So Alert.alert(...)
// silently does NOTHING on web: no success dialog, no error dialog, nothing.
// That is why the web OTP flow appeared "dead" -- Firebase was being called
// and (when it failed) throwing, but every user-facing message was swallowed.
//
// Use this helper instead of Alert.alert for anything that must be visible on
// web. On native it delegates to the real Alert; on web it falls back to the
// browser's window.alert so the message actually reaches the user.
export const notify = (title: string, message?: string): void => {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(text);
    } else {
      console.log(`[notify] ${text}`);
    }
    return;
  }
  Alert.alert(title, message);
};
