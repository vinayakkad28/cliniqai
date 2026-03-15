import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
} from 'react-native';
import { useState } from 'react';

// ── Design tokens ───────────────────────────────────────────────────────────
const PRIMARY = '#2563EB';
const PRIMARY_LIGHT = '#DBEAFE';
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
const CRITICAL_TEXT = '#B91C1C';
const WARNING_MAIN = '#F97316';
const WARNING_BG = '#FFF7ED';
const WARNING_TEXT = '#C2410C';
const INFO_MAIN = '#3B82F6';

// ── Interfaces ──────────────────────────────────────────────────────────────

interface Medication {
  id: string;
  name: string;
  dose: string;
  frequency: string;
  duration: string;
  durationRemaining: string;
  prescribedBy: string;
  startDate: string;
  endDate: string;
  refillStatus: 'available' | 'pending' | 'not_needed';
  reminders: { time: string; taken: boolean }[];
  active: boolean;
  instructions: string;
}

// ── Mock data ───────────────────────────────────────────────────────────────

const MEDICATIONS: Medication[] = [
  {
    id: '1',
    name: 'Metformin',
    dose: '500mg',
    frequency: 'Twice daily after meals',
    duration: '3 months',
    durationRemaining: '45 days',
    prescribedBy: 'Dr. Rajesh Sharma',
    startDate: '2026-02-01',
    endDate: '2026-05-01',
    refillStatus: 'available',
    reminders: [
      { time: '08:00 AM', taken: true },
      { time: '08:00 PM', taken: false },
    ],
    active: true,
    instructions: 'Take with food. Avoid alcohol. Monitor blood sugar.',
  },
  {
    id: '2',
    name: 'Amlodipine',
    dose: '5mg',
    frequency: 'Once daily morning',
    duration: '3 months',
    durationRemaining: '45 days',
    prescribedBy: 'Dr. Rajesh Sharma',
    startDate: '2026-02-01',
    endDate: '2026-05-01',
    refillStatus: 'pending',
    reminders: [{ time: '09:00 AM', taken: true }],
    active: true,
    instructions: 'Take at the same time each day. May cause dizziness.',
  },
  {
    id: '3',
    name: 'Atorvastatin',
    dose: '10mg',
    frequency: 'Once daily at night',
    duration: '6 months',
    durationRemaining: '128 days',
    prescribedBy: 'Dr. Rajesh Sharma',
    startDate: '2026-01-15',
    endDate: '2026-07-15',
    refillStatus: 'not_needed',
    reminders: [{ time: '09:00 PM', taken: false }],
    active: true,
    instructions: 'Take at bedtime. Avoid grapefruit juice.',
  },
  {
    id: '4',
    name: 'Omeprazole',
    dose: '20mg',
    frequency: 'Once daily before breakfast',
    duration: '14 days',
    durationRemaining: '0 days',
    prescribedBy: 'Dr. Priya Gupta',
    startDate: '2026-02-10',
    endDate: '2026-02-24',
    refillStatus: 'not_needed',
    reminders: [],
    active: false,
    instructions: 'Take 30 minutes before breakfast on empty stomach.',
  },
  {
    id: '5',
    name: 'Amoxicillin',
    dose: '500mg',
    frequency: 'Three times daily',
    duration: '7 days',
    durationRemaining: '0 days',
    prescribedBy: 'Dr. Amit Patel',
    startDate: '2026-01-10',
    endDate: '2026-01-17',
    refillStatus: 'not_needed',
    reminders: [],
    active: false,
    instructions: 'Complete the full course. Take with or without food.',
  },
];

// ── Drug interaction warning (mock) ─────────────────────────────────────────

const DRUG_INTERACTIONS = [
  {
    id: '1',
    drugs: 'Metformin + Amlodipine',
    severity: 'mild' as const,
    message:
      'Minor interaction: Amlodipine may slightly increase blood sugar levels. Monitor glucose closely.',
  },
];

// ── Refill config ───────────────────────────────────────────────────────────

