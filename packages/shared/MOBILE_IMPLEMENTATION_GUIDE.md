# Mobile Apps Implementation Guide (Admin Mobile, Seller Mobile, Delivery Mobile)

This guide explains how to update React Native apps to use the MechBazar Design System.

## Quick Start

### 1. Ensure Shared Package is Installed
```bash
cd apps/admin-mobile  # or seller-mobile or delivery
npm list @shared
# If not installed: npm install ../../packages/shared
```

### 2. Import Design System
```tsx
import { 
  colors, 
  typography, 
  spacing, 
  radius,
  shadows 
} from '@shared/theme';

import {
  Button,
  Card,
  Input,
  Badge,
  Loader
} from '@shared/components/mobile';
```

---

## Color System

### Using Colors in React Native

```tsx
import { colors } from '@shared/theme';
import { View, Text } from 'react-native';

// Text Color
<Text style={{ color: colors.text }}>Dark text</Text>

// Background Color
<View style={{ backgroundColor: colors.card }}>
  Content
</View>

// Semantic Colors
<Badge label="Success" variant="success" /> // Uses colors.success
<Button title="Delete" variant="danger" />   // Uses colors.danger
```

### Color Palette
```tsx
colors = {
  primary: '#db0000',      // Main brand red
  navy: '#02427a',         // Navy blue
  text: '#222222',         // Dark text
  textSecondary: '#777777', // Gray text
  card: '#ffffff',         // Card background
  background: '#fafafa',   // App background
  border: '#e0e0e0',       // Border color
  success: '#28a745',      // Green
  warning: '#ffc107',      // Yellow
  danger: '#db0000',       // Red
  info: '#17a2b8',         // Blue
}
```

---

## Spacing Scale

### Mobile Spacing
```tsx
import { mobileSpacing } from '@shared/theme';

const styles = StyleSheet.create({
  container: {
    padding: mobileSpacing.lg,    // 16px
    margin: mobileSpacing.md,     // 12px
    gap: mobileSpacing.sm,        // 8px
  },
});

// Spacing values:
xs:   4px
sm:   8px
md:   12px
lg:   16px
xl:   20px
2xl:  24px
3xl:  32px
4xl:  40px
5xl:  48px
6xl:  56px
7xl:  64px
8xl:  80px
```

---

## Components

### 1. Button

```tsx
import { Button } from '@shared/components/mobile';

// Primary button
<Button 
  title="Continue"
  variant="primary"
  size="lg"
  onPress={() => handlePress()}
/>

// Secondary button
<Button 
  title="Cancel"
  variant="secondary"
  onPress={() => handleCancel()}
/>

// Danger button
<Button 
  title="Delete"
  variant="danger"
  size="sm"
  onPress={() => handleDelete()}
/>

// Outline button
<Button 
  title="Learn More"
  variant="outline"
  onPress={() => handleLearn()}
/>

// With loading state
<Button 
  title="Submitting..."
  loading={isLoading}
  disabled={isLoading}
  onPress={() => handleSubmit()}
/>

// Props:
- title: string (button text)
- onPress: () => void (tap handler)
- variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost' | 'success'
- size?: 'sm' | 'md' | 'lg'
- loading?: boolean
- disabled?: boolean
- style?: ViewStyle
```

### 2. Card

```tsx
import { Card } from '@shared/components/mobile';

<Card variant="elevated">
  <Text style={{ color: colors.text }}>Card content</Text>
</Card>

<Card variant="outlined">
  <Text>Outlined card</Text>
</Card>

<Card variant="filled">
  <Text>Filled card</Text>
</Card>

// Props:
- children: React.ReactNode
- variant?: 'elevated' | 'outlined' | 'filled'
- style?: ViewStyle
```

### 3. Input

```tsx
import { Input } from '@shared/components/mobile';

<Input 
  label="Full Name"
  placeholder="Enter your name"
  value={name}
  onChangeText={setName}
/>

<Input 
  label="Email"
  placeholder="email@example.com"
  keyboardType="email-address"
  error={emailError}
/>

<Input 
  label="Phone"
  placeholder="+91 XXXXXXXXXX"
  keyboardType="phone-pad"
  helperText="Include country code"
/>

// Props:
- label?: string
- placeholder?: string
- error?: string
- helperText?: string
- value?: string
- onChangeText?: (text: string) => void
- keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric' | ...
- containerStyle?: ViewStyle
- ... all TextInputProps
```

