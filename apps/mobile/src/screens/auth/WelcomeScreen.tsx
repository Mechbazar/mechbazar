import React, { useState, useEffect, useRef } from 'react';
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
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect, Defs, LinearGradient, Stop, Circle, Path, G } from 'react-native-svg';
import { Logo } from '@mechbazar/shared';
import { loginSuccess } from '../../store/authSlice';
import { API_BASE_URL } from '../../services/api';
import { sendPhoneOtp, confirmPhoneOtp } from '../../services/phoneAuth';
import { notify } from '../../utils/notify';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { setDesktopFullPageScreenActive } from '../../navigation/desktopFullPageScreenStore';
import Container from '../../components/desktop/shared/Container';
import { spacing, typography, radius, shadows, darkColors, colors as brandColors } from '../../theme/tokens';

const { width } = Dimensions.get('window');

// Deliberately a fixed dark theme regardless of the device's light/dark
// preference -- this is the pre-login brand moment, not the app's normal
// (light) content theme, so it does not read from useThemeColors(). Values
// are sourced from theme/tokens.ts's `darkColors` (the design system's own
// dark palette -- surfaces invert, brand hues are lifted for AA contrast
// against dark backgrounds) rather than invented locally, so this screen
// and the desktop layout below share one definition of "the app's dark
// surface colours" instead of two.
const colors = {
  bg: darkColors.pageBg, // '#121212'
  surface: darkColors.white, // '#1E1E1E' -- card/elevated-surface colour in dark mode
  surfaceRaised: '#242C35', // one step brighter than `surface`, for the OTP card once it's the focused step
  border: darkColors.borderLight, // '#2E2E2E'
  borderFocus: darkColors.primary,
  // Button fills use the canonical brand red (same hex as the rest of the
  // app, e.g. GarageScreen/EditProfileScreen) since a solid-fill CTA needs
  // white-on-red contrast, not dark-surface text contrast.
  primary: brandColors.primary, // '#DA3830'
  primaryLight: '#FF573C',
  // Text/link colour on the dark surfaces below uses the dark-mode-tuned red
  // (lifted for AA contrast against near-black, per tokens.ts's own rationale).
  primaryOnDark: darkColors.primary, // '#FF5A4E'
  white: '#FFFFFF',
  textPrimary: darkColors.textDark, // '#F1F2F4'
  textMuted: darkColors.textMuted, // '#A6ACB5'
  danger: darkColors.danger, // '#FF6B6B'
};

const SvgBackground = ({ gearRotation, floatAnim }: any) => (
  <View style={StyleSheet.absoluteFill}>
    <Svg height="100%" width="100%">
      <Defs>
        <LinearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#1A1D22" />
          <Stop offset="100%" stopColor={colors.bg} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#bgGrad)" />
    </Svg>

    {/* Subtle animated floating gear background overlay */}
    <Animated.View style={[
      styles.animatedGear,
      {
        transform: [
          {
            rotate: gearRotation.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '360deg']
            })
          }
        ]
      }
    ]}>
      <Svg height="120" width="120" viewBox="0 0 100 100" opacity="0.04">
        <Circle cx="50" cy="50" r="30" stroke="#FFFFFF" strokeWidth="4" fill="none" />
        <Path d="M 50 10 L 50 20 M 50 80 L 50 90 M 10 50 L 20 50 M 80 50 L 90 50 M 22 22 L 29 29 M 71 71 L 78 78 M 22 78 L 29 71 M 71 22 L 78 29" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
      </Svg>
    </Animated.View>

    {/* Subtle animated floating bike background outline overlay */}
    <Animated.View style={[
      styles.animatedBike,
      {
        transform: [
          {
            translateY: floatAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 12]
            })
          }
        ]
      }
    ]}>
      <Svg height="100" width="150" viewBox="0 0 100 60" opacity="0.03">
        <Path d="M 15,35 L 45,15 L 65,35 L 45,50 L 20,45 Z" fill="none" stroke="#FFFFFF" strokeWidth="2" />
        <Circle cx="15" cy="45" r="12" fill="none" stroke="#FFFFFF" strokeWidth="2" />
        <Circle cx="70" cy="45" r="12" fill="none" stroke="#FFFFFF" strokeWidth="2" />
      </Svg>
    </Animated.View>
  </View>
);

