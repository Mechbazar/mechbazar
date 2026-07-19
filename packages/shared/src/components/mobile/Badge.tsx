import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { mobileSpacing } from '../../theme/spacing';

interface BadgeProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

export const Badge = ({
  label,
  variant = 'primary',
  size = 'md',
  style,
}: BadgeProps) => {
  const getVariantColor = () => {
    switch (variant) {
      case 'secondary':
        return colors.navy;
      case 'success':
        return colors.success;
      case 'warning':
        return colors.warning;
      case 'danger':
        return colors.danger;
      case 'info':
        return colors.info;
      default:
        return colors.primary;
    }
  };

  const getPadding = () => {
    switch (size) {
      case 'sm':
        return { paddingVertical: 4, paddingHorizontal: 8 };
      case 'lg':
        return { paddingVertical: 8, paddingHorizontal: 12 };
      default:
        return { paddingVertical: 6, paddingHorizontal: 10 };
    }
  };

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: getVariantColor(),
          ...getPadding(),
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            fontSize: size === 'sm' ? 12 : size === 'lg' ? 14 : 13,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
