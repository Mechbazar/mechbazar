import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Platform,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { RootState } from '../store';
import { updateUserSuccess } from '../store/authSlice';
import { updateMyProfile } from '../services/profile.service';
import { API_BASE_URL } from '../services/api';
import { useStableIsDesktopUp } from '../hooks/useStableIsDesktopUp';
import { setDesktopFullPageScreenActive } from '../navigation/desktopFullPageScreenStore';
import CompactBookingShell from '../components/desktop/shared/CompactBookingShell';
import MinimalFooter from '../components/desktop/shared/MinimalFooter';
import { useIsDarkMode } from '../theme/useThemeColors';
import { useTranslation } from 'react-i18next';
import { notify } from '../utils/notify';

const GENDER_OPTIONS = [
  { value: 'Male', labelKey: 'editProfile.male' },
  { value: 'Female', labelKey: 'editProfile.female' },
  { value: 'Other', labelKey: 'editProfile.other' },
];

// `secondary` (the header bar) and `white` (text/icons drawn on that header,
// on the red avatar circle, and on the red save button) are fixed -- they
// never invert. `surface` is the actual card/gender-chip background and is
// the one that goes dark in dark mode; it's a new key split out from what
// used to be `colors.white` doing double duty as both roles.
const LIGHT_COLORS = {
  primary: '#E53935',
  secondary: '#1C1C1E',
  white: '#FFFFFF',
  surface: '#FFFFFF',
  pageBg: '#F8F9FA',
  borderLight: '#E8ECEF',
  textDark: '#111112',
  textMuted: '#8E8E93',
  lightGray: '#F2F2F7',
};

const DARK_COLORS: typeof LIGHT_COLORS = {
  primary: '#FF5A4E',
  secondary: '#1C1C1E',
  white: '#FFFFFF',
  surface: '#1E1E1E',
  pageBg: '#121212',
  borderLight: '#2E2E2E',
  textDark: '#F1F2F4',
  textMuted: '#A6ACB5',
  lightGray: '#1E1E1E',
};

export default function EditProfileScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { user, token } = useSelector((state: RootState) => state.auth);
  const colors = useIsDarkMode() ? DARK_COLORS : LIGHT_COLORS;
  const styles = useMemo(() => createStyles(colors), [colors]);

  // States
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [dob, setDob] = useState(user?.dob || '');
  const [avatar, setAvatar] = useState<string | undefined>(user?.avatar || undefined);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const isDesktopUp = useStableIsDesktopUp();
  useFocusEffect(
    useCallback(() => {
      if (!isDesktopUp) return;
      setDesktopFullPageScreenActive(true);
      return () => setDesktopFullPageScreenActive(false);
    }, [isDesktopUp]),
  );

  const handleChangePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      notify('Permission needed', 'Allow photo library access to change your profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingPhoto(true);
    try {
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: asset.fileName || 'avatar.jpg',
      } as any);
      const uploadRes = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        notify('Upload Failed', uploadData.error || 'Could not upload photo.');
        return;
      }
      const result2 = await updateMyProfile(token || '', { avatar: uploadData.url });
      if (result2.error) {
        notify('Update Failed', result2.error);
        return;
      }
      setAvatar(uploadData.url);
      dispatch(updateUserSuccess({ avatar: uploadData.url }));
      notify('Success', 'Profile photo updated.');
    } catch (e) {
      notify('Error', 'Network error while uploading photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      notify('Validation Error', 'Name cannot be empty.');
      return;
    }
    if (!phone.trim()) {
      notify('Validation Error', 'Mobile number cannot be empty.');
      return;
    }

    setSaving(true);
    // Phone is the account's verified login identifier (set at registration
    // via OTP) and isn't editable here -- only name/email/gender/dob go to
    // the server; phone stays whatever the account already has.
    const result = await updateMyProfile(token || '', { name, email, gender, dob });
    setSaving(false);

    if (result.error) {
      notify('Update Failed', result.error);
      return;
    }

    dispatch(updateUserSuccess({ name, email, gender, dob }));
    notify('Success', 'Profile updated successfully!', () => navigation.goBack());
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('account.editProfile')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <CompactBookingShell maxWidth={640} style={styles.flexFill}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Avatar section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{(name || 'U').charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.changePhotoBtn}
            onPress={handleChangePhoto}
            disabled={uploadingPhoto}
          >
            <Text style={styles.changePhotoText}>{uploadingPhoto ? t('editProfile.uploading') : t('editProfile.changeProfilePhoto')}</Text>
          </TouchableOpacity>
        </View>

        {/* Form Fields */}
        <View style={styles.formCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('editProfile.fullName')}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t('editProfile.enterFullName')}
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('editProfile.emailAddress')}</Text>
            <TextInput 
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('editProfile.mobileNumber')}</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={phone}
              editable={false}
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.helperText}>{t('editProfile.mobileNumberHelper')}</Text>
          </View>

          {/* Gender */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('editProfile.gender')}</Text>
            <View style={styles.genderRow}>
              {GENDER_OPTIONS.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[styles.genderOption, gender === item.value && styles.genderOptionSelected]}
                  onPress={() => setGender(item.value)}
                >
                  <Text style={[styles.genderText, gender === item.value && styles.genderTextSelected]}>
                    {t(item.labelKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Date of Birth */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('editProfile.dateOfBirth')}</Text>
            <TextInput 
              style={styles.input}
              value={dob}
              onChangeText={setDob}
              placeholder="e.g. 1995-08-15"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        <TouchableOpacity 
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Text style={styles.saveBtnText}>
            {saving ? t('address.saving') : t('editProfile.saveProfileDetails')}
          </Text>
        </TouchableOpacity>
        <MinimalFooter />
      </ScrollView>
      </CompactBookingShell>
    </SafeAreaView>
  );
}

const createStyles = (colors: typeof LIGHT_COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  flexFill: { flex: 1 },
  header: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: 16, 
    backgroundColor: colors.secondary 
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.white },
  scrollContent: { padding: 16, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', marginVertical: 20 },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarText: { fontSize: 36, fontWeight: '800', color: colors.white },
  avatarImage: { width: '100%', height: '100%', borderRadius: 45 },
  changePhotoBtn: { marginTop: 12 },
  changePhotoText: { color: colors.primary, fontWeight: 'bold', fontSize: 13 },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 16,
    marginBottom: 24,
  },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 10, fontWeight: 'bold', color: colors.textMuted, marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    color: colors.textDark,
    fontSize: 14,
    fontWeight: '600',
  },
  inputDisabled: { backgroundColor: colors.lightGray, color: colors.textMuted },
  helperText: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  genderRow: { flexDirection: 'row', justifyContent: 'space-between' },
  genderOption: {
    width: '30%',
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  genderOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFEAEA',
  },
  genderText: { fontSize: 12, fontWeight: 'bold', color: colors.textMuted },
  genderTextSelected: { color: colors.primary },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: { color: colors.white, fontSize: 15, fontWeight: 'bold' }
});
