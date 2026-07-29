import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Button, Typography } from '@mechbazar/shared';

// The app previously had no error boundary at all. React's default behaviour on
// an uncaught render error is to unmount the entire tree, so a single bad field
// on one API response -- a null where a screen expected an object, an unexpected
// enum value -- took the whole app to a blank screen with no way back except a
// force-quit. Both stores treat that as a crash.
//
// This catches render-phase errors below it and offers a recovery path instead.
// It deliberately does NOT try to be clever about which errors are
// recoverable: remounting the subtree fixes the common transient cases, and for
// the rest the user still has a readable screen rather than a white void.
//
// Note the limits of React error boundaries -- they do not catch errors thrown
// in event handlers, in async code (promise rejections), or during SSR. Those
// paths still need their own try/catch, which the service layer already does.

interface Props {
  children: React.ReactNode;
  /** Shown above the technical detail. Defaults to a generic apology. */
  message?: string;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // console.error survives the production console-stripping in
    // babel.config.js precisely so failures like this stay visible to a crash
    // reporter. If a reporting SDK is added later, forward it here.
    console.error('[ErrorBoundary] Unhandled render error:', error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.emoji}>🔧</Text>
          <Typography variant="h2" style={styles.title}>Something went wrong</Typography>
          <Typography variant="body" color="#5A6068" style={styles.body}>
            {this.props.message ??
              'MechBazar hit an unexpected problem on this screen. Your account and orders are safe.'}
          </Typography>

          {__DEV__ && (
            <View style={styles.devBox}>
              <Text style={styles.devText}>{error.message}</Text>
            </View>
          )}

          <Button title="Try Again" variant="danger" onPress={this.handleReset} />

          <Typography variant="caption" color="#8E8E93" style={styles.help}>
            If this keeps happening, contact us from Account → Help Center.
          </Typography>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 28 },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { marginBottom: 10, textAlign: 'center' },
  body: { textAlign: 'center', marginBottom: 22 },
  devBox: {
    backgroundColor: '#FDECEA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 22,
    width: '100%',
  },
  devText: { fontSize: 12, color: '#9B1C1C', fontFamily: 'monospace' },
  help: { textAlign: 'center', marginTop: 18 },
});
