import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';

// ── Design tokens ───────────────────────────────────────────────────────────
const PRIMARY = '#2563EB';
const PRIMARY_LIGHT = '#DBEAFE';
const PRIMARY_BG = '#EFF6FF';
const SURFACE = '#F8FAFC';
const WHITE = '#FFFFFF';
const TEXT_PRIMARY = '#0F172A';
const TEXT_SECONDARY = '#64748B';
const TEXT_DISABLED = '#94A3B8';
const BORDER_LIGHT = '#F1F5F9';
const BORDER = '#E2E8F0';
const SUCCESS_MAIN = '#22C55E';
const SUCCESS_BG = '#F0FDF4';
const SUCCESS_TEXT = '#15803D';
const CRITICAL_MAIN = '#DC2626';
const CRITICAL_BG = '#FEF2F2';
const WARNING_MAIN = '#F59E0B';
const WARNING_BG = '#FFF7ED';
const WARNING_TEXT = '#C2410C';

// ── Mock patient data ───────────────────────────────────────────────────────

const PATIENT = {
  firstName: 'Ravi',
  lastName: 'Kumar',
  phone: '+91 98765 43210',
  email: 'ravi.kumar@example.com',
  dateOfBirth: '15 January 1990',
  age: 36,
  gender: 'Male',
  bloodGroup: 'B+',
  address: '123, MG Road, Koregaon Park, Pune - 411001',
  abhaNumber: '91-1234-5678-9012',
  abhaLinked: true,
};

const MEDICAL_HISTORY = {
  allergies: ['Penicillin', 'Sulfa drugs'],
  chronicConditions: ['Type 2 Diabetes', 'Hypertension', 'Dyslipidemia'],
  familyHistory: [
    { relation: 'Father', condition: 'Type 2 Diabetes, Hypertension' },
    { relation: 'Mother', condition: 'Hypothyroidism' },
    { relation: 'Sibling', condition: 'None' },
  ],
  pastSurgeries: [{ name: 'Appendectomy', year: '2018' }],
};

const EMERGENCY_CONTACT = {
  name: 'Meera Kumar',
  relation: 'Wife',
  phone: '+91 87654 32109',
};

// ── Component ───────────────────────────────────────────────────────────────