const GradientButton = ({ onPress, children, disabled, isLoading }: any) => {
  const scaleValue = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 0.97,
      useNativeDriver: true
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || isLoading}
        activeOpacity={0.85}
        style={styles.gradientBtnContainer}
      >
        <View style={StyleSheet.absoluteFill}>
          <Svg height="100%" width="100%">
            <Defs>
              <LinearGradient id="btnGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor={colors.primaryLight} />
                <Stop offset="100%" stopColor={colors.primary} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={disabled ? "#4A5562" : "url(#btnGrad)"} rx={radius.md} ry={radius.md} />
          </Svg>
        </View>
        <View style={styles.btnContent}>
          {isLoading ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            children
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

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
const ApiSettingsModal = ({
  visible, tempBaseUrl, setTempBaseUrl, onSave, onReset, onClose,
}: {
  visible: boolean; tempBaseUrl: string; setTempBaseUrl: (v: string) => void;
  onSave: () => void; onReset: () => void; onClose: () => void;
}) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalCard}>
        <Text style={styles.modalTitle}>API Server Configuration</Text>
        <Text style={styles.modalDesc}>Change backend API base URL for testing environment updates.</Text>

        <TextInput
          style={styles.modalInput}
          value={tempBaseUrl}
          onChangeText={setTempBaseUrl}
          placeholder="http://<IP>:<PORT>/api"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.modalBtnRow}>
          <TouchableOpacity style={styles.modalSecondaryBtn} onPress={onReset}>
            <Text style={styles.modalSecondaryBtnText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalSecondaryBtn} onPress={onClose}>
            <Text style={styles.modalSecondaryBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalPrimaryBtn} onPress={onSave}>
            <Text style={styles.modalPrimaryBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

// Desktop-only login layout (>=1024px). Reuses every piece of state/logic
// from WelcomeScreen unchanged -- send-otp/login/register calls, validation,
// GradientButton -- only the JSX/layout differs from the native/mobile-web
// version below. Split screen (banner+trust content left, centered login
// card right) instead of one stacked full-height column, so the form is
// visible without scrolling at 1366x768 and the leftover width isn't empty
// space. Sits under DesktopHeader (kept as-is -- already has logo/search/
// categories/nav from the earlier header-compaction pass) via
// setDesktopFullPageScreenActive, which also skips the shell's full
// marketing DesktopFooter in favor of the compact one rendered here.
function DesktopWelcomeLayout({
  mobile, otp, isOtpSent, isLoading, phoneError, resendCooldown,
  handlePhoneChange, setOtp, handleSendOtp, handleLogin,
  onOpenSettings, navigation,
}: any) {
  return (
    <View style={desktopStyles.page}>
      {/* Development builds only -- see the note on DEV_TOOLS_ENABLED. */}
      {DEV_TOOLS_ENABLED && (
        <Pressable
          style={desktopStyles.settingsIconBtn}
          onPress={onOpenSettings}
          accessibilityRole="button"
          accessibilityLabel="Developer settings"
        >
          <Ionicons name="settings-outline" size={16} color={colors.textMuted} />
        </Pressable>
      )}

      <Container style={desktopStyles.center}>
        <View style={desktopStyles.splitRow}>
          {/* LEFT: hero copy + banner + benefits */}
          <View style={desktopStyles.leftCol}>
            <View style={desktopStyles.leftLogoRow}>
              <Logo tone="dark" width={168} />
            </View>
            <Text style={desktopStyles.heroTitle}>India's Smart Vehicle Marketplace</Text>
            <Text style={desktopStyles.heroSubtitle}>Car Parts • Bike Parts • Home Mechanic Services</Text>

            <Image
              source={require('../../../assets/car_banner.jpg')}
              style={desktopStyles.bannerImage}
              resizeMode="cover"
            />

            <View style={desktopStyles.benefitsRow}>
              <View style={desktopStyles.benefitItem}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.primaryOnDark} />
                <Text style={desktopStyles.benefitText}>Genuine Parts</Text>
              </View>
              <View style={desktopStyles.benefitItem}>
                <Ionicons name="home-outline" size={18} color={colors.primaryOnDark} />
                <Text style={desktopStyles.benefitText}>Doorstep Service</Text>
              </View>
              <View style={desktopStyles.benefitItem}>
                <Ionicons name="flash-outline" size={18} color={colors.primaryOnDark} />
                <Text style={desktopStyles.benefitText}>Fast Delivery</Text>
              </View>
            </View>
          </View>

          {/* RIGHT: login card */}
          <View style={desktopStyles.rightCol}>
            <View style={desktopStyles.card}>
              <Text style={desktopStyles.welcomeBack}>Welcome Back</Text>
              <Text style={desktopStyles.continueWith}>Continue with your mobile number</Text>

              <Text style={desktopStyles.inputLabel}>Mobile Number</Text>
              <View style={[desktopStyles.inputRow, phoneError ? desktopStyles.inputRowError : null]}>
                <View style={desktopStyles.flagBox}>
                  <Text style={desktopStyles.flagText}>🇮🇳</Text>
                  <Text style={desktopStyles.countryCode}>+91</Text>
                  <View style={desktopStyles.verticalDivider} />
                </View>
                <TextInput
                  style={desktopStyles.mobileInput}
                  placeholder="Enter 10-digit number"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  maxLength={10}
                  value={mobile}
                  onChangeText={handlePhoneChange}
                  editable={!isOtpSent && !isLoading}
                />
              </View>
              {!!phoneError && (
                <View style={desktopStyles.errorRow}>
                  <Ionicons name="alert-circle" size={13} color={colors.danger} />
                  <Text style={desktopStyles.errorText}>{phoneError}</Text>
                </View>
              )}

              {isOtpSent && (
                <View style={desktopStyles.otpSection}>
                  <View style={desktopStyles.otpSectionHeader}>
                    <Text style={desktopStyles.inputLabel}>Enter OTP</Text>
                    <Text style={desktopStyles.sentToText}>Sent to +91 {mobile}</Text>
                  </View>
                  <View style={desktopStyles.inputRow}>
                    <Ionicons name="lock-closed-outline" size={17} color={colors.textMuted} style={{ marginRight: 10 }} />
                    <TextInput
                      style={desktopStyles.mobileInput}
                      placeholder="Enter 6-digit OTP"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      maxLength={6}
                      value={otp}
                      onChangeText={setOtp}
                      editable={!isLoading}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={() => handleSendOtp(true)}
                    disabled={resendCooldown > 0 || isLoading}
                    style={desktopStyles.resendBtn}
                  >
                    <Text style={[desktopStyles.resendText, (resendCooldown > 0 || isLoading) && desktopStyles.resendTextDisabled]}>
                      {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : 'Resend OTP'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <GradientButton
                onPress={isOtpSent ? handleLogin : () => handleSendOtp(false)}
                isLoading={isLoading}
                disabled={mobile.length < 10}
              >
                <Text style={desktopStyles.primaryBtnText}>{isOtpSent ? 'Verify & Login' : 'Request OTP'}</Text>
              </GradientButton>

              <Pressable
                style={({ hovered }: any) => [desktopStyles.wholesaleBtn, hovered && desktopStyles.wholesaleBtnHovered]}
                onPress={() => navigation.navigate('WholesaleRegistration')}
                accessibilityRole="button"
              >
                <Text style={desktopStyles.wholesaleBtnText}>Create Wholesale Account</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Container>

      <View style={desktopStyles.footer}>
        <Container style={desktopStyles.footerRow}>
          <Text style={desktopStyles.footerCopy}>© {new Date().getFullYear()} MechBazar. All rights reserved.</Text>
          <View style={desktopStyles.footerLinks}>
            <Text style={desktopStyles.footerStatic}>Privacy Policy</Text>
            <Text style={desktopStyles.footerDot}>•</Text>
            <Text style={desktopStyles.footerStatic}>Terms</Text>
            <Text style={desktopStyles.footerDot}>•</Text>
            <Pressable onPress={() => navigation.navigate('HelpCenter')}>
              <Text style={desktopStyles.footerLink}>Contact</Text>
            </Pressable>
          </View>
        </Container>
      </View>
    </View>
  );
}

export default function WelcomeScreen() {
  const dispatch = useDispatch();
  const navigation = useNavigation<any>();

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
  const [activeBaseUrl, setActiveBaseUrl] = useState(API_BASE_URL);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [tempBaseUrl, setTempBaseUrl] = useState(API_BASE_URL);
  const { isDesktopUp } = useBreakpoint();

  useFocusEffect(React.useCallback(() => {
    setDesktopFullPageScreenActive(true);
    return () => setDesktopFullPageScreenActive(false);
  }, []));

  // Animations
  const logoFadeAnim = useRef(new Animated.Value(0)).current;
  const heroSlideAnim = useRef(new Animated.Value(30)).current;
  const inputFadeAnim = useRef(new Animated.Value(0)).current;
  const gearRotation = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start entry animations
    Animated.parallel([
      Animated.timing(logoFadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true
      }),
      Animated.timing(heroSlideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true
      }),
      Animated.timing(inputFadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true
      })
    ]).start();

    // Start background loops
    Animated.loop(
      Animated.timing(gearRotation, {
        toValue: 1,
        duration: 25000,
        useNativeDriver: true
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 3500,
          useNativeDriver: true
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3500,
          useNativeDriver: true
        })
      ])
    ).start();
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
      setPhoneError('Mobile number must be exactly 10 digits.');
    } else {
      setPhoneError('');
    }
  };

  const handleSendOtp = async (isResend = false) => {
    if (mobile.length < 10) {
      setPhoneError('Please enter a valid 10-digit mobile number.');
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

    // Firebase Phone Auth sends the SMS itself as part of signInWithPhoneNumber
    // and, once confirmed in handleLogin, yields an ID token the backend
    // verifies. This is the only OTP path -- there is no backend send-otp
    // fallback (see apps/backend/src/utils/otp.ts).
    try {
      await sendPhoneOtp(mobile);
      setIsLoading(false);
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
    if (otp.length < 6) {
      notify('Validation Error', 'Please enter a valid 6-digit OTP.');
      return;
    }

    setIsLoading(true);
    try {
      // `otp` (the code the user typed) confirms the pending Firebase
      // phone-auth request and yields an ID token; that token -- not the raw
      // code -- is what the backend verifies (verifyOtpAndResolvePhone).
      const otpForBackend = await confirmPhoneOtp(otp);

      let res = await fetch(`${activeBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: mobile, otp: otpForBackend })
      });

      let data = await res.json();

      if (res.status === 401 && data.error?.includes('User not found')) {
        res = await fetch(`${activeBaseUrl}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: mobile,
            otp: otpForBackend,
            name: 'Customer User',
            accountType: 'RETAIL'
          })
        });
        data = await res.json();
      }

      if (res.ok) {
        dispatch(loginSuccess({
          user: data.user,
          token: data.token
        }));
      } else {
        notify('Authentication Failed', data.error || 'Authentication failed');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      notify('Network Error', `Failed to authenticate: ${message}`);
    } finally {
      setIsLoading(false);
    }
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

  if (isDesktopUp) {
    return (
      <>
        <DesktopWelcomeLayout
          mobile={mobile}
          otp={otp}
          isOtpSent={isOtpSent}
          isLoading={isLoading}
          phoneError={phoneError}
          resendCooldown={resendCooldown}
          handlePhoneChange={handlePhoneChange}
          setOtp={setOtp}
          handleSendOtp={handleSendOtp}
          handleLogin={handleLogin}
          navigation={navigation}
          onOpenSettings={() => {
            setTempBaseUrl(activeBaseUrl);
            setIsSettingsVisible(true);
          }}
        />
        <ApiSettingsModal
          visible={isSettingsVisible}
          tempBaseUrl={tempBaseUrl}
          setTempBaseUrl={setTempBaseUrl}
          onSave={saveSettings}
          onReset={resetSettings}
          onClose={() => setIsSettingsVisible(false)}
        />
      </>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <SvgBackground gearRotation={gearRotation} floatAnim={floatAnim} />

      {/* Top Header Settings Bar */}
      <View style={styles.topHeader}>
        {/* Development builds only -- see the note on DEV_TOOLS_ENABLED. */}
        {DEV_TOOLS_ENABLED && (
          <TouchableOpacity
            style={styles.settingsIconBtn}
            onPress={() => {
              setTempBaseUrl(activeBaseUrl);
              setIsSettingsVisible(true);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={20} color={colors.white} />
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
          scrollEnabled={false}
        >
          <View style={styles.mainContent}>

            {/* LOGO -- dark tone: this screen's background is near-black. */}
            <Animated.View style={[styles.logoSection, { opacity: logoFadeAnim }]}>
              <Logo tone="dark" width={220} />
            </Animated.View>

            {/* HERO TEXTS */}
            <Animated.View style={[
              styles.heroSection,
              {
                opacity: logoFadeAnim,
                transform: [{ translateY: heroSlideAnim }]
              }
            ]}>
              <Text style={styles.heroTitle}>India's Smart Vehicle Marketplace</Text>
              <Text style={styles.heroSubtitle}>Car Parts • Bike Parts • Home Mechanic Services</Text>
              <Text style={styles.heroDescription}>
                Order genuine spare parts, book expert mechanics at home, and get instant assistance—all in one app.
              </Text>
            </Animated.View>

            {/* FEATURE BADGES */}
            <View style={styles.badgeRow}>
              <View style={styles.featureBadge}>
                <Text style={styles.badgeText}>🚗 Genuine Parts</Text>
              </View>
              <View style={styles.featureBadge}>
                <Text style={styles.badgeText}>🏍 Bike & Car Support</Text>
              </View>
              <View style={styles.featureBadge}>
                <Text style={styles.badgeText}>🔧 Home Service</Text>
              </View>
            </View>

            {/* TRUST INDICATORS */}
            <View style={styles.trustGrid}>
              <View style={styles.trustItem}><Text style={styles.trustItemText}>✓ Verified Mechanics</Text></View>
              <View style={styles.trustItem}><Text style={styles.trustItemText}>✓ Genuine Products</Text></View>
              <View style={styles.trustItem}><Text style={styles.trustItemText}>✓ Fast Delivery</Text></View>
              <View style={styles.trustItem}><Text style={styles.trustItemText}>✓ Secure OTP Login</Text></View>
            </View>

            {/* PREMIUM LOGIN CARD */}
            <Animated.View style={[styles.authContainer, { opacity: inputFadeAnim }]}>
              <Text style={styles.cardEyebrow}>{isOtpSent ? 'VERIFY YOUR NUMBER' : 'LOG IN OR SIGN UP'}</Text>

              <Text style={styles.inputLabel}>Mobile Number</Text>
              <View style={[styles.inputRow, phoneError ? styles.inputRowError : null]}>
                <View style={styles.flagBox}>
                  <Text style={styles.flagText}>🇮🇳</Text>
                  <Text style={styles.countryCode}>+91</Text>
                  <View style={styles.verticalDivider} />
                </View>
                <TextInput
                  style={styles.mobileInput}
                  placeholder="Enter 10-digit number"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  maxLength={10}
                  value={mobile}
                  onChangeText={handlePhoneChange}
                  editable={!isOtpSent && !isLoading}
                  autoFocus={true}
                />
              </View>
              {!!phoneError && (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={13} color={colors.danger} />
                  <Text style={styles.errorText}>{phoneError}</Text>
                </View>
              )}

              {isOtpSent && (
                <View style={styles.otpSection}>
                  <View style={styles.otpSectionHeader}>
                    <Text style={styles.inputLabel}>Enter OTP</Text>
                    <Text style={styles.sentToText}>Sent to +91 {mobile}</Text>
                  </View>
                  <View style={styles.otpInputRow}>
                    <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.otpInput}
                      placeholder="Enter 6-digit OTP"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      maxLength={6}
                      value={otp}
                      onChangeText={setOtp}
                      editable={!isLoading}
                      autoFocus={true}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={() => handleSendOtp(true)}
                    disabled={resendCooldown > 0 || isLoading}
                    style={styles.resendBtn}
                  >
                    <Text style={[styles.resendText, (resendCooldown > 0 || isLoading) && styles.resendTextDisabled]}>
                      {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : 'Resend OTP'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <GradientButton
                onPress={isOtpSent ? handleLogin : () => handleSendOtp(false)}
                isLoading={isLoading}
                disabled={mobile.length < 10}
              >
                <Text style={styles.primaryBtnText}>
                  {isOtpSent ? 'Verify & Login' : 'Send OTP'}
                </Text>
              </GradientButton>

              <View style={styles.securityNote}>
                <Ionicons name="shield-checkmark-outline" size={13} color={colors.textMuted} />
                <Text style={styles.securityNoteText}>Your number is used only for secure OTP login</Text>
              </View>
            </Animated.View>

          </View>

          {/* FOOTER */}
          <View style={styles.footerContainer}>
            <View style={styles.footerTextRow}>
              <TouchableOpacity onPress={() => navigation.navigate('WholesaleRegistration')} activeOpacity={0.7}>
                <Text style={styles.linkText}>Create Wholesale Account</Text>
              </TouchableOpacity>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Dynamic API Configuration Modal (Top-Right Settings) */}
      <Modal
        visible={isSettingsVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsSettingsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>API Server Configuration</Text>
            <Text style={styles.modalDesc}>Change backend API base URL for testing environment updates.</Text>

            <TextInput
              style={styles.modalInput}
              value={tempBaseUrl}
              onChangeText={setTempBaseUrl}
              placeholder="http://<IP>:<PORT>/api"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalSecondaryBtn} onPress={resetSettings}>
                <Text style={styles.modalSecondaryBtnText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSecondaryBtn} onPress={() => setIsSettingsVisible(false)}>
                <Text style={styles.modalSecondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimaryBtn} onPress={saveSettings}>
                <Text style={styles.modalPrimaryBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// Caps how wide the stacked mobile column is allowed to grow (tablet
// portrait, foldables) -- below this the layout is just full-width with
// spacing.lg gutters, same as before.
const CONTENT_MAX_WIDTH = 460;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
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
    backgroundColor: '#FFFFFF12',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#FFFFFF1F',
  },
  animatedGear: {
    position: 'absolute',
    top: 50,
    right: -20,
  },
  animatedBike: {
    position: 'absolute',
    bottom: 80,
    left: -30,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  heroSubtitle: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primaryOnDark,
    marginTop: spacing.xs,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroDescription: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  featureBadge: {
    backgroundColor: '#FFFFFF0D',
    borderWidth: 1,
    borderColor: '#FFFFFF14',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    marginHorizontal: 3,
  },
  badgeText: {
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: '700',
  },
  trustGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    marginHorizontal: -4,
  },
  trustItem: {
    width: '46%',
    margin: 3,
    backgroundColor: '#FFFFFF08',
    borderRadius: radius.sm,
    paddingVertical: 4,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#FFFFFF0D',
  },
  trustItemText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  // "Premium OTP card" -- larger radius + real elevation shadow (tokens'
  // shadows.lg) instead of the previous flat, barely-elevated panel, and a
  // small eyebrow label so the card reads as its own distinct step rather
  // than a continuation of the hero copy above it.
  authContainer: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.lg,
  },
  cardEyebrow: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm + 4,
    height: 56,
    marginBottom: spacing.xs,
  },
  inputRowError: {
    borderColor: colors.danger,
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
    color: colors.textPrimary,
    marginLeft: spacing.xs + 2,
  },
  verticalDivider: {
    width: 1,
    height: 22,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  mobileInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
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
    color: colors.danger,
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
    color: colors.textMuted,
  },
  resendBtn: {
    alignSelf: 'flex-end',
    marginTop: spacing.sm,
    paddingVertical: 4,
  },
  resendText: {
    color: colors.primaryOnDark,
    fontSize: 13,
    fontWeight: '700',
  },
  resendTextDisabled: {
    color: colors.textMuted,
  },
  otpInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm + 4,
    height: 56,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  otpInput: {
    flex: 1,
    fontSize: 16,
    letterSpacing: 2,
    color: colors.textPrimary,
    height: '100%',
  },
  gradientBtnContainer: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
    borderRadius: radius.md,
  },
  btnContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    ...typography.button,
    color: colors.white,
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
    fontSize: 11,
    color: colors.textMuted,
  },
  footerContainer: {
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
  },
  footerTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  linkText: {
    color: colors.primaryOnDark,
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000080',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.lg,
  },
  modalTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  modalDesc: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  modalInput: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
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
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  modalPrimaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  modalPrimaryBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  }
});

