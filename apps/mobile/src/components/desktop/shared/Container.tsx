import React from 'react';
import { View, StyleSheet } from 'react-native';
import { maxContentWidth, spacing } from '../../../theme/tokens';

// Centered max-width wrapper used by every desktop-only section (header,
// footer, and later hero/grid/product content) so they all line up on the
// same horizontal edges regardless of viewport width.
export default function Container({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.container, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: maxContentWidth,
    marginLeft: 'auto' as any,
    marginRight: 'auto' as any,
    paddingHorizontal: spacing.lg,
  },
});