export default function PatientProfile() {
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  const LANGUAGES = ['English', 'Hindi', 'Marathi', 'Gujarati', 'Tamil', 'Telugu'];

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => {
            // TODO: Clear auth tokens and navigate to login
            router.replace('/login');
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* ── Profile Header ── */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={{ fontSize: 44 }}>👤</Text>
        </View>
        <Text style={styles.name}>
          {PATIENT.firstName} {PATIENT.lastName}
        </Text>
        <Text style={styles.phone}>{PATIENT.phone}</Text>

        {/* ABHA Linking Status */}
        {PATIENT.abhaLinked ? (
          <View style={styles.abhaBadge}>
            <Text style={{ fontSize: 12 }}>🔗</Text>
            <Text style={styles.abhaLabel}>ABHA</Text>
            <Text style={styles.abhaNumber}>{PATIENT.abhaNumber}</Text>
            <View style={styles.abhaVerified}>
              <Text style={styles.abhaVerifiedText}>VERIFIED</Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.abhaLinkButton}>
            <Text style={styles.abhaLinkButtonText}>
              Link ABHA Number
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Personal Information ── */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <TouchableOpacity>
            <Text style={styles.editLink}>Edit</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.card}>
          <InfoRow label="Full Name" value={`${PATIENT.firstName} ${PATIENT.lastName}`} />
          <InfoRow label="Phone" value={PATIENT.phone} />
          <InfoRow label="Email" value={PATIENT.email} />
          <InfoRow label="Date of Birth" value={`${PATIENT.dateOfBirth} (${PATIENT.age} yrs)`} />
          <InfoRow label="Gender" value={PATIENT.gender} />
          <InfoRow label="Blood Group" value={PATIENT.bloodGroup} />
          <InfoRow label="Address" value={PATIENT.address} last />
        </View>
      </View>

      {/* ── ABHA Number Section ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ABHA (Ayushman Bharat Health Account)</Text>
        <View style={styles.abhaCard}>
          <View style={styles.abhaCardHeader}>
            <Text style={{ fontSize: 20 }}>🏥</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.abhaCardTitle}>ABHA Number</Text>
              <Text style={styles.abhaCardNumber}>{PATIENT.abhaNumber}</Text>
            </View>
            <View style={styles.abhaStatusBadge}>
              <Text style={styles.abhaStatusText}>Linked</Text>
            </View>
          </View>
          <Text style={styles.abhaCardDesc}>
            Your health records are linked to the Ayushman Bharat Digital
            Mission. This enables seamless sharing of records across healthcare
            providers.
          </Text>
          <View style={styles.abhaActions}>
            <TouchableOpacity style={styles.abhaActionBtn}>
              <Text style={styles.abhaActionText}>View ABHA Card</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.abhaActionBtn}>
              <Text style={styles.abhaActionText}>Manage Consent</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Medical History ── */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Medical History</Text>
          <TouchableOpacity>
            <Text style={styles.editLink}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Allergies */}
        <View style={styles.card}>
          <View style={styles.medHistoryHeader}>
            <Text style={{ fontSize: 16 }}>⚠️</Text>
            <Text style={styles.medHistoryLabel}>Allergies</Text>
          </View>
          <View style={styles.tagRow}>
            {MEDICAL_HISTORY.allergies.map((allergy) => (
              <View key={allergy} style={styles.allergyTag}>
                <Text style={styles.allergyTagText}>{allergy}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Chronic Conditions */}
        <View style={[styles.card, { marginTop: 8 }]}>
          <View style={styles.medHistoryHeader}>
            <Text style={{ fontSize: 16 }}>📋</Text>
            <Text style={styles.medHistoryLabel}>Chronic Conditions</Text>
          </View>
          <View style={styles.tagRow}>
            {MEDICAL_HISTORY.chronicConditions.map((cond) => (
              <View key={cond} style={styles.conditionTag}>
                <Text style={styles.conditionTagText}>{cond}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Family History */}
        <View style={[styles.card, { marginTop: 8 }]}>
          <View style={styles.medHistoryHeader}>
            <Text style={{ fontSize: 16 }}>👨‍👩‍👦</Text>
            <Text style={styles.medHistoryLabel}>Family History</Text>
          </View>
          {MEDICAL_HISTORY.familyHistory.map((entry, idx) => (
            <View
              key={entry.relation}
              style={[
                styles.familyRow,
                idx === MEDICAL_HISTORY.familyHistory.length - 1 && {
                  borderBottomWidth: 0,
                },
              ]}
            >
              <Text style={styles.familyRelation}>{entry.relation}</Text>
              <Text style={styles.familyCondition}>{entry.condition}</Text>
            </View>
          ))}
        </View>

        {/* Past Surgeries */}
        <View style={[styles.card, { marginTop: 8 }]}>
          <View style={styles.medHistoryHeader}>
            <Text style={{ fontSize: 16 }}>🏥</Text>
            <Text style={styles.medHistoryLabel}>Past Surgeries</Text>
          </View>
          {MEDICAL_HISTORY.pastSurgeries.map((surgery) => (
            <View key={surgery.name} style={styles.surgeryRow}>
              <Text style={styles.surgeryName}>{surgery.name}</Text>
              <Text style={styles.surgeryYear}>{surgery.year}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Emergency Contact ── */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Emergency Contact</Text>
          <TouchableOpacity>
            <Text style={styles.editLink}>Edit</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.emergencyCard}>
          <View style={styles.emergencyIcon}>
            <Text style={{ fontSize: 20 }}>🆘</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.emergencyName}>{EMERGENCY_CONTACT.name}</Text>
            <Text style={styles.emergencyRelation}>
              {EMERGENCY_CONTACT.relation}
            </Text>
            <Text style={styles.emergencyPhone}>
              {EMERGENCY_CONTACT.phone}
            </Text>
          </View>
          <TouchableOpacity style={styles.callButton}>
            <Text style={styles.callButtonText}>📞 Call</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── App Settings ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Settings</Text>
        <View style={styles.card}>
          {/* Language */}
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => setShowLanguagePicker(!showLanguagePicker)}
          >
            <Text style={{ fontSize: 18 }}>🌐</Text>
            <Text style={styles.settingLabel}>Language</Text>
            <Text style={styles.settingValue}>{selectedLanguage} ›</Text>
          </TouchableOpacity>

          {showLanguagePicker && (
            <View style={styles.languagePicker}>
              {LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.languageOption,
                    selectedLanguage === lang && styles.languageOptionActive,
                  ]}
                  onPress={() => {
                    setSelectedLanguage(lang);
                    setShowLanguagePicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.languageOptionText,
                      selectedLanguage === lang && { color: PRIMARY, fontWeight: '600' },
                    ]}
                  >
                    {lang}
                  </Text>
                  {selectedLanguage === lang && (
                    <Text style={{ color: PRIMARY }}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Notifications */}
          <View style={styles.settingRow}>
            <Text style={{ fontSize: 18 }}>🔔</Text>
            <Text style={[styles.settingLabel, { flex: 1 }]}>
              Notifications
            </Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: BORDER, true: PRIMARY_LIGHT }}
              thumbColor={notificationsEnabled ? PRIMARY : TEXT_DISABLED}
            />
          </View>

          {/* Other settings */}
          <MenuItem icon="🔒" label="Privacy Settings" />
          <MenuItem icon="📱" label="Linked Devices" value="2 devices" />
          <MenuItem icon="📤" label="Export Health Records" />
          <MenuItem icon="❓" label="Help & Support" />
          <MenuItem icon="📄" label="Terms of Service" />
          <MenuItem icon="🛡️" label="Privacy Policy" last />
        </View>
      </View>

      {/* ── Logout Button ── */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>CliniqAI Patient App v1.0.0</Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[infoStyles.row, last && { borderBottomWidth: 0 }]}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  label: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    maxWidth: '35%',
  },
  value: {
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_PRIMARY,
    maxWidth: '60%',
    textAlign: 'right',
  },
});

function MenuItem({
  icon,
  label,
  value,
  last,
}: {
  icon: string;
  label: string;
  value?: string;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[menuStyles.item, last && { borderBottomWidth: 0 }]}
    >
      <Text style={{ fontSize: 18 }}>{icon}</Text>
      <Text style={menuStyles.label}>{label}</Text>
      <Text style={menuStyles.value}>{value || '›'}</Text>
    </TouchableOpacity>
  );
}

const menuStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  label: {
    flex: 1,
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  value: {
    fontSize: 13,
    color: TEXT_DISABLED,
  },
});

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SURFACE },

  // Header
  header: {
    backgroundColor: PRIMARY,
    padding: 24,
    alignItems: 'center',
    paddingTop: 16,
  },
  avatar: {
    width: 84,
    height: 84,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: WHITE,
    marginTop: 12,
  },
  phone: {
    fontSize: 14,
    color: PRIMARY_LIGHT,
    marginTop: 4,
  },

  // ABHA badge
  abhaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  abhaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: PRIMARY_LIGHT,
  },
  abhaNumber: {
    fontSize: 13,
    color: WHITE,
    fontFamily: 'monospace',
  },
  abhaVerified: {
    backgroundColor: SUCCESS_MAIN,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  abhaVerifiedText: {
    fontSize: 8,
    fontWeight: '700',
    color: WHITE,
  },
  abhaLinkButton: {
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  abhaLinkButtonText: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '600',
  },

  // Sections
  section: { padding: 16, paddingBottom: 0 },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  editLink: {
    fontSize: 13,
    color: PRIMARY,
    fontWeight: '600',
    marginBottom: 8,
  },
  card: {
    backgroundColor: WHITE,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },

  // ABHA card
  abhaCard: {
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  abhaCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  abhaCardTitle: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    fontWeight: '500',
  },
  abhaCardNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    fontFamily: 'monospace',
    marginTop: 1,
  },
  abhaStatusBadge: {
    backgroundColor: SUCCESS_BG,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  abhaStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: SUCCESS_TEXT,
  },
  abhaCardDesc: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    lineHeight: 18,
    marginBottom: 12,
  },
  abhaActions: {
    flexDirection: 'row',
    gap: 10,
  },
  abhaActionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
  },
  abhaActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY,
  },

  // Medical history
  medHistoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  medHistoryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  allergyTag: {
    backgroundColor: CRITICAL_BG,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  allergyTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: CRITICAL_MAIN,
  },
  conditionTag: {
    backgroundColor: WARNING_BG,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  conditionTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: WARNING_TEXT,
  },
  familyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  familyRelation: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  familyCondition: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    maxWidth: '60%',
    textAlign: 'right',
  },
  surgeryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  surgeryName: {
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_PRIMARY,
  },
  surgeryYear: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },

  // Emergency contact
  emergencyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  emergencyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CRITICAL_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyName: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  emergencyRelation: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 1,
  },
  emergencyPhone: {
    fontSize: 13,
    color: PRIMARY,
    fontWeight: '500',
    marginTop: 2,
  },
  callButton: {
    backgroundColor: SUCCESS_BG,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  callButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: SUCCESS_TEXT,
  },

  // Settings
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  settingLabel: {
    flex: 1,
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  settingValue: {
    fontSize: 13,
    color: TEXT_DISABLED,
  },
  languagePicker: {
    backgroundColor: SURFACE,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  languageOptionActive: {
    backgroundColor: PRIMARY_BG,
  },
  languageOptionText: {
    fontSize: 14,
    color: TEXT_PRIMARY,
  },

  // Logout
  logoutButton: {
    padding: 16,
    backgroundColor: CRITICAL_BG,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: {
    color: CRITICAL_MAIN,
    fontWeight: '600',
    fontSize: 15,
  },

  // Version
  version: {
    textAlign: 'center',
    color: TEXT_DISABLED,
    fontSize: 11,
    marginTop: 16,
  },
});