### 4. Badge

```tsx
import { Badge } from '@shared/components/mobile';

<Badge label="New" variant="primary" />
<Badge label="Active" variant="success" size="md" />
<Badge label="Sale" variant="warning" size="lg" />

// Props:
- label: string
- variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info'
- size?: 'sm' | 'md' | 'lg'
- style?: ViewStyle
```

### 5. Loader

```tsx
import { Loader } from '@shared/components/mobile';

<Loader size="large" color={colors.primary} />
<Loader size="small" />

// Props:
- size?: 'small' | 'large'
- color?: string
- style?: ViewStyle
```

---

## Implementation Examples

### Complete Screen Example

```tsx
// screens/AdminDashboard.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  Card,
  Input,
  Badge,
  Loader,
} from '@shared/components/mobile';
import { colors, spacing, radius } from '@shared/theme';

export default function AdminDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(false);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <Badge label="Online" variant="success" />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Stats Cards */}
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.statsGrid}>
          <Card variant="elevated" style={styles.statCard}>
            <Text style={styles.statLabel}>Orders</Text>
            <Text style={styles.statValue}>1,234</Text>
          </Card>

          <Card variant="elevated" style={styles.statCard}>
            <Text style={styles.statLabel}>Revenue</Text>
            <Text style={styles.statValue}>$45K</Text>
          </Card>
        </View>

        <View style={styles.statsGrid}>
          <Card variant="elevated" style={styles.statCard}>
            <Text style={styles.statLabel}>Customers</Text>
            <Text style={styles.statValue}>892</Text>
          </Card>

          <Card variant="elevated" style={styles.statCard}>
            <Text style={styles.statLabel}>Vendors</Text>
            <Text style={styles.statValue}>45</Text>
          </Card>
        </View>

        {/* Action Buttons */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
          Quick Actions
        </Text>

        <Button 
          title="Add New Vendor"
          variant="primary"
          size="lg"
          onPress={() => console.log('Add vendor')}
          style={{ marginBottom: spacing.md }}
        />

        <Button 
          title="View Orders"
          variant="secondary"
          size="lg"
          onPress={() => console.log('View orders')}
          style={{ marginBottom: spacing.md }}
        />

        <Button 
          title="Settings"
          variant="outline"
          size="lg"
          onPress={() => console.log('Settings')}
        />

        {/* Form Section */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
          Add Product
        </Text>

        <Card variant="outlined" style={{ padding: spacing.lg }}>
          <Input 
            label="Product Name"
            placeholder="Enter product name"
            style={{ marginBottom: spacing.md }}
          />

          <Input 
            label="Price"
            placeholder="Enter price"
            keyboardType="decimal-pad"
            style={{ marginBottom: spacing.md }}
          />

          <Input 
            label="Stock Quantity"
            placeholder="Enter quantity"
            keyboardType="numeric"
          />

          <View style={{ marginTop: spacing.lg }}>
            <Button 
              title="Save Product"
              variant="primary"
              loading={isLoading}
              onPress={() => setIsLoading(true)}
            />
          </View>
        </Card>

        {/* Tabs Section */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
          Analytics
        </Text>

        <View style={styles.tabs}>
          {['Daily', 'Weekly', 'Monthly'].map(tab => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tab,
                selectedTab === tab && styles.tabActive,
              ]}
              onPress={() => setSelectedTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  selectedTab === tab && styles.tabTextActive,
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Card variant="elevated" style={{ marginTop: spacing.md, minHeight: 200 }}>
          <Text style={styles.cardPlaceholder}>
            Chart for {selectedTab}
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    textAlign: 'center',
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#ffffff',
  },
  cardPlaceholder: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
```

### Login Screen Example

