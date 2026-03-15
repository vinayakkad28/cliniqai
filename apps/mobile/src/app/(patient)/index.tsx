import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';

// ── Design tokens ───────────────────────────────────────────────────────────
const PRIMARY = '#2563EB';
const PRIMARY_DARK = '#1D4ED8';
const PRIMARY_LIGHT = '#DBEAFE';
const PRIMARY_BG = '#EFF6FF';
const SURFACE = '#F8FAFC';
const WHITE = '#FFFFFF';
const TEXT_PRIMARY = '#0F172A';
const TEXT_SECONDARY = '#64748B';
const TEXT_DISABLED = '#94A3B8';
const BORDER_LIGHT = '#F1F5F9';
const SUCCESS_BG = '#F0FDF4';
const SUCCESS_TEXT = '#15803D';
const SUCCESS_MAIN = '#22C55E';
const INFO_BG = '#EFF6FF';
const INFO_TEXT = '#1D4ED8';
const WARNING_MAIN = '#F59E0B';
const SECONDARY_500 = '#6366F1';

// ── Mock data (replace with API calls) ──────────────────────────────────────

const PATIENT = { firstName: 'Ravi', lastName: 'Kumar' };

const UPCOMING_APPOINTMENTS = [
  {
    id: '1',
    doctor: 'Dr. Rajesh Sharma',
    specialty: 'General Medicine',
    date: '2026-03-12',
    time: '10:30 AM',
    type: 'Follow-up',
    status: 'confirmed' as const,
    tokenNo: 'T-014',
  },
  {
    id: '2',
    doctor: 'Dr. Priya Gupta',
    specialty: 'Dermatology',
    date: '2026-03-15',
    time: '02:00 PM',
    type: 'Consultation',
    status: 'scheduled' as const,
    tokenNo: 'T-008',
  },
  {
    id: '3',
    doctor: 'Dr. Amit Patel',
    specialty: 'Orthopedics',
    date: '2026-03-20',
    time: '11:00 AM',
    type: 'Telemedicine',
    status: 'scheduled' as const,
    tokenNo: 'T-003',
  },
];

const ACTIVE_PRESCRIPTIONS = [
  { id: '1', name: 'Metformin 500mg', frequency: 'Twice daily', remaining: '45 days' },
  { id: '2', name: 'Amlodipine 5mg', frequency: 'Once daily', remaining: '45 days' },
  { id: '3', name: 'Atorvastatin 10mg', frequency: 'Once at night', remaining: '90 days' },
];

const HEALTH_TIPS = [
  {
    id: '1',
    icon: '🥗',
    title: 'Balanced Diet',
    tip: 'Include fiber-rich foods to manage blood sugar levels effectively.',
  },
  {
    id: '2',
    icon: '🚶',
    title: 'Stay Active',
    tip: 'Aim for 30 minutes of moderate exercise daily for heart health.',
  },
  {
    id: '3',
    icon: '💧',
    title: 'Stay Hydrated',
    tip: 'Drink at least 8 glasses of water daily to support kidney function.',
  },
  {
    id: '4',
    icon: '😴',
    title: 'Quality Sleep',
    tip: 'Get 7-8 hours of sleep. Poor sleep affects blood sugar control.',
  },
];

// ── Status color map ────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  confirmed: { bg: SUCCESS_BG, text: SUCCESS_TEXT },
  scheduled: { bg: INFO_BG, text: INFO_TEXT },
  cancelled: { bg: '#FEF2F2', text: '#B91C1C' },
};

// ── Component ───────────────────────────────────────────────────────────────

