import React from 'react';
import { View, StyleSheet, ViewStyle, Text, TextStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { shadows } from '../../theme/shadows';
import { mobileSpacing } from '../../theme/spacing';

interface CardProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'outlined' | 'filled';
  style?: ViewStyle;
  onPress?: () => void;
}

export const Card = ({ children, variant = 'elevated', style, onPress }: CardProps) => {
  const getVariantStyle = () => {
    switch (variant) {
      case 'outlined':
        return {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        };
      case 'filled':
        return {
          backgroundColor: '#f5f5f5',
          borderWidth: 1,
          borderColor: colors.border,
        };
      default:
        return {
          backgroundColor: colors.card,
          ...shadows.base_mobile,
        };
    }
  };

  return (
    <View
      style={[
        styles.card,
        getVariantStyle(),
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    padding: mobileSpacing.lg,
    marginVertical: mobileSpacing.sm,
    elevation: 2,
  },
});
