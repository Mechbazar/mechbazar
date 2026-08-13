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

// Same reasoning as notify() above, extended to the Yes/No confirm shape
// Alert.alert's button-array form is used for (delete this address, cancel
// this booking, ...): on web that form is exactly as dead as the plain
// single-button call -- no dialog renders, so onPress never fires and the
// action silently does nothing. window.confirm() is the real browser
// equivalent (synchronous, but that's fine here -- every call site is
// already inside an event handler). destructiveLabel/onConfirm mirror the
// two things every call site actually varied in its Alert.alert button
// array; cancelLabel matches Alert.alert's implicit default.
export const confirm = (
  title: string,
  message: string,
  onConfirm: () => void,
  destructiveLabel = 'OK',
): void => {
  if (Platform.OS === 'web') {
    const text = `${title}\n\n${message}`;
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (window.confirm(text)) onConfirm();
    } else {
      console.log(`[confirm] ${text}`);
    }
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: destructiveLabel, style: 'destructive', onPress: onConfirm },
  ]);
};
