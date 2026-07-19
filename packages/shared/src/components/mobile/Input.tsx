import React from 'react';
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextInputProps,
} from 'react-native';
import { colors } from '../../theme/colors';
import { radius } from '../../theme/radius';
import { mobileSpacing } from '../../theme/spacing';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  containerStyle?: ViewStyle;
}

export const Input = ({
  label,
  error,
  helperText,
  containerStyle,
  style,
  ...props
}: InputProps) => {
  return (
    <View style={containerStyle}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          {
            borderColor: error ? colors.danger : colors.border,
          },
          style,
        ]}
        placeholderTextColor={colors.textSecondary}
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      {helperText && !error && <Text style={styles.helperText}>{helperText}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: mobileSpacing.sm,
  },
  input: {
    fontSize: 16,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.md,
    borderWidth: 1,
    borderRadius: radius.input,
    backgroundColor: colors.card,
    color: colors.text,
  },
  error: {
    fontSize: 12,
    color: colors.danger,
    marginTop: mobileSpacing.sm,
    fontWeight: '500',
  },
  helperText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: mobileSpacing.sm,
  },
});
