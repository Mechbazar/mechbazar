import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Easing,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Rect, Defs, LinearGradient, RadialGradient, Stop, Circle, Path, Ellipse, Line } from 'react-native-svg';
import { Logo } from '@mechbazar/shared';

// Not re-exported from '@mechbazar/shared''s flat entry point (only the Logo
// component itself is) -- matches Logo.tsx's own LogoTone definition.
type LogoTone = 'light' | 'dark';
import { loginSuccess } from '../../store/authSlice';
import { API_BASE_URL } from '../../services/api';
import { sendPhoneOtp, confirmPhoneOtp, watchForAutoVerification } from '../../services/phoneAuth';
import { notify } from '../../utils/notify';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { consumePendingRedirect } from '../../navigation/postLoginRedirect';
import { setDesktopFullPageScreenActive } from '../../navigation/desktopFullPageScreenStore';
import Container from '../../components/desktop/shared/Container';
import { spacing, typography, radius, shadows, darkColors, colors as brandColors } from '../../theme/tokens';
import { useIsDarkMode } from '../../theme/useThemeColors';
import { useTranslation } from 'react-i18next';

// Premium light-first palette per the redesign brief, wired through the
// app's real dark-mode system (useIsDarkMode) instead of a fixed theme --
// unlike the old dark-only version of this screen. `primary` stays the
// AA-safe shade (DA3830) for text-bearing fills (buttons/links), while
// `primaryBrand` is the exact spec hex (E53935) for decorative surfaces
// where contrast isn't load-bearing -- the same split tokens.ts documents
// for the rest of the app.
type Palette = {
  bg: string;
  bgTop: string;
  surface: string;
  card: string;
  chipBg: string;
  border: string;
  textPrimary: string;
  textMuted: string;
  primary: string;
  primaryBrand: string;
  danger: string;
  success: string;
  white: string;
};

const LIGHT_PALETTE: Palette = {
  bg: '#F7F8FC',
  bgTop: '#FFFFFF',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  chipBg: '#FFFFFF',
  border: '#E9ECF3',
  textPrimary: '#111111',
  textMuted: brandColors.textMuted,
  primary: brandColors.primary,
  primaryBrand: brandColors.primaryBrand,
  danger: brandColors.danger,
  success: brandColors.accentText,
  white: '#FFFFFF',
};

const DARK_PALETTE: Palette = {
  bg: darkColors.pageBg,
  bgTop: '#1A1D22',
  surface: darkColors.white,
  card: darkColors.white,
  chipBg: darkColors.white,
  border: darkColors.borderLight,
  textPrimary: darkColors.textDark,
  textMuted: darkColors.textMuted,
  primary: darkColors.primary,
  primaryBrand: darkColors.primaryBrand,
  danger: darkColors.danger,
  success: darkColors.accentText,
  white: '#FFFFFF',
};

const CARD_RADIUS = 28;
const INPUT_RADIUS = 20;
const INPUT_HEIGHT = 58;
const BUTTON_HEIGHT = 58;
const BUTTON_RADIUS = 20;
// Caps how wide the stacked mobile column is allowed to grow (tablet
// portrait, foldables) -- below this the layout is just full-width with
// spacing.lg gutters, same as before.
const CONTENT_MAX_WIDTH = 460;

// Subtle gradient page background + a faint automotive outline pinned to
// the very bottom of the screen only -- everything else stays open white
// space per the "premium minimal" brief.
function BackgroundLayer({ colors: c }: { colors: Palette }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg height="100%" width="100%">
        <Defs>
          <LinearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={c.bgTop} />
            <Stop offset="100%" stopColor={c.bg} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#bgGrad)" />
      </Svg>

      <View style={styles_bottomOutline}>
        <Svg width="100%" height="100%" viewBox="0 0 360 90" preserveAspectRatio="xMidYMax slice">
          <Path
            d="M20 70 L45 70 L55 45 L95 30 L180 28 L230 40 L260 55 L300 55 L320 70 L340 70"
            stroke={c.textPrimary}
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx="95" cy="70" r="16" stroke={c.textPrimary} strokeWidth={2.5} fill="none" />
          <Circle cx="260" cy="70" r="16" stroke={c.textPrimary} strokeWidth={2.5} fill="none" />
        </Svg>
      </View>
    </View>
  );
}

const styles_bottomOutline = {
  position: 'absolute' as const,
  bottom: 0,
  left: 0,
  right: 0,
  height: 90,
  opacity: 0.05,
};