const REFILL_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  available: { label: 'Refill Available', color: SUCCESS_TEXT, bg: SUCCESS_BG },
  pending: { label: 'Refill Pending', color: WARNING_TEXT, bg: WARNING_BG },
  not_needed: { label: 'No Refill Needed', color: TEXT_DISABLED, bg: BORDER_LIGHT },
};

// ── Component ───────────────────────────────────────────────────────────────

export default function MedicationsScreen() {
  const [showPastMeds, setShowPastMeds] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(true);

  const activeMeds = MEDICATIONS.filter((m) => m.active);
  const pastMeds = MEDICATIONS.filter((m) => !m.active);

  const takenToday = activeMeds.reduce(
    (acc, m) => acc + m.reminders.filter((r) => r.taken).length,
    0
  );
  const totalToday = activeMeds.reduce(
    (acc, m) => acc + m.reminders.length,
    0
  );
  const progressPercent =
    totalToday > 0 ? Math.round((takenToday / totalToday) * 100) : 0;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* ── Drug Interaction Warning Banner ── */}
      {DRUG_INTERACTIONS.length > 0 && (
        <View style={styles.warningBanner}>
          <Text style={{ fontSize: 16 }}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.warningTitle}>Drug Interaction Alert</Text>
            {DRUG_INTERACTIONS.map((interaction) => (
              <Text key={interaction.id} style={styles.warningText}>
                {interaction.drugs}: {interaction.message}
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* ── Medication Reminder Toggle ── */}
      <View style={styles.reminderBar}>
        <View>
          <Text style={styles.reminderTitle}>Medication Reminders</Text>
          <Text style={styles.reminderSubtext}>
            Get notified when it's time to take your medicine
          </Text>
        </View>
        <Switch
          value={remindersEnabled}
          onValueChange={setRemindersEnabled}
          trackColor={{ false: BORDER, true: PRIMARY_LIGHT }}
          thumbColor={remindersEnabled ? PRIMARY : TEXT_DISABLED}
        />
      </View>

      {/* ── Today's Progress ── */}
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Today's Progress</Text>
          <Text style={styles.progressPercent}>{progressPercent}%</Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[styles.progressFill, { width: `${progressPercent}%` }]}
          />
        </View>
        <Text style={styles.progressText}>
          {takenToday} of {totalToday} doses taken
        </Text>
      </View>

      {/* ── Active Medications ── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          Active Medications ({activeMeds.length})
        </Text>
      </View>

      {activeMeds.map((med) => {
        const refill = REFILL_CONFIG[med.refillStatus];
        return (
          <View key={med.id} style={styles.medCard}>
            {/* Header */}
            <View style={styles.medHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.medName}>
                  {med.name} {med.dose}
                </Text>
                <Text style={styles.medFreq}>{med.frequency}</Text>
              </View>
              <View
                style={[styles.statusBadge, { backgroundColor: SUCCESS_BG }]}
              >
                <Text style={[styles.statusText, { color: SUCCESS_TEXT }]}>
                  Active
                </Text>
              </View>
            </View>

            {/* Details Grid */}
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Duration</Text>
                <Text style={styles.detailValue}>{med.duration}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Remaining</Text>
                <Text style={styles.detailValue}>{med.durationRemaining}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Prescribed By</Text>
                <Text style={styles.detailValue}>{med.prescribedBy}</Text>
              </View>
            </View>

            {/* Refill Status */}
            <View style={styles.refillRow}>
              <View
                style={[styles.refillBadge, { backgroundColor: refill.bg }]}
              >
                <Text style={[styles.refillText, { color: refill.color }]}>
                  {refill.label}
                </Text>
              </View>
              {med.refillStatus === 'available' && (
                <TouchableOpacity style={styles.refillButton}>
                  <Text style={styles.refillButtonText}>Request Refill</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Instructions */}
            <View style={styles.instructionsRow}>
              <Text style={{ fontSize: 12 }}>📝</Text>
              <Text style={styles.instructionsText}>{med.instructions}</Text>
            </View>

            {/* Reminder Toggles / Taken Status */}
            {med.reminders.length > 0 && (
              <View style={styles.reminderSection}>
                <Text style={styles.reminderSectionTitle}>
                  Today's Reminders
                </Text>
                {med.reminders.map((r, i) => (
                  <View key={i} style={styles.reminderRow}>
                    <View style={styles.reminderTimeRow}>
                      <Text style={{ fontSize: 14 }}>⏰</Text>
                      <Text style={styles.reminderTime}>{r.time}</Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.takenButton,
                        r.taken && styles.takenButtonDone,
                      ]}
                    >
                      <Text
                        style={[
                          styles.takenText,
                          r.taken && { color: WHITE },
                        ]}
                      >
                        {r.taken ? '✓ Taken' : 'Mark Taken'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}

      {/* ── Past Medications (Collapsible) ── */}
      <TouchableOpacity
        style={styles.pastMedsToggle}
        onPress={() => setShowPastMeds(!showPastMeds)}
      >
        <Text style={styles.pastMedsToggleText}>
          Past Medications ({pastMeds.length})
        </Text>
        <Text style={styles.pastMedsArrow}>
          {showPastMeds ? '▴' : '▾'}
        </Text>
      </TouchableOpacity>

      {showPastMeds &&
        pastMeds.map((med) => (
          <View key={med.id} style={[styles.medCard, { opacity: 0.7 }]}>
            <View style={styles.medHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.medName}>
                  {med.name} {med.dose}
                </Text>
                <Text style={styles.medFreq}>{med.frequency}</Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: BORDER_LIGHT },
                ]}
              >
                <Text
                  style={[styles.statusText, { color: TEXT_DISABLED }]}
                >
                  Completed
                </Text>
              </View>
            </View>
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Duration</Text>
                <Text style={styles.detailValue}>{med.duration}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Prescribed By</Text>
                <Text style={styles.detailValue}>{med.prescribedBy}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Period</Text>
                <Text style={styles.detailValue}>
                  {med.startDate} to {med.endDate}
                </Text>
              </View>
            </View>
          </View>
        ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SURFACE },

  // Drug interaction warning
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: WARNING_BG,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FED7AA',
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: WARNING_TEXT,
    marginBottom: 2,
  },
  warningText: {
    fontSize: 12,
    color: WARNING_TEXT,
    lineHeight: 17,
  },

  // Reminder bar
  reminderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: WHITE,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  reminderTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  reminderSubtext: {
    fontSize: 12,
    color: TEXT_DISABLED,
    marginTop: 1,
  },

  // Progress card
  progressCard: {
    margin: 16,
    backgroundColor: PRIMARY,
    borderRadius: 12,
    padding: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressTitle: {
    color: WHITE,
    fontWeight: '600',
    fontSize: 14,
  },
  progressPercent: {
    color: WHITE,
    fontWeight: '700',
    fontSize: 18,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: WHITE,
    borderRadius: 4,
  },
  progressText: {
    color: PRIMARY_LIGHT,
    fontSize: 12,
    marginTop: 8,
  },

  // Section header
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },

  // Medication cards
  medCard: {
    backgroundColor: WHITE,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  medHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  medName: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  medFreq: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Details grid
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER_LIGHT,
  },
  detailItem: {
    minWidth: '30%',
  },
  detailLabel: {
    fontSize: 10,
    color: TEXT_DISABLED,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 13,
    color: TEXT_PRIMARY,
    fontWeight: '500',
    marginTop: 2,
  },

  // Refill
  refillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  refillBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  refillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  refillButton: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  refillButtonText: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '600',
  },

  // Instructions
  instructionsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
    backgroundColor: SURFACE,
    padding: 10,
    borderRadius: 8,
  },
  instructionsText: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    lineHeight: 17,
    flex: 1,
  },

  // Reminders
  reminderSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER_LIGHT,
  },
  reminderSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reminderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reminderTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reminderTime: {
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_PRIMARY,
  },
  takenButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  takenButtonDone: {
    backgroundColor: SUCCESS_MAIN,
    borderColor: SUCCESS_MAIN,
  },
  takenText: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },

  // Past medications toggle
  pastMedsToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: WHITE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  pastMedsToggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  pastMedsArrow: {
    fontSize: 16,
    color: TEXT_DISABLED,
  },
});
