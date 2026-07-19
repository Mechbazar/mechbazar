import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  TextInput, 
  ScrollView, 
  Alert, 
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { RootState } from '../store';
import { updateUserSuccess } from '../store/authSlice';
import { updateMyProfile } from '../services/profile.service';

const colors = {
  primary: '#E53935',
  secondary: '#1C1C1E',
  white: '#FFFFFF',
  pageBg: '#F8F9FA',
  borderLight: '#E8ECEF',
  textDark: '#111112',
  textMuted: '#8E8E93',
  lightGray: '#F2F2F7',
};

export default function EditProfileScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const { user, token } = useSelector((state: RootState) => state.auth);

  // States
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [gender, setGender] = useState(user?.gender || 'Male');
  const [dob, setDob] = useState(user?.dob || '1995-08-15');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Name cannot be empty.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Validation Error', 'Mobile number cannot be empty.');
      return;
    }

    setSaving(true);
    // Phone is the account's verified login identifier (set at registration
    // via OTP) and isn't editable here -- only name/email/gender/dob go to
    // the server; phone stays whatever the account already has.
    const result = await updateMyProfile(token || '', { name, email, gender, dob });
    setSaving(false);

    if (result.error) {
      Alert.alert('Update Failed', result.error);
      return;
    }

    dispatch(updateUserSuccess({ name, email, gender, dob }));
    Alert.alert('Success', 'Profile updated successfully!', [
      { text: 'OK', onPress: () => navigation.goBack() }
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Avatar section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{(name || 'U').charAt(0).toUpperCase()}</Text>
          </View>
          <TouchableOpacity 
            style={styles.changePhotoBtn}
            onPress={() => Alert.alert('Profile Photo', 'Selected dummy photo. Photo updated successfully.')}
          >
            <Text style={styles.changePhotoText}>Change Profile Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Form Fields */}
        <View style={styles.formCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>FULL NAME</Text>
            <TextInput 
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your full name"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
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
            <Text style={styles.inputLabel}>MOBILE NUMBER</Text>
            <TextInput 
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter mobile number"
              keyboardType="phone-pad"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {/* Gender */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>GENDER</Text>
            <View style={styles.genderRow}>
              {['Male', 'Female', 'Other'].map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.genderOption, gender === item && styles.genderOptionSelected]}
                  onPress={() => setGender(item)}
                >
                  <Text style={[styles.genderText, gender === item && styles.genderTextSelected]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Date of Birth */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>DATE OF BIRTH (YYYY-MM-DD)</Text>
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
            {saving ? 'Saving...' : 'Save Profile Details'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
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
  changePhotoBtn: { marginTop: 12 },
  changePhotoText: { color: colors.primary, fontWeight: 'bold', fontSize: 13 },
  formCard: {
    backgroundColor: colors.white,
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
  genderRow: { flexDirection: 'row', justifyContent: 'space-between' },
  genderOption: {
    width: '30%',
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.white,
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