// A small "glossy 3D" capsule: circular chip with a soft shadow and a top
// highlight ellipse to fake depth, floating on its own independent loop so
// the hero doesn't move in lockstep. No 3D engine is in this project --
// real-time 3D (three.js/expo-gl) would be a heavy, fragile dependency for
// a login screen's first paint, so depth is faked with layered vector
// shading instead, which is the standard approach premium RN apps use here.
function FloatingChip({
  size,
  colors: c,
  positionStyle,
  duration,
  delay,
  driftY,
  rotateDeg,
  children,
}: {
  size: number;
  colors: Palette;
  positionStyle: any;
  duration: number;
  delay: number;
  driftY: number;
  rotateDeg: number;
  children: React.ReactNode;
}) {
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [duration, delay]);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, driftY] });
  const rotate = float.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${rotateDeg}deg`] });

  return (
    <Animated.View
      style={[
        positionStyle,
        { position: 'absolute', width: size, height: size, transform: [{ translateY }, { rotate }] },
      ]}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: c.chipBg,
          borderWidth: 1,
          borderColor: c.border,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#0B1220',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.14,
          shadowRadius: 12,
          elevation: 6,
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: size * 0.08,
            left: size * 0.16,
            width: size * 0.45,
            height: size * 0.26,
            borderRadius: size * 0.2,
            backgroundColor: '#FFFFFF',
            opacity: 0.5,
          }}
        />
        {children}
      </View>
    </Animated.View>
  );
}

// Hand-drawn: MaterialCommunityIcons has no "spring"/"coil" glyph.
function SpringGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Ellipse cx="12" cy="4" rx="7" ry="2.3" stroke={color} strokeWidth={1.6} fill="none" />
      <Ellipse cx="12" cy="9.3" rx="7" ry="2.3" stroke={color} strokeWidth={1.6} fill="none" />
      <Ellipse cx="12" cy="14.7" rx="7" ry="2.3" stroke={color} strokeWidth={1.6} fill="none" />
      <Ellipse cx="12" cy="20" rx="7" ry="2.3" stroke={color} strokeWidth={1.6} fill="none" />
    </Svg>
  );
}

// Hand-drawn: MaterialCommunityIcons has no "spark plug" glyph.
function SparkPlugGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="9.5" y="1.5" width="5" height="7" rx="1.5" fill="none" stroke={color} strokeWidth={1.5} />
      <Rect x="8" y="8.5" width="8" height="5" rx="1" fill={color} />
      <Path d="M12 13.5 L12 18 M12 18 L12 21 M12 21 L15 21" stroke={color} strokeWidth={1.6} strokeLinecap="round" fill="none" />
      <Circle cx="12" cy="18" r="1" fill={color} />
    </Svg>
  );
}

// The hero: MechBazar mark on a white circular "platform" with a soft glow,
// ringed by six floating automotive object chips. Shared between the mobile
// and desktop layouts below so both stay visually identical.
function HeroStage({ colors: c, logoTone }: { colors: Palette; logoTone: LogoTone }) {
  return (
    <View style={heroStyles.stage}>
      <Svg width={200} height={200} style={heroStyles.glow}>
        <Defs>
          <RadialGradient id="platformGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={c.primaryBrand} stopOpacity={0.16} />
            <Stop offset="100%" stopColor={c.primaryBrand} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={100} cy={100} r={100} fill="url(#platformGlow)" />
      </Svg>

      <View
        style={[
          heroStyles.platform,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        <Logo tone={logoTone} width={62} />
      </View>

      <FloatingChip size={52} colors={c} duration={3200} delay={0} driftY={-10} rotateDeg={-8} positionStyle={{ top: 4, left: '13%' }}>
        <MaterialCommunityIcons name="tire" size={26} color={c.textPrimary} />
      </FloatingChip>

      <FloatingChip size={46} colors={c} duration={3600} delay={300} driftY={12} rotateDeg={10} positionStyle={{ top: 16, right: '9%' }}>
        <MaterialCommunityIcons name="cog" size={24} color={c.primaryBrand} />
      </FloatingChip>

      <FloatingChip size={48} colors={c} duration={4000} delay={600} driftY={-9} rotateDeg={-6} positionStyle={{ bottom: 28, left: '3%' }}>
        <MaterialCommunityIcons name="wrench" size={23} color={c.textPrimary} />
      </FloatingChip>

      <FloatingChip size={44} colors={c} duration={3400} delay={900} driftY={11} rotateDeg={9} positionStyle={{ top: 60, right: '0%' }}>
        <MaterialCommunityIcons name="nut" size={22} color={c.textPrimary} />
      </FloatingChip>

      <FloatingChip size={46} colors={c} duration={3800} delay={450} driftY={-11} rotateDeg={7} positionStyle={{ bottom: 8, right: '19%' }}>
        <SpringGlyph size={24} color={c.primaryBrand} />
      </FloatingChip>

      <FloatingChip size={44} colors={c} duration={3300} delay={750} driftY={10} rotateDeg={-9} positionStyle={{ top: 68, left: '0%' }}>
        <SparkPlugGlyph size={22} color={c.textPrimary} />
      </FloatingChip>
    </View>
  );
}

const heroStyles = StyleSheet.create({
  stage: {
    height: 260,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  glow: { position: 'absolute' },
  platform: {
    width: 116,
    height: 116,
    borderRadius: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#0B1220',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 10,
  },
});

// Wraps an input row with an animated focus glow: border fades from the
// resting border color to brand red, plus a soft matching shadow. `error`
// (validation failure) always wins over the focus color.
function AnimatedInputRow({
  colors: c,
  focusAnim,
  error,
  style,
  children,
}: {
  colors: Palette;
  focusAnim: Animated.Value;
  error?: boolean;
  style?: any;
  children: React.ReactNode;
}) {
  const borderColor = error
    ? c.danger
    : focusAnim.interpolate({ inputRange: [0, 1], outputRange: [c.border, c.primary] });
  const shadowOpacity = error ? 0 : focusAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.14] });

  return (
    <Animated.View
      style={[
        style,
        {
          borderColor,
          shadowColor: c.primary,
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 10,
          shadowOpacity,
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// Full-width red-gradient CTA: press-scale animation, Android ripple, and a
// loading spinner swap-in while an OTP request is in flight.
function GradientButton({
  onPress,
  children,
  disabled,
  isLoading,
  colors: c,
}: {
  onPress: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  isLoading?: boolean;
  colors: Palette;
}) {
  const scaleValue = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleValue, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleValue, { toValue: 1, useNativeDriver: true, speed: 40 }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleValue }], marginTop: spacing.lg }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || isLoading}
        android_ripple={{ color: '#FFFFFF3D' }}
        style={{
          height: BUTTON_HEIGHT,
          borderRadius: BUTTON_RADIUS,
          overflow: 'hidden',
          shadowColor: c.primary,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: disabled ? 0 : 0.28,
          shadowRadius: 18,
          elevation: disabled ? 0 : 6,
        }}
      >
        <View style={StyleSheet.absoluteFill}>
          <Svg height="100%" width="100%">
            <Defs>
              <LinearGradient id="btnGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor={c.primaryBrand} />
                <Stop offset="100%" stopColor={c.primary} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={disabled ? c.border : 'url(#btnGrad)'} rx={BUTTON_RADIUS} ry={BUTTON_RADIUS} />
          </Svg>
        </View>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {isLoading ? <ActivityIndicator color={c.white} size="small" /> : children}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// The API base-URL switcher below is a DEVELOPMENT tool. It used to be
// reachable in every build from a gear icon on the login screen, which meant a
// shipped production app let anyone repoint it at an arbitrary server. That is
// a credential-theft vector, not just untidy: the login flow posts the phone
// number and the Firebase ID token -- the credential the real backend trusts --
// to whatever host is configured, so a single "tap settings and paste this URL"
// social-engineering call would hand an attacker a working session. It is also
// exactly the kind of development/test functionality Apple rejects under
// Guideline 2.1.
//
// __DEV__ is false in any release bundle, so this compiles the entry points out
// of production builds entirely.
const DEV_TOOLS_ENABLED = __DEV__;

// Shared by both the native/mobile-web layout and the desktop layout below
// -- same dev-only API base URL switcher, just rendered from either branch.
function ApiSettingsModal({
  visible, tempBaseUrl, setTempBaseUrl, onSave, onReset, onClose, colors: c,
}: {
  visible: boolean; tempBaseUrl: string; setTempBaseUrl: (v: string) => void;
  onSave: () => void; onReset: () => void; onClose: () => void; colors: Palette;
}) {
  const s = useMemo(() => createStyles(c), [c]);
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <Text style={s.modalTitle}>API Server Configuration</Text>
          <Text style={s.modalDesc}>Change backend API base URL for testing environment updates.</Text>

          <TextInput
            style={s.modalInput}
            value={tempBaseUrl}
            onChangeText={setTempBaseUrl}
            placeholder="http://<IP>:<PORT>/api"
            placeholderTextColor={c.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={s.modalBtnRow}>
            <TouchableOpacity style={s.modalSecondaryBtn} onPress={onReset}>
              <Text style={s.modalSecondaryBtnText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalSecondaryBtn} onPress={onClose}>
              <Text style={s.modalSecondaryBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalPrimaryBtn} onPress={onSave}>
              <Text style={s.modalPrimaryBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Desktop-only login layout (>=1024px). Reuses every piece of state/logic
// from WelcomeScreen unchanged -- send-otp/login/register calls, validation,
// GradientButton -- only the JSX/layout differs from the native/mobile-web
// version below. Split screen (hero left, centered login card right) instead
// of one stacked full-height column, so the form is visible without
// scrolling at 1366x768. Sits under DesktopHeader via
// setDesktopFullPageScreenActive, which also skips the shell's full
// DesktopFooter in favor of the compact one rendered here.
function DesktopWelcomeLayout({
  colors: c, logoTone, mobile, otp, isOtpSent, isLoading, phoneError, resendCooldown, autoVerifiedReady,
  mobileFocusAnim, otpFocusAnim, nameFocusAnim, emailFocusAnim, animateFocus,
  handlePhoneChange, setOtp, handleSendOtp, handleLogin,
  needsRegistration, regName, setRegName, regEmail, setRegEmail, regNameError, setRegNameError,
  handleCompleteRegistration, handleCancelRegistration,
  onOpenSettings, navigation,
}: any) {
  const { t } = useTranslation();
  const s = useMemo(() => createDesktopStyles(c), [c]);
  return (
    <View style={s.page}>
      {/* Development builds only -- see the note on DEV_TOOLS_ENABLED. */}
      {DEV_TOOLS_ENABLED && (
        <Pressable
          style={s.settingsIconBtn}
          onPress={onOpenSettings}
          accessibilityRole="button"
          accessibilityLabel="Developer settings"
        >
          <Ionicons name="settings-outline" size={16} color={c.textMuted} />
        </Pressable>
      )}

      <Container style={s.center}>
        <View style={s.splitRow}>
          <View style={s.leftCol}>
            <HeroStage colors={c} logoTone={logoTone} />
          </View>

          <View style={s.rightCol}>
            <View style={s.card}>
              <View style={s.cardLogoRow}>
                <Logo tone={logoTone} height={22} />
              </View>

              {needsRegistration ? (
                <>
                  <Text style={s.regTitle}>{t('auth.completeProfileTitle')}</Text>
                  <Text style={s.regSubtitle}>{t('auth.completeProfileSubtitle', { mobile })}</Text>

                  <Text style={s.inputLabel}>{t('auth.fullName')}</Text>
                  <AnimatedInputRow colors={c} focusAnim={nameFocusAnim} error={!!regNameError} style={s.inputRow}>
                    <Ionicons name="person-outline" size={17} color={c.textMuted} style={s.inputIcon} />
                    <TextInput
                      style={s.mobileInput}
                      placeholder={t('auth.fullNamePlaceholder')}
                      placeholderTextColor={c.textMuted}
                      value={regName}
                      onChangeText={(v: string) => { setRegName(v); if (regNameError) setRegNameError(''); }}
                      editable={!isLoading}
                      onFocus={() => animateFocus(nameFocusAnim, 1)}
                      onBlur={() => animateFocus(nameFocusAnim, 0)}
                    />
                  </AnimatedInputRow>
                  {!!regNameError && (
                    <View style={s.errorRow}>
                      <Ionicons name="alert-circle" size={13} color={c.danger} />
                      <Text style={s.errorText}>{regNameError}</Text>
                    </View>
                  )}

                  <Text style={[s.inputLabel, { marginTop: spacing.md }]}>{t('auth.emailOptional')}</Text>
                  <AnimatedInputRow colors={c} focusAnim={emailFocusAnim} style={s.inputRow}>
                    <Ionicons name="mail-outline" size={17} color={c.textMuted} style={s.inputIcon} />
                    <TextInput
                      style={s.mobileInput}
                      placeholder={t('auth.emailPlaceholder')}
                      placeholderTextColor={c.textMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={regEmail}
                      onChangeText={setRegEmail}
                      editable={!isLoading}
                      onFocus={() => animateFocus(emailFocusAnim, 1)}
                      onBlur={() => animateFocus(emailFocusAnim, 0)}
                    />
                  </AnimatedInputRow>

                  <GradientButton onPress={handleCompleteRegistration} isLoading={isLoading} colors={c}>
                    <Text style={s.primaryBtnText}>{t('auth.createAccount')}</Text>
                    <Ionicons name="arrow-forward" size={18} color={c.white} />
                  </GradientButton>

                  <Pressable style={s.wholesaleBtn} onPress={handleCancelRegistration} disabled={isLoading}>
                    <Text style={s.wholesaleBtnText}>{t('auth.useDifferentNumber')}</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={s.inputLabel}>{t('auth.mobileNumber')}</Text>
                  <AnimatedInputRow colors={c} focusAnim={mobileFocusAnim} error={!!phoneError} style={s.inputRow}>
                    <View style={s.flagBox}>
                      <Text style={s.flagText}>🇮🇳</Text>
                      <Text style={s.countryCode}>+91</Text>
                      <View style={s.verticalDivider} />
                    </View>
                    <TextInput
                      style={s.mobileInput}
                      placeholder={t('auth.enterMobileNumberPlaceholder')}
                      placeholderTextColor={c.textMuted}
                      keyboardType="numeric"
                      maxLength={10}
                      value={mobile}
                      onChangeText={handlePhoneChange}
                      editable={!isOtpSent && !isLoading}
                      onFocus={() => animateFocus(mobileFocusAnim, 1)}
                      onBlur={() => animateFocus(mobileFocusAnim, 0)}
                    />
                  </AnimatedInputRow>
                  {!!phoneError && (
                    <View style={s.errorRow}>
                      <Ionicons name="alert-circle" size={13} color={c.danger} />
                      <Text style={s.errorText}>{phoneError}</Text>
                    </View>
                  )}

                  {isOtpSent && (
                    <View style={s.otpSection}>
                      {autoVerifiedReady ? (
                        <View style={s.autoVerifiedRow}>
                          <Ionicons name="checkmark-circle" size={18} color={c.success} />
                          <Text style={s.autoVerifiedText}>{t('auth.numberVerifiedAuto')}</Text>
                        </View>
                      ) : (
                        <>
                          <View style={s.otpSectionHeader}>
                            <Text style={s.inputLabel}>{t('auth.enterOtp')}</Text>
                            <Text style={s.sentToText}>{t('auth.sentTo', { mobile })}</Text>
                          </View>
                          <AnimatedInputRow colors={c} focusAnim={otpFocusAnim} style={s.inputRow}>
                            <Ionicons name="lock-closed-outline" size={17} color={c.textMuted} style={{ marginRight: 10 }} />
                            <TextInput
                              style={s.mobileInput}
                              placeholder={t('auth.enterOtpPlaceholder')}
                              placeholderTextColor={c.textMuted}
                              keyboardType="numeric"
                              maxLength={6}
                              value={otp}
                              onChangeText={setOtp}
                              editable={!isLoading}
                              onFocus={() => animateFocus(otpFocusAnim, 1)}
                              onBlur={() => animateFocus(otpFocusAnim, 0)}
                            />
                          </AnimatedInputRow>
                          <TouchableOpacity
                            onPress={() => handleSendOtp(true)}
                            disabled={resendCooldown > 0 || isLoading}
                            style={s.resendBtn}
                          >
                            <Text style={[s.resendText, (resendCooldown > 0 || isLoading) && s.resendTextDisabled]}>
                              {resendCooldown > 0 ? t('auth.resendOtpIn', { seconds: resendCooldown }) : t('auth.resendOtp')}
                            </Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  )}

                  <GradientButton
                    onPress={isOtpSent ? handleLogin : () => handleSendOtp(false)}
                    isLoading={isLoading}
                    disabled={mobile.length < 10}
                    colors={c}
                  >
                    <Text style={s.primaryBtnText}>{isOtpSent ? (autoVerifiedReady ? t('common.continue') : t('auth.verifyAndLogin')) : t('auth.sendOtp')}</Text>
                    <Ionicons name="arrow-forward" size={18} color={c.white} />
                  </GradientButton>

                  <View style={s.securityNote}>
                    <Ionicons name="shield-checkmark-outline" size={14} color={c.textMuted} />
                    <Text style={s.securityNoteText}>{t('auth.secureOtpLogin')}</Text>
                  </View>

                  <Pressable
                    style={s.wholesaleBtn}
                    onPress={() => navigation.navigate('WholesaleRegistration')}
                    accessibilityRole="button"
                  >
                    <Text style={s.wholesaleBtnText}>{t('auth.createWholesaleAccount')}</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </View>
      </Container>

      <View style={s.footer}>
        <Container style={s.footerRow}>
          <Text style={s.footerCopy}>{t('auth.footerCopyright', { year: new Date().getFullYear() })}</Text>
          <View style={s.footerLinks}>
            <Text style={s.footerStatic}>{t('account.legal.privacy')}</Text>
            <Text style={s.footerDot}>•</Text>
            <Text style={s.footerStatic}>{t('auth.terms')}</Text>
            <Text style={s.footerDot}>•</Text>
            <Pressable onPress={() => navigation.navigate('HelpCenter')}>
              <Text style={s.footerLink}>{t('auth.contact')}</Text>
            </Pressable>
          </View>
        </Container>
      </View>
    </View>
  );
}

export default function WelcomeScreen() {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const isDark = useIsDarkMode();
  const c = isDark ? DARK_PALETTE : LIGHT_PALETTE;
  const logoTone: LogoTone = isDark ? 'dark' : 'light';
  const styles = useMemo(() => createStyles(c), [c]);

  // States
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  // Seconds left before a resend is allowed again (0 = allowed). Prevents a
  // user from re-triggering an SMS repeatedly, which is what trips Firebase's
  // per-number TOO_MANY_ATTEMPTS limit.
  const [resendCooldown, setResendCooldown] = useState(0);
  // Synchronous in-flight guard. setIsLoading (which disables the button) only
  // takes effect on the next render, so a fast double-tap can re-enter
  // handleSendOtp before that; this ref flips immediately so the second call
  // bails before it ever reaches Firebase / the backend.
  const sendInFlightRef = useRef(false);
  // A Firebase ID token can reach completeLogin from three places -- the
  // manual code (handleLogin), Android verifying instantly (handleSendOtp),
  // or Android auto-retrieving the SMS while the OTP box is showing
  // (watchForAutoVerification below) -- and the last two can race the manual
  // path. Without this a fast auto-verification could post the same login
  // twice.
  const completingRef = useRef(false);
  // Holds the ID token Android's Firebase SDK produced on its own (instant
  // verification, or SMS auto-retrieval while the OTP box is showing).
  // Deliberately NOT auto-consumed by completeLogin -- see autoVerifiedReady.
  const autoVerifiedTokenRef = useRef<string | null>(null);
  // True once Android has verified the number without the user typing
  // anything. The token above is real and ready, but login only proceeds once
  // the user taps the button themselves -- Android completing this silently
  // in the background is not the same as the user asking to be signed in.
  const [autoVerifiedReady, setAutoVerifiedReady] = useState(false);
  const [activeBaseUrl, setActiveBaseUrl] = useState(API_BASE_URL);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [tempBaseUrl, setTempBaseUrl] = useState(API_BASE_URL);
  const { isDesktopUp } = useBreakpoint();

  // True once /auth/login has come back "User not found" for a
  // Firebase-verified number -- the phone/OTP form is swapped for a short
  // name-capture step instead of silently creating the account as "Customer
  // User" (the old behaviour, which left every new signup's name wrong until
  // they happened to find Edit Profile).
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regNameError, setRegNameError] = useState('');
  // The Firebase ID token that proved phone ownership. Held here (not
  // consumed immediately) so it can be replayed into /auth/register once the
  // user submits their name -- verifyIdToken on the backend is a stateless
  // check, so reusing the same token across the login-then-register calls is
  // safe as long as it hasn't expired.
  const pendingIdTokenRef = useRef<string | null>(null);

  useFocusEffect(React.useCallback(() => {
    setDesktopFullPageScreenActive(true);
    return () => setDesktopFullPageScreenActive(false);
  }, []));

  // Entry animations
  const logoFadeAnim = useRef(new Animated.Value(0)).current;
  const heroSlideAnim = useRef(new Animated.Value(30)).current;
  const inputFadeAnim = useRef(new Animated.Value(0)).current;
  // Border-color/glow animations for each input row (mobile number, OTP,
  // and the name/email pair shown during the name-capture step).
  const mobileFocusAnim = useRef(new Animated.Value(0)).current;
  const otpFocusAnim = useRef(new Animated.Value(0)).current;
  const nameFocusAnim = useRef(new Animated.Value(0)).current;
  const emailFocusAnim = useRef(new Animated.Value(0)).current;

  const animateFocus = (anim: Animated.Value, toValue: number) => {
    Animated.timing(anim, { toValue, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoFadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(heroSlideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.timing(inputFadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]).start();
  }, []);

  // Ticks the resend cooldown down to zero once a send starts it.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => {
      setResendCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  const startResendCooldown = () => setResendCooldown(60);

  const handlePhoneChange = (text: string) => {
    const numeric = text.replace(/[^0-9]/g, '');
    setMobile(numeric);
    if (numeric.length > 0 && numeric.length < 10) {
      setPhoneError(t('auth.phoneErrorExactDigits'));
    } else {
      setPhoneError('');
    }
  };

  // Web-only: send the guest back to whatever protected action they were
  // trying to do (Cart checkout, My Orders, a wishlist toggle, ...) instead
  // of always landing on Home after login. On native this is always a no-op
  // -- Platform.OS is never 'web' there, and consumePendingRedirect is never
  // populated anyway since only App.web.tsx's RequireAuth guard (which native
  // never bundles) calls setPendingRedirect. Returns true if it navigated.
  //
  // Falls back to Home when there's no pending redirect -- guest-first mode
  // means a user can reach this screen (a bare header "Login / Register"
  // click, a direct/refreshed URL, browser back/forward, ...) without ever
  // going through a flow that sets one. Without this fallback a successful
  // login just silently reset the form back to the phone-number step with no
  // navigation at all -- indistinguishable from a failed login even though
  // the user was actually authenticated.
  const redirectAfterLogin = () => {
    if (Platform.OS !== 'web') return false;
    const pending = consumePendingRedirect();
    if (pending) {
      navigation.navigate(pending.screen, pending.params);
    } else {
      navigation.navigate('MainTabs', { screen: 'Home' });
    }
    return true;
  };

  // Everything after Firebase is happy: swap the ID token for a MechBazar
  // session. Shared by all three ways an ID token can arrive (manual code,
  // instant auto-verification, or late auto-verification while the OTP box
  // is showing) -- they differ only in how the token was obtained.
  const completeLogin = async (idToken: string) => {
    if (completingRef.current) return;
    completingRef.current = true;
    setIsOtpSent(false);
    setIsLoading(true);
    try {
      const res = await fetch(`${activeBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: mobile, otp: idToken })
      });

      const data = await res.json();

      if (res.status === 401 && data.error?.includes('User not found')) {
        // No account for this number yet -- hold the verified token and ask
        // for a name instead of registering silently as "Customer User".
        pendingIdTokenRef.current = idToken;
        setNeedsRegistration(true);
        return;
      }

      if (res.ok) {
        dispatch(loginSuccess({
          user: data.user,
          token: data.token
        }));
        redirectAfterLogin();
      } else {
        notify('Authentication Failed', data.error || 'Authentication failed');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      notify('Network Error', `Failed to authenticate: ${message}`);
    } finally {
      completingRef.current = false;
      setIsLoading(false);
    }
  };

  // Submits the name (and optional email) the user just typed together with
  // the Firebase token already proven in completeLogin, finishing the
  // registration that step deferred.
  const handleCompleteRegistration = async () => {
    const trimmedName = regName.trim();
    if (trimmedName.length < 2) {
      setRegNameError(t('auth.nameRequiredError'));
      return;
    }
    if (!pendingIdTokenRef.current) {
      // Token expired or was cleared (e.g. app backgrounded a long time) --
      // there is nothing to replay, so send the user back to re-verify.
      notify('Session Expired', 'Please verify your mobile number again.');
      setNeedsRegistration(false);
      return;
    }
    setRegNameError('');
    setIsLoading(true);
    try {
      const res = await fetch(`${activeBaseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: mobile,
          otp: pendingIdTokenRef.current,
          name: trimmedName,
          email: regEmail.trim() || undefined,
          accountType: 'RETAIL',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        pendingIdTokenRef.current = null;
        dispatch(loginSuccess({ user: data.user, token: data.token }));
        redirectAfterLogin();
      } else {
        notify('Registration Failed', data.error || 'Failed to create your account.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      notify('Network Error', `Failed to create your account: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Lets the user back out of the name-capture step to re-enter a different
  // number rather than being stuck if they mistyped it.
  const handleCancelRegistration = () => {
    pendingIdTokenRef.current = null;
    setNeedsRegistration(false);
    setRegName('');
    setRegEmail('');
    setRegNameError('');
    setMobile('');
    setOtp('');
    setIsOtpSent(false);
    setAutoVerifiedReady(false);
  };

  // Covers the auto-verification that arrives LATE: the SMS lands a few
  // seconds after "Send OTP" and Play services reads it while this screen is
  // still showing the code box. That signs the user in and spends the
  // session, so anything typed afterwards comes back as auth/session-expired.
  // Watching the auth state turns that into a successful login instead. See
  // services/phoneAuth.ts for the full explanation.
  useEffect(() => {
    if (!isOtpSent) return;
    if (mobile.length !== 10) return;
    return watchForAutoVerification(mobile, (idToken) => {
      // Hold the token and ask the user to confirm rather than logging them
      // in the moment Android finishes -- see autoVerifiedTokenRef.
      autoVerifiedTokenRef.current = idToken;
      setAutoVerifiedReady(true);
    });
  }, [isOtpSent, mobile]);

  const handleSendOtp = async (isResend = false) => {
    if (mobile.length < 10) {
      setPhoneError(t('auth.phoneErrorValid10Digit'));
      return;
    }
    // A resend is only allowed once the 60s cooldown has elapsed.
    if (isResend && resendCooldown > 0) return;
    // Reject a duplicate in-flight send synchronously (see sendInFlightRef).
    if (sendInFlightRef.current) return;
    sendInFlightRef.current = true;

    // Timestamped so duplicate/rapid sends are identifiable in client logs.
    console.log(`[otp] ${new Date().toISOString()} send requested (resend=${isResend})`);
    setIsLoading(true);
    setPhoneError('');
    autoVerifiedTokenRef.current = null;
    setAutoVerifiedReady(false);

    // Firebase Phone Auth sends the SMS itself as part of signInWithPhoneNumber
    // and, once confirmed in handleLogin, yields an ID token the backend
    // verifies. This is the only OTP path -- there is no backend send-otp
    // fallback (see apps/backend/src/utils/otp.ts).
    try {
      const result = await sendPhoneOtp(mobile);
      setIsLoading(false);
      // ...unless Android verified the number instantly, in which case no SMS
      // was ever sent. That used to log the user straight in with no
      // confirmation step at all; now it holds the token and shows a
      // "verified -- tap to continue" state instead (autoVerifiedTokenRef).
      if (result.autoVerified && result.idToken) {
        autoVerifiedTokenRef.current = result.idToken;
        setAutoVerifiedReady(true);
        setIsOtpSent(true);
        return;
      }
      setIsOtpSent(true);
      startResendCooldown();
      notify('OTP Sent', 'An OTP has been sent to your phone.');
    } catch (err) {
      setIsLoading(false);
      const message = err instanceof Error ? err.message : String(err);
      // notify() works on web (Alert.alert is a no-op there); also mirror the
      // failure inline so it is visible even if a browser blocks window.alert.
      setPhoneError(message || 'Failed to send OTP.');
      notify('Error', message || 'Failed to send OTP.');
    } finally {
      sendInFlightRef.current = false;
    }
  };

  const handleLogin = async () => {
    // Android already produced a valid token (see autoVerifiedTokenRef) --
    // there is no code to confirm, just the user's explicit go-ahead.
    if (autoVerifiedTokenRef.current) {
      const token = autoVerifiedTokenRef.current;
      autoVerifiedTokenRef.current = null;
      setAutoVerifiedReady(false);
      await completeLogin(token);
      return;
    }

    if (otp.length < 6) {
      notify('Validation Error', 'Please enter a valid 6-digit OTP.');
      return;
    }

    setIsLoading(true);
    // `otp` (the code the user typed) confirms the pending Firebase
    // phone-auth request and yields an ID token; that token -- not the raw
    // code -- is what the backend verifies (verifyOtpAndResolvePhone). A
    // failure here is a wrong/expired code, distinct from the network/backend
    // errors completeLogin handles.
    let idToken: string;
    try {
      idToken = await confirmPhoneOtp(otp, mobile);
    } catch (err) {
      setIsLoading(false);
      const message = err instanceof Error ? err.message : String(err);
      notify('Authentication Failed', message || 'The OTP you entered is incorrect or has expired.');
      return;
    }

    // Leaves `isLoading` set: completeLogin owns it from here.
    await completeLogin(idToken);
  };

  const saveSettings = () => {
    setActiveBaseUrl(tempBaseUrl);
    setIsSettingsVisible(false);
    notify('Settings Updated', `API base URL set to:\n${tempBaseUrl}`);
  };

  const resetSettings = () => {
    setTempBaseUrl(API_BASE_URL);
    setActiveBaseUrl(API_BASE_URL);
    setIsSettingsVisible(false);
    notify('Settings Reset', `API base URL reset to default:\n${API_BASE_URL}`);
  };

  const openSettings = () => {
    setTempBaseUrl(activeBaseUrl);
    setIsSettingsVisible(true);
  };

  if (isDesktopUp) {
    return (
      <>
        <DesktopWelcomeLayout
          colors={c}
          logoTone={logoTone}
          mobile={mobile}
          otp={otp}
          isOtpSent={isOtpSent}
          isLoading={isLoading}
          phoneError={phoneError}
          resendCooldown={resendCooldown}
          autoVerifiedReady={autoVerifiedReady}
          mobileFocusAnim={mobileFocusAnim}
          otpFocusAnim={otpFocusAnim}
          nameFocusAnim={nameFocusAnim}
          emailFocusAnim={emailFocusAnim}
          animateFocus={animateFocus}
          handlePhoneChange={handlePhoneChange}
          setOtp={setOtp}
          handleSendOtp={handleSendOtp}
          handleLogin={handleLogin}
          needsRegistration={needsRegistration}
          regName={regName}
          setRegName={setRegName}
          regEmail={regEmail}
          setRegEmail={setRegEmail}
          regNameError={regNameError}
          setRegNameError={setRegNameError}
          handleCompleteRegistration={handleCompleteRegistration}
          handleCancelRegistration={handleCancelRegistration}
          navigation={navigation}
          onOpenSettings={openSettings}
        />
        <ApiSettingsModal
          visible={isSettingsVisible}
          tempBaseUrl={tempBaseUrl}
          setTempBaseUrl={setTempBaseUrl}
          onSave={saveSettings}
          onReset={resetSettings}
          onClose={() => setIsSettingsVisible(false)}
          colors={c}
        />
      </>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <BackgroundLayer colors={c} />

      <View style={styles.topHeader}>
        {/* Development builds only -- see the note on DEV_TOOLS_ENABLED. */}
        {DEV_TOOLS_ENABLED && (
          <TouchableOpacity style={styles.settingsIconBtn} onPress={openSettings} activeOpacity={0.7}>
            <Ionicons name="settings-outline" size={18} color={c.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.mainContent}>
            <Animated.View style={{ opacity: logoFadeAnim, transform: [{ translateY: heroSlideAnim }] }}>
              <HeroStage colors={c} logoTone={logoTone} />
            </Animated.View>

            <Animated.View style={[styles.authContainer, { opacity: inputFadeAnim }]}>
              <View style={styles.cardLogoRow}>
                <Logo tone={logoTone} height={22} />
              </View>

              {needsRegistration ? (
                <>
                  <Text style={styles.regTitle}>{t('auth.completeProfileTitle')}</Text>
                  <Text style={styles.regSubtitle}>{t('auth.completeProfileSubtitle', { mobile })}</Text>

                  <Text style={styles.inputLabel}>{t('auth.fullName')}</Text>
                  <AnimatedInputRow colors={c} focusAnim={nameFocusAnim} error={!!regNameError} style={styles.inputRow}>
                    <Ionicons name="person-outline" size={18} color={c.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.mobileInput}
                      placeholder={t('auth.fullNamePlaceholder')}
                      placeholderTextColor={c.textMuted}
                      value={regName}
                      onChangeText={(v) => { setRegName(v); if (regNameError) setRegNameError(''); }}
                      editable={!isLoading}
                      autoFocus={true}
                      onFocus={() => animateFocus(nameFocusAnim, 1)}
                      onBlur={() => animateFocus(nameFocusAnim, 0)}
                    />
                  </AnimatedInputRow>
                  {!!regNameError && (
                    <View style={styles.errorRow}>
                      <Ionicons name="alert-circle" size={13} color={c.danger} />
                      <Text style={styles.errorText}>{regNameError}</Text>
                    </View>
                  )}

                  <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>{t('auth.emailOptional')}</Text>
                  <AnimatedInputRow colors={c} focusAnim={emailFocusAnim} style={styles.inputRow}>
                    <Ionicons name="mail-outline" size={18} color={c.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.mobileInput}
                      placeholder={t('auth.emailPlaceholder')}
                      placeholderTextColor={c.textMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={regEmail}
                      onChangeText={setRegEmail}
                      editable={!isLoading}
                      onFocus={() => animateFocus(emailFocusAnim, 1)}
                      onBlur={() => animateFocus(emailFocusAnim, 0)}
                    />
                  </AnimatedInputRow>

                  <GradientButton onPress={handleCompleteRegistration} isLoading={isLoading} colors={c}>
                    <Text style={styles.primaryBtnText}>{t('auth.createAccount')}</Text>
                    <Ionicons name="arrow-forward" size={18} color={c.white} />
                  </GradientButton>

                  <TouchableOpacity onPress={handleCancelRegistration} disabled={isLoading} style={styles.regCancelBtn}>
                    <Text style={styles.regCancelText}>{t('auth.useDifferentNumber')}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.inputLabel}>{t('auth.mobileNumber')}</Text>
                  <AnimatedInputRow colors={c} focusAnim={mobileFocusAnim} error={!!phoneError} style={styles.inputRow}>
                    <View style={styles.flagBox}>
                      <Text style={styles.flagText}>🇮🇳</Text>
                      <Text style={styles.countryCode}>+91</Text>
                      <View style={styles.verticalDivider} />
                    </View>
                    <TextInput
                      style={styles.mobileInput}
                      placeholder={t('auth.enterMobileNumberPlaceholder')}
                      placeholderTextColor={c.textMuted}
                      keyboardType="numeric"
                      maxLength={10}
                      value={mobile}
                      onChangeText={handlePhoneChange}
                      editable={!isOtpSent && !isLoading}
                      autoFocus={true}
                      onFocus={() => animateFocus(mobileFocusAnim, 1)}
                      onBlur={() => animateFocus(mobileFocusAnim, 0)}
                    />
                  </AnimatedInputRow>
                  {!!phoneError && (
                    <View style={styles.errorRow}>
                      <Ionicons name="alert-circle" size={13} color={c.danger} />
                      <Text style={styles.errorText}>{phoneError}</Text>
                    </View>
                  )}

                  {isOtpSent && (
                    <View style={styles.otpSection}>
                      {autoVerifiedReady ? (
                        <View style={styles.autoVerifiedRow}>
                          <Ionicons name="checkmark-circle" size={18} color={c.success} />
                          <Text style={styles.autoVerifiedText}>{t('auth.numberVerifiedAuto')}</Text>
                        </View>
                      ) : (
                        <>
                          <View style={styles.otpSectionHeader}>
                            <Text style={styles.inputLabel}>{t('auth.enterOtp')}</Text>
                            <Text style={styles.sentToText}>{t('auth.sentTo', { mobile })}</Text>
                          </View>
                          <AnimatedInputRow colors={c} focusAnim={otpFocusAnim} style={styles.otpInputRow}>
                            <Ionicons name="lock-closed-outline" size={20} color={c.textMuted} style={styles.inputIcon} />
                            <TextInput
                              style={styles.otpInput}
                              placeholder={t('auth.enterOtpPlaceholder')}
                              placeholderTextColor={c.textMuted}
                              keyboardType="numeric"
                              maxLength={6}
                              value={otp}
                              onChangeText={setOtp}
                              editable={!isLoading}
                              autoFocus={true}
                              onFocus={() => animateFocus(otpFocusAnim, 1)}
                              onBlur={() => animateFocus(otpFocusAnim, 0)}
                            />
                          </AnimatedInputRow>
                          <TouchableOpacity
                            onPress={() => handleSendOtp(true)}
                            disabled={resendCooldown > 0 || isLoading}
                            style={styles.resendBtn}
                          >
                            <Text style={[styles.resendText, (resendCooldown > 0 || isLoading) && styles.resendTextDisabled]}>
                              {resendCooldown > 0 ? t('auth.resendOtpIn', { seconds: resendCooldown }) : t('auth.resendOtp')}
                            </Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  )}

                  <GradientButton
                    onPress={isOtpSent ? handleLogin : () => handleSendOtp(false)}
                    isLoading={isLoading}
                    disabled={mobile.length < 10}
                    colors={c}
                  >
                    <Text style={styles.primaryBtnText}>
                      {isOtpSent ? (autoVerifiedReady ? t('common.continue') : t('auth.verifyAndLogin')) : t('auth.sendOtp')}
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color={c.white} />
                  </GradientButton>

                  <View style={styles.securityNote}>
                    <Ionicons name="shield-checkmark-outline" size={14} color={c.textMuted} />
                    <Text style={styles.securityNoteText}>{t('auth.secureOtpLogin')}</Text>
                  </View>
                </>
              )}
            </Animated.View>
          </View>

          <View style={styles.footerContainer}>
            <TouchableOpacity onPress={() => navigation.navigate('WholesaleRegistration')} activeOpacity={0.7}>
              <Text style={styles.linkText}>{t('auth.createWholesaleAccount')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ApiSettingsModal
        visible={isSettingsVisible}
        tempBaseUrl={tempBaseUrl}
        setTempBaseUrl={setTempBaseUrl}
        onSave={saveSettings}
        onReset={resetSettings}
        onClose={() => setIsSettingsVisible(false)}
        colors={c}
      />
    </SafeAreaView>
  );
}

function createStyles(c: Palette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    topHeader: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      zIndex: 10,
    },
    settingsIconBtn: {
      padding: spacing.sm,
      backgroundColor: c.surface,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.border,
    },
    keyboardContainer: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.lg,
    },
    mainContent: {
      width: '100%',
      maxWidth: CONTENT_MAX_WIDTH,
      alignSelf: 'center',
    },
    authContainer: {
      backgroundColor: c.card,
      borderRadius: CARD_RADIUS,
      padding: spacing.lg,
      marginTop: spacing.lg,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: '#0B1220',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.08,
      shadowRadius: 40,
      elevation: 8,
    },
    cardLogoRow: {
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    regTitle: {
      ...typography.h4,
      color: c.textPrimary,
      textAlign: 'center',
      marginBottom: spacing.xs,
    },
    regSubtitle: {
      ...typography.bodySmall,
      color: c.textMuted,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    regCancelBtn: {
      alignSelf: 'center',
      marginTop: spacing.md,
      paddingVertical: 4,
    },
    regCancelText: {
      color: c.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    inputLabel: {
      ...typography.bodySmall,
      fontWeight: '600',
      color: c.textPrimary,
      marginBottom: spacing.sm,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.bg,
      borderRadius: INPUT_RADIUS,
      borderWidth: 1.5,
      paddingHorizontal: spacing.sm + 4,
      height: INPUT_HEIGHT,
      marginBottom: spacing.xs,
    },
    flagBox: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    flagText: {
      fontSize: 18,
    },
    countryCode: {
      fontSize: 15,
      fontWeight: '700',
      color: c.textPrimary,
      marginLeft: spacing.xs + 2,
    },
    verticalDivider: {
      width: 1,
      height: 22,
      backgroundColor: c.border,
      marginHorizontal: spacing.sm,
    },
    mobileInput: {
      flex: 1,
      fontSize: 16,
      color: c.textPrimary,
      height: '100%',
    },
    errorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: spacing.xs,
      marginBottom: spacing.xs,
    },
    errorText: {
      ...typography.caption,
      color: c.danger,
    },
    otpSection: {
      marginTop: spacing.md,
    },
    otpSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    sentToText: {
      ...typography.caption,
      color: c.textMuted,
    },
    autoVerifiedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.bg,
      borderRadius: INPUT_RADIUS,
      paddingHorizontal: spacing.sm + 4,
      paddingVertical: spacing.sm + 4,
    },
    autoVerifiedText: {
      ...typography.bodySmall,
      color: c.textPrimary,
      flex: 1,
    },
    resendBtn: {
      alignSelf: 'flex-end',
      marginTop: spacing.sm,
      paddingVertical: 4,
    },
    resendText: {
      color: c.primary,
      fontSize: 13,
      fontWeight: '700',
    },
    resendTextDisabled: {
      color: c.textMuted,
    },
    otpInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.bg,
      borderRadius: INPUT_RADIUS,
      borderWidth: 1.5,
      paddingHorizontal: spacing.sm + 4,
      height: INPUT_HEIGHT,
    },
    inputIcon: {
      marginRight: spacing.sm,
    },
    otpInput: {
      flex: 1,
      fontSize: 16,
      letterSpacing: 2,
      color: c.textPrimary,
      height: '100%',
    },
    primaryBtnText: {
      ...typography.button,
      color: c.white,
      textTransform: 'uppercase',
      letterSpacing: 0.75,
    },
    securityNote: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: spacing.md,
    },
    securityNoteText: {
      fontSize: 12,
      fontWeight: '600',
      color: c.textMuted,
    },
    footerContainer: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
    },
    linkText: {
      color: c.primary,
      fontSize: 13,
      fontWeight: '700',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: '#00000066',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    modalCard: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: c.card,
      borderRadius: CARD_RADIUS,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: c.border,
      ...shadows.lg,
    },
    modalTitle: {
      ...typography.h4,
      color: c.textPrimary,
      marginBottom: spacing.xs,
    },
    modalDesc: {
      ...typography.bodySmall,
      color: c.textMuted,
      marginBottom: spacing.lg,
    },
    modalInput: {
      backgroundColor: c.bg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      color: c.textPrimary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 4,
      fontSize: 15,
      marginBottom: spacing.lg,
    },
    modalBtnRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    modalSecondaryBtn: {
      paddingHorizontal: spacing.sm + 6,
      paddingVertical: spacing.sm + 2,
      marginRight: spacing.sm,
    },
    modalSecondaryBtnText: {
      color: c.textMuted,
      fontSize: 14,
      fontWeight: '600',
    },
    modalPrimaryBtn: {
      backgroundColor: c.primary,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
    },
    modalPrimaryBtnText: {
      color: c.white,
      fontSize: 14,
      fontWeight: '700',
    }
  });
}

// Desktop-only (>=1024px, see DesktopWelcomeLayout above). Same palette (`c`)
// as the native screen -- this is a layout change, not a re-theme.
function createDesktopStyles(c: Palette) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: c.bg },
    settingsIconBtn: {
      position: 'absolute' as any,
      top: spacing.md,
      right: spacing.md,
      zIndex: 10,
      padding: spacing.sm,
      backgroundColor: c.surface,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.border,
    },
    center: { flex: 1, justifyContent: 'center', paddingVertical: spacing.xl },
    splitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xxl,
    },
    leftCol: { flex: 1, alignItems: 'center' },
    rightCol: { width: 460, maxWidth: 460, flexShrink: 0 },
    card: {
      backgroundColor: c.card,
      borderRadius: CARD_RADIUS,
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: '#0B1220',
      shadowOffset: { width: 0, height: 24 },
      shadowOpacity: 0.08,
      shadowRadius: 48,
      elevation: 10,
    },
    cardLogoRow: { alignItems: 'center', marginBottom: spacing.lg },
    regTitle: { ...typography.h4, color: c.textPrimary, textAlign: 'center', marginBottom: spacing.xs },
    regSubtitle: { ...typography.bodySmall, color: c.textMuted, textAlign: 'center', marginBottom: spacing.lg },
    regCancelBtn: { alignSelf: 'center', marginTop: spacing.md, paddingVertical: 4 },
    regCancelText: { color: c.textMuted, fontSize: 13, fontWeight: '600' },
    inputLabel: { ...typography.bodySmall, fontWeight: '600', color: c.textPrimary, marginBottom: spacing.sm },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.bg,
      borderRadius: INPUT_RADIUS,
      borderWidth: 1.5,
      paddingHorizontal: spacing.sm + 4,
      height: INPUT_HEIGHT,
    },
    flagBox: { flexDirection: 'row', alignItems: 'center' },
    flagText: { fontSize: 17 },
    countryCode: { fontSize: 15, fontWeight: '700', color: c.textPrimary, marginLeft: spacing.xs + 2 },
    verticalDivider: { width: 1, height: 22, backgroundColor: c.border, marginHorizontal: spacing.sm },
    inputIcon: { marginRight: spacing.sm },
    mobileInput: { flex: 1, fontSize: 15, color: c.textPrimary, outlineStyle: 'none' as any },
    errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs },
    errorText: { ...typography.caption, color: c.danger },
    otpSection: { marginTop: spacing.md },
    otpSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    sentToText: { ...typography.caption, color: c.textMuted },
    autoVerifiedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.bg,
      borderRadius: INPUT_RADIUS,
      paddingHorizontal: spacing.sm + 4,
      paddingVertical: spacing.sm + 4,
    },
    autoVerifiedText: { ...typography.bodySmall, color: c.textPrimary, flex: 1 },
    resendBtn: { alignSelf: 'flex-end', marginTop: spacing.sm, paddingVertical: 4 },
    resendText: { color: c.primary, fontSize: 13, fontWeight: '700' },
    resendTextDisabled: { color: c.textMuted },
    primaryBtnText: {
      ...typography.button,
      color: c.white,
      textTransform: 'uppercase',
      letterSpacing: 0.75,
    },
    securityNote: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: spacing.md,
    },
    securityNoteText: { fontSize: 12, fontWeight: '600', color: c.textMuted },
    wholesaleBtn: {
      marginTop: spacing.md,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    wholesaleBtnText: { color: c.textMuted, fontSize: 13, fontWeight: '700' },
    footer: { borderTopWidth: 1, borderTopColor: c.border },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    footerCopy: { color: c.textMuted, fontSize: 12 },
    footerLinks: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    footerStatic: { color: c.textMuted, fontSize: 12 },
    footerLink: { color: c.primary, fontSize: 12, fontWeight: '700' },
    footerDot: { color: c.border, fontSize: 12 },
  });
}
