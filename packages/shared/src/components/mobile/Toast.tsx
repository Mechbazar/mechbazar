import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { mobileSpacing } from '../../theme/spacing';

interface ToastProps {
  visible: boolean;
  message: string;
  variant?: 'success' | 'info' | 'danger';
  onHide: () => void;
  duration?: number;
  style?: ViewStyle;
}

// Minimal in-app banner — the RN equivalent of the web admin panel's
// react-hot-toast "New Order Received!" notification (packages/shared has no
// toast library dependency anywhere, so this is a small self-contained one
// rather than pulling in a new package for a single use case).
export const Toast = ({ visible, message, variant = 'success', onHide, duration = 4000, style }: ToastProps) => {
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (!visible) return;

    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      damping: 16,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }).start(() => onHide());
    }, duration);

    return () => clearTimeout(timer);
  }, [visible, message]);

  if (!visible) return null;

  const getBackgroundColor = () => {
    switch (variant) {
      case 'danger':
        return colors.danger;
      case 'info':
        return colors.info;
      default:
        return colors.success;
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: getBackgroundColor(), transform: [{ translateY }] },
        style,
      ]}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: mobileSpacing.lg,
    right: mobileSpacing.lg,
    borderRadius: radius.card,
    paddingVertical: mobileSpacing.md,
    paddingHorizontal: mobileSpacing.lg,
    zIndex: 999,
    elevation: 10,
  },
  text: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
});