export default function PatientHome() {
  const router = useRouter();
  const [greeting, setGreeting] = useState('Good Morning');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 17) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={PRIMARY}
        />
      }
    >
      {/* ── Welcome Banner ── */}
      <View style={styles.welcomeBanner}>
        <View style={styles.welcomeRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetingText}>{greeting},</Text>
            <Text style={styles.patientName}>
              {PATIENT.firstName} {PATIENT.lastName}
            </Text>
            <Text style={styles.welcomeSub}>Stay on top of your health</Text>
          </View>
          <View style={styles.avatarCircle}>
            <Text style={{ fontSize: 32 }}>👤</Text>
          </View>
        </View>
      </View>

      {/* ── Quick Action Cards ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          <QuickAction
            icon="📅"
            label="Book Appointment"
            color={PRIMARY}
            onPress={() => router.push('/(patient)/book')}
          />
          <QuickAction
            icon="📋"
            label="My Records"
            color={SECONDARY_500}
            onPress={() => router.push('/(patient)/records')}
          />
          <QuickAction
            icon="💊"
            label="Medications"
            color={SUCCESS_MAIN}
            onPress={() => router.push('/(patient)/medications')}
          />
          <QuickAction
            icon="🔍"
            label="Find Doctor"
            color={WARNING_MAIN}
            onPress={() => router.push('/(patient)/book')}
          />
        </View>
      </View>

      {/* ── Upcoming Appointments ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
          <TouchableOpacity onPress={() => router.push('/(patient)/book')}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>
        {UPCOMING_APPOINTMENTS.map((appt) => {
          const d = new Date(appt.date);
          const dayNum = d.getDate();
          const monthStr = d
            .toLocaleDateString('en-IN', { month: 'short' })
            .toUpperCase();
          const sc = STATUS_COLORS[appt.status] || STATUS_COLORS.scheduled;
          return (
            <View key={appt.id} style={styles.appointmentCard}>
              <View style={styles.dateBox}>
                <Text style={styles.dateDay}>{dayNum}</Text>
                <Text style={styles.dateMonth}>{monthStr}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.doctorName}>{appt.doctor}</Text>
                <Text style={styles.specialty}>{appt.specialty}</Text>
                <View style={styles.apptMeta}>
                  <Text style={styles.apptTime}>{appt.time}</Text>
                  <View style={styles.dotSeparator} />
                  <Text style={styles.apptType}>{appt.type}</Text>
                  <View style={styles.dotSeparator} />
                  <Text style={styles.apptToken}>{appt.tokenNo}</Text>
                </View>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                <Text style={[styles.statusText, { color: sc.text }]}>
                  {appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* ── Active Prescriptions Summary ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Prescriptions</Text>
          <TouchableOpacity
            onPress={() => router.push('/(patient)/medications')}
          >
            <Text style={styles.seeAll}>View All</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.prescriptionsCard}>
          <View style={styles.prescriptionHeader}>
            <Text style={{ fontSize: 20 }}>💊</Text>
            <Text style={styles.prescriptionCount}>
              {ACTIVE_PRESCRIPTIONS.length} Active Medications
            </Text>
          </View>
          {ACTIVE_PRESCRIPTIONS.map((rx, idx) => (
            <View
              key={rx.id}
              style={[
                styles.prescriptionRow,
                idx === ACTIVE_PRESCRIPTIONS.length - 1 && {
                  borderBottomWidth: 0,
                },
              ]}
            >
              <View style={styles.rxDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rxName}>{rx.name}</Text>
                <Text style={styles.rxFreq}>{rx.frequency}</Text>
              </View>
              <Text style={styles.rxRemaining}>{rx.remaining}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Health Tips ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Health Tips</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {HEALTH_TIPS.map((tip) => (
            <View key={tip.id} style={styles.tipCard}>
              <Text style={{ fontSize: 28 }}>{tip.icon}</Text>
              <Text style={styles.tipTitle}>{tip.title}</Text>
              <Text style={styles.tipText}>{tip.tip}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function QuickAction({
  icon,
  label,
  color,
  onPress,
}: {
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.quickAction, { backgroundColor: color + '12' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[styles.quickActionIcon, { backgroundColor: color + '20' }]}
      >
        <Text style={{ fontSize: 24 }}>{icon}</Text>
      </View>
      <Text style={[styles.quickActionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SURFACE },

  // Welcome banner
  welcomeBanner: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greetingText: {
    fontSize: 14,
    color: PRIMARY_LIGHT,
    fontWeight: '500',
  },
  patientName: {
    fontSize: 24,
    fontWeight: '700',
    color: WHITE,
    marginTop: 2,
  },
  welcomeSub: {
    fontSize: 13,
    color: PRIMARY_LIGHT,
    marginTop: 4,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sections
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 12,
  },
  seeAll: {
    fontSize: 13,
    color: PRIMARY,
    fontWeight: '600',
    marginBottom: 12,
  },

  // Quick actions
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAction: {
    width: '47%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 10,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Appointment cards
  appointmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: WHITE,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  dateBox: {
    width: 48,
    height: 52,
    backgroundColor: INFO_BG,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: { fontSize: 18, fontWeight: '700', color: PRIMARY },
  dateMonth: { fontSize: 10, color: PRIMARY_DARK, fontWeight: '600' },
  doctorName: { fontSize: 14, fontWeight: '600', color: TEXT_PRIMARY },
  specialty: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 1 },
  apptMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  apptTime: { fontSize: 11, color: TEXT_DISABLED, fontWeight: '500' },
  apptType: { fontSize: 11, color: TEXT_DISABLED },
  apptToken: { fontSize: 11, color: PRIMARY, fontWeight: '600' },
  dotSeparator: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: TEXT_DISABLED,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: { fontSize: 10, fontWeight: '600' },

  // Prescriptions
  prescriptionsCard: {
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  prescriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  prescriptionCount: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  prescriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  rxDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SUCCESS_MAIN,
  },
  rxName: { fontSize: 14, fontWeight: '500', color: TEXT_PRIMARY },
  rxFreq: { fontSize: 12, color: TEXT_DISABLED, marginTop: 1 },
  rxRemaining: { fontSize: 11, color: TEXT_SECONDARY, fontWeight: '500' },

  // Health tips
  tipCard: {
    width: 200,
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginTop: 8,
  },
  tipText: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 4,
    lineHeight: 18,
  },
});
