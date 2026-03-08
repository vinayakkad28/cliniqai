import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { useState } from 'react';

interface Medication {
  id: string;
  name: string;
  dose: string;
  frequency: string;
  duration: string;
  prescribedBy: string;
  startDate: string;
  endDate: string;
  reminders: { time: string; taken: boolean }[];
  active: boolean;
}

const MEDICATIONS: Medication[] = [
  {
    id: '1', name: 'Metformin', dose: '500mg', frequency: 'Twice daily', duration: '3 months',
    prescribedBy: 'Dr. Sharma', startDate: '2026-02-01', endDate: '2026-05-01',
    reminders: [{ time: '08:00 AM', taken: true }, { time: '08:00 PM', taken: false }], active: true,
  },
  {
    id: '2', name: 'Amlodipine', dose: '5mg', frequency: 'Once daily', duration: '3 months',
    prescribedBy: 'Dr. Sharma', startDate: '2026-02-01', endDate: '2026-05-01',
    reminders: [{ time: '09:00 AM', taken: true }], active: true,
  },
  {
    id: '3', name: 'Atorvastatin', dose: '10mg', frequency: 'Once daily at night', duration: '6 months',
    prescribedBy: 'Dr. Sharma', startDate: '2026-01-15', endDate: '2026-07-15',
    reminders: [{ time: '09:00 PM', taken: false }], active: true,
  },
  {
    id: '4', name: 'Omeprazole', dose: '20mg', frequency: 'Once daily before breakfast', duration: '14 days',
    prescribedBy: 'Dr. Gupta', startDate: '2026-02-10', endDate: '2026-02-24',
    reminders: [], active: false,
  },
];

export default function MedicationsScreen() {
  const [showInactive, setShowInactive] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(true);

  const displayed = showInactive ? MEDICATIONS : MEDICATIONS.filter((m) => m.active);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Reminder Toggle */}
      <View style={styles.reminderBar}>
        <View>
          <Text style={styles.reminderTitle}>Medication Reminders</Text>
          <Text style={styles.reminderSubtext}>Get notified when it's time</Text>
        </View>
        <Switch value={remindersEnabled} onValueChange={setRemindersEnabled} trackColor={{ true: colors.info.main }} />
      </View>

      {/* Today's Progress */}
      <View style={styles.progressCard}>
        <Text style={styles.progressTitle}>Today's Progress</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '60%' }]} />
        </View>
        <Text style={styles.progressText}>3 of 5 doses taken</Text>
      </View>

      {/* Filter */}
      <View style={styles.filterRow}>
        <Text style={styles.sectionTitle}>My Medications</Text>
        <TouchableOpacity onPress={() => setShowInactive(!showInactive)}>
          <Text style={styles.filterLink}>{showInactive ? 'Active Only' : 'Show All'}</Text>
        </TouchableOpacity>
      </View>

      {/* Medication Cards */}
      {displayed.map((med) => (
        <View key={med.id} style={[styles.medCard, !med.active && { opacity: 0.6 }]}>
          <View style={styles.medHeader}>
            <View>
              <Text style={styles.medName}>{med.name} {med.dose}</Text>
              <Text style={styles.medFreq}>{med.frequency}</Text>
            </View>
            <View style={[styles.activeBadge, { backgroundColor: med.active ? colors.success.bg : colors.borderLight }]}>
              <Text style={[styles.activeText, { color: med.active ? colors.success.text : colors.text.disabled }]}>
                {med.active ? 'Active' : 'Completed'}
              </Text>
            </View>
          </View>

          <View style={styles.medDetails}>
            <Text style={styles.medDetail}>Duration: {med.duration}</Text>
            <Text style={styles.medDetail}>By: {med.prescribedBy}</Text>
            <Text style={styles.medDetail}>
              {med.startDate} to {med.endDate}
            </Text>
          </View>

          {med.active && med.reminders.length > 0 && (
            <View style={styles.reminderSection}>
              {med.reminders.map((r, i) => (
                <View key={i} style={styles.reminderRow}>
                  <Text style={styles.reminderTime}>{r.time}</Text>
                  <TouchableOpacity style={[styles.takenButton, r.taken && styles.takenButtonDone]}>
                    <Text style={[styles.takenText, r.taken && { color: colors.white }]}>
                      {r.taken ? '✓ Taken' : 'Mark Taken'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  reminderBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.white, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  reminderTitle: { fontSize: 15, fontWeight: '600', color: colors.text.secondary },
  reminderSubtext: { fontSize: 12, color: colors.text.disabled },
  progressCard: { margin: 16, backgroundColor: colors.primary[600], borderRadius: 12, padding: 16 },
  progressTitle: { color: colors.white, fontWeight: '600', fontSize: 14, marginBottom: 8 },
  progressBar: { height: 8, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.white, borderRadius: 4 },
  progressText: { color: '#93c5fd', fontSize: 12, marginTop: 6 },
  filterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text.secondary },
  filterLink: { color: colors.info.main, fontSize: 13, fontWeight: '500' },
  medCard: { backgroundColor: colors.white, marginHorizontal: 16, marginTop: 12, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  medHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  medName: { fontSize: 16, fontWeight: '600', color: colors.text.secondary },
  medFreq: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  activeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  activeText: { fontSize: 11, fontWeight: '600' },
  medDetails: { flexDirection: 'row', gap: 12, marginTop: 8, flexWrap: 'wrap' },
  medDetail: { fontSize: 11, color: colors.text.disabled },
  reminderSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderLight },
  reminderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reminderTime: { fontSize: 14, fontWeight: '500', color: colors.text.secondary },
  takenButton: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  takenButtonDone: { backgroundColor: colors.success.main, borderColor: colors.success.main },
  takenText: { fontSize: 12, fontWeight: '600', color: colors.text.secondary },
});
