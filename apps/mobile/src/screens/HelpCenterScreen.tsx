import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Linking, 
  Alert, 
  Platform 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

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

interface FAQItem {
  id: number;
  question: string;
  answer: string;
  category: string;
}

const FAQS: FAQItem[] = [
  {
    id: 1,
    category: 'spares',
    question: 'How do I check if a spare part fits my vehicle?',
    answer: 'Simply add your vehicle to "My Garage" from the profile tab. Once selected as your active vehicle, the app will automatically filter and label compatible parts with a green "Fits Your Vehicle" badge.'
  },
  {
    id: 2,
    category: 'spares',
    question: 'What is the return policy for genuine parts?',
    answer: 'We offer a 10-day replacement and return guarantee on all unused spare parts in their original packaging. Return requests can be initiated directly from your Orders page.'
  },
  {
    id: 3,
    category: 'services',
    question: 'How do doorstep services work?',
    answer: 'Once you book a service, an expert mechanic will be assigned to your booking. They will arrive at your home with all required tools and spares on the scheduled date and time to perform the work in front of you.'
  },
  {
    id: 4,
    category: 'services',
    question: 'Can I reschedule my service appointment?',
    answer: 'Yes, you can reschedule your doorstep service free of charge up to 2 hours before the scheduled time by visiting the Service Bookings section on your profile.'
  },
  {
    id: 5,
    category: 'payments',
    question: 'What payment options do you support?',
    answer: 'We support all major payment types including UPI (Google Pay, PhonePe, Paytm), Credit/Debit cards, Net Banking, and Cash on Delivery (COD) for parts and services.'
  },
  {
    id: 6,
    category: 'payments',
    question: 'When will I get my refund for a cancelled booking?',
    answer: 'Refunds are processed instantly upon cancellation and reflect in your original payment method within 3-5 business days, depending on your bank.'
  }
];

export default function HelpCenterScreen() {
  const navigation = useNavigation<any>();
  const [activeCategory, setActiveCategory] = useState('all');
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  const handleCallSupport = () => {
    const phoneNumber = 'tel:1800123456';
    Linking.canOpenURL(phoneNumber)
      .then(supported => {
        if (supported) {
          Linking.openURL(phoneNumber);
        } else {
          Alert.alert('Error', 'Call functionality is not supported on this device.');
        }
      })
      .catch(err => console.error(err));
  };

  const handleWhatsAppSupport = () => {
    const message = 'Hello Mech Bazar Support, I need help with my account.';
    const url = `https://wa.me/919876543210?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Failed to open WhatsApp. Please save +91 9876543210 to chat.');
    });
  };

  const filteredFAQs = activeCategory === 'all' 
    ? FAQS 
    : FAQS.filter(faq => faq.category === activeCategory);

  const toggleFAQ = (id: number) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Support & Help Center</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Help Cards */}
        <Text style={styles.sectionHeader}>Quick Help Channels</Text>
        <View style={styles.helpGrid}>
          <TouchableOpacity style={styles.helpCard} onPress={handleCallSupport}>
            <View style={[styles.iconCircle, { backgroundColor: '#EBFBEE' }]}>
              <Ionicons name="call-outline" size={24} color="#2B8A3E" />
            </View>
            <Text style={styles.cardTitle}>Call Hotline</Text>
            <Text style={styles.cardSub}>Toll-Free 24/7 Support</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.helpCard} onPress={handleWhatsAppSupport}>
            <View style={[styles.iconCircle, { backgroundColor: '#E8F7FF' }]}>
              <Ionicons name="logo-whatsapp" size={24} color="#1C7ED6" />
            </View>
            <Text style={styles.cardTitle}>WhatsApp Chat</Text>
            <Text style={styles.cardSub}>Instant chat replies</Text>
          </TouchableOpacity>
        </View>

        {/* Categories Tabs */}
        <Text style={styles.sectionHeader}>Frequently Asked Questions</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
          {[
            { id: 'all', label: 'All FAQs' },
            { id: 'spares', label: 'Spares & Returns' },
            { id: 'services', label: 'Mechanic Services' },
            { id: 'payments', label: 'Payments & Refunds' }
          ].map(cat => (
            <TouchableOpacity 
              key={cat.id} 
              style={[styles.tab, activeCategory === cat.id && styles.tabActive]}
              onPress={() => {
                setActiveCategory(cat.id);
                setExpandedFAQ(null);
              }}
            >
              <Text style={[styles.tabText, activeCategory === cat.id && styles.tabTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* FAQ Accordion List */}
        <View style={styles.faqList}>
          {filteredFAQs.map(faq => {
            const isExpanded = expandedFAQ === faq.id;
            return (
              <View key={faq.id} style={styles.faqItem}>
                <TouchableOpacity 
                  style={styles.faqHeader} 
                  onPress={() => toggleFAQ(faq.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.faqQuestion}>{faq.question}</Text>
                  <Ionicons 
                    name={isExpanded ? "chevron-up" : "chevron-down"} 
                    size={18} 
                    color={colors.textMuted} 
                  />
                </TouchableOpacity>
                {isExpanded && (
                  <View style={styles.faqAnswerContainer}>
                    <Text style={styles.faqAnswer}>{faq.answer}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
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
  scrollContent: { padding: 16 },
  
  sectionHeader: { fontSize: 14, fontWeight: 'bold', color: colors.textDark, marginTop: 12, marginBottom: 12, letterSpacing: 0.5, textTransform: 'uppercase' },
  helpGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  helpCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 16,
    width: '48%',
    alignItems: 'center',
  },
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: 13, fontWeight: 'bold', color: colors.textDark, marginBottom: 4 },
  cardSub: { fontSize: 10, color: colors.textMuted },

  tabsContainer: { marginBottom: 16 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.white, marginRight: 8, borderWidth: 1, borderColor: colors.borderLight },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 12, color: colors.textDark, fontWeight: '600' },
  tabTextActive: { color: colors.white },

  faqList: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden' },
  faqItem: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  faqQuestion: { fontSize: 13, fontWeight: '700', color: colors.textDark, flex: 1, paddingRight: 10 },
  faqAnswerContainer: { paddingHorizontal: 16, paddingBottom: 16 },
  faqAnswer: { fontSize: 12, color: colors.textMuted, lineHeight: 18 }
});