```tsx
// screens/Login.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Button, Card, Input, Loader } from '@shared/components/mobile';
import { colors, spacing, radius } from '@shared/theme';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    // Validation
    const newErrors = {};
    if (!email) newErrors.email = 'Email is required';
    if (!password) newErrors.password = 'Password is required';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      // API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      navigation.replace('Dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Logo/Header */}
          <View style={styles.headerContainer}>
            <Text style={styles.logo}>MechBazar</Text>
            <Text style={styles.subtitle}>Admin Portal</Text>
          </View>

          {/* Login Card */}
          <Card variant="elevated" style={styles.card}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.description}>
              Sign in to your account to continue
            </Text>

            {/* Email Input */}
            <Input
              label="Email Address"
              placeholder="admin@mechbazar.com"
              keyboardType="email-address"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setErrors({ ...errors, email: undefined });
              }}
              error={errors.email}
              containerStyle={{ marginBottom: spacing.lg }}
            />

            {/* Password Input */}
            <Input
              label="Password"
              placeholder="Enter your password"
              secureTextEntry
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setErrors({ ...errors, password: undefined });
              }}
              error={errors.password}
              containerStyle={{ marginBottom: spacing.lg }}
            />

            {/* Remember & Forgot */}
            <View style={styles.footerText}>
              <Text style={{ color: colors.textSecondary }}>
                Don't have an account?{' '}
                <Text 
                  style={{ color: colors.primary, fontWeight: '600' }}
                  onPress={() => navigation.navigate('Register')}
                >
                  Sign up
                </Text>
              </Text>
            </View>

            {/* Login Button */}
            <Button
              title="Sign In"
              variant="primary"
              size="lg"
              loading={isLoading}
              disabled={isLoading}
              onPress={handleLogin}
              style={{ marginTop: spacing.lg }}
            />

            {/* Forgot Password */}
            <Text
              style={[styles.forgotPassword]}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              Forgot your password?
            </Text>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logo: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  card: {
    padding: spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  footerText: {
    marginBottom: spacing.md,
  },
  forgotPassword: {
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
```

---

## Navigation Updates

### Update AppNavigator to Use Design System Colors

```tsx
// navigation/AppNavigator.tsx
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '@shared/theme';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.navy,
          },
          headerTintColor: '#ffffff',
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: 18,
          },
          cardStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        <Stack.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{
            title: 'Dashboard',
          }}
        />
        {/* More screens... */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

---

## Common Patterns

### Empty State
```tsx
<Card variant="filled" style={{ alignItems: 'center', paddingVertical: 48 }}>
  <Ionicons name="inbox-outline" size={48} color={colors.textSecondary} />
  <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text, marginTop: 16 }}>
    No Items
  </Text>
  <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
    Create your first item to get started
  </Text>
  <Button
    title="Create Item"
    variant="primary"
    style={{ marginTop: 24 }}
    onPress={handleCreate}
  />
</Card>
```

### Loading State
```tsx
{isLoading ? (
  <Loader size="large" color={colors.primary} />
) : (
  // Content
)}
```

### Error State
```tsx
{error && (
  <Card variant="outlined" style={{ borderLeftWidth: 4, borderLeftColor: colors.danger }}>
    <Text style={{ color: colors.danger, fontWeight: '600' }}>
      {error}
    </Text>
  </Card>
)}
```

---

## Responsive Layout Examples

### Flex Layout
```tsx
<View style={{ flexDirection: 'row', gap: spacing.md }}>
  <View style={{ flex: 1 }}>
    {/* Left column */}
  </View>
  <View style={{ flex: 1 }}>
    {/* Right column */}
  </View>
</View>
```

### Dynamic Grid
```tsx
const columns = width > 600 ? 2 : 1;
<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
  {items.map((item, idx) => (
    <View key={idx} style={{ width: `${100 / columns}%` }}>
      <Card>{/* Item */}</Card>
    </View>
  ))}
</View>
```

---

## Next Steps

1. ✅ Components available in shared package
2. → Import components in screens
3. → Replace inline colors with `colors` from theme
4. → Replace inline spacing with `mobileSpacing`
5. → Update navigation header colors
6. → Test on physical devices (iOS + Android)
7. → Test on tablets (landscape orientation)
8. → Verify touch targets are 44x44px minimum
9. → Test accessibility features (screen readers)
10. → Deploy to staging

---

## Testing Checklist

- [ ] All screens render without errors
- [ ] Buttons are responsive and tappable (44x44px+)
- [ ] Forms validate and display errors
- [ ] Loading states show loader
- [ ] Colors match brand guidelines
- [ ] Text is readable (sufficient contrast)
- [ ] Touch targets have proper spacing
- [ ] Works on iOS and Android
- [ ] Works on portrait and landscape
- [ ] Works on tablets
- [ ] Navigation transitions smoothly
- [ ] Back button works properly

---

**Last Updated**: July 14, 2026