// Desktop-only (>=1024px, see DesktopWelcomeLayout above). Same dark brand
// palette (`colors` above) as the native screen -- this is a layout change,
// not a re-theme.
const desktopStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  settingsIconBtn: {
    position: 'absolute' as any,
    top: spacing.md,
    right: spacing.md,
    zIndex: 10,
    padding: spacing.sm,
    backgroundColor: '#FFFFFF0D',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#FFFFFF15',
  },
  center: { flex: 1, justifyContent: 'center', paddingVertical: spacing.xl },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxl,
  },
  leftCol: { flex: 1.15 },
  leftLogoRow: { marginBottom: spacing.lg },
  heroTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  heroSubtitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.primaryOnDark,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  bannerImage: {
    width: '100%',
    height: 320,
    borderRadius: radius.lg,
  },
  benefitsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  benefitItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  benefitText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  rightCol: { width: 480, maxWidth: 480, flexShrink: 0, alignItems: 'stretch' },
  card: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.lg,
  },
  welcomeBack: { ...typography.h3, color: colors.textPrimary },
  continueWith: { ...typography.bodySmall, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },
  inputLabel: { ...typography.bodySmall, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm + 4,
    height: 56,
  },
  inputRowError: { borderColor: colors.danger },
  flagBox: { flexDirection: 'row', alignItems: 'center' },
  flagText: { fontSize: 17 },
  countryCode: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginLeft: spacing.xs + 2 },
  verticalDivider: { width: 1, height: 22, backgroundColor: colors.border, marginHorizontal: spacing.sm },
  mobileInput: { flex: 1, fontSize: 15, color: colors.textPrimary, outlineStyle: 'none' as any },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs },
  errorText: { ...typography.caption, color: colors.danger },
  otpSection: { marginTop: spacing.md },
  otpSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sentToText: { ...typography.caption, color: colors.textMuted },
  resendBtn: { alignSelf: 'flex-end', marginTop: spacing.sm, paddingVertical: 4 },
  resendText: { color: colors.primaryOnDark, fontSize: 13, fontWeight: '700' },
  resendTextDisabled: { color: colors.textMuted },
  primaryBtnText: {
    ...typography.button,
    color: colors.white,
    textTransform: 'uppercase',
    letterSpacing: 0.75,
  },
  wholesaleBtn: {
    marginTop: spacing.md,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wholesaleBtnHovered: { borderColor: colors.primaryOnDark },
  wholesaleBtnText: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  footer: { borderTopWidth: 1, borderTopColor: colors.border },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  footerCopy: { color: colors.textMuted, fontSize: 12 },
  footerLinks: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  footerStatic: { color: colors.textMuted, fontSize: 12 },
  footerLink: { color: colors.primaryOnDark, fontSize: 12, fontWeight: '700' },
  footerDot: { color: '#3A4552', fontSize: 12 },
});
