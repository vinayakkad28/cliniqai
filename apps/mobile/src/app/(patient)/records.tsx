import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useState } from 'react';

type RecordType = 'all' | 'prescriptions' | 'labs' | 'visits' | 'imaging';

const RECORDS = [
  { id: '1', type: 'prescription', title: 'Prescription - Dr. Sharma', date: '2026-03-05', description: 'Metformin 500mg, Amlodipine 5mg, Atorvastatin 10mg' },
  { id: '2', type: 'lab', title: 'Complete Blood Count', date: '2026-03-01', description: 'Hemoglobin: 14.2 g/dL, WBC: 7,200/uL - All normal' },
  { id: '3', type: 'visit', title: 'Follow-up Consultation', date: '2026-02-25', description: 'Blood sugar review - Type 2 Diabetes Management' },
  { id: '4', type: 'lab', title: 'HbA1c Test', date: '2026-02-20', description: 'HbA1c: 7.2% - Above target (goal <7%)' },
  { id: '5', type: 'imaging', title: 'Chest X-Ray', date: '2026-02-15', description: 'No abnormalities detected. Lungs clear.' },
  { id: '6', type: 'prescription', title: 'Prescription - Dr. Gupta', date: '2026-02-10', description: 'Omeprazole 20mg for gastritis' },
  { id: '7', type: 'visit', title: 'Initial Consultation', date: '2026-01-30', description: 'General checkup, BP elevated, started on Amlodipine' },
];

export default function HealthRecords() {
  const [filter, setFilter] = useState<RecordType>('all');

  const filtered = filter === 'all' ? RECORDS : RECORDS.filter((r) => {
    if (filter === 'prescriptions') return r.type === 'prescription';
    if (filter === 'labs') return r.type === 'lab';
    if (filter === 'visits') return r.type === 'visit';
    if (filter === 'imaging') return r.type === 'imaging';
    return true;
  });

  const typeIcons: Record<string, string> = {
    prescription: '💊',
    lab: '🔬',
    visit: '🩺',
    imaging: '📷',
  };

  const typeColors: Record<string, string> = {
    prescription: '#3b82f6',
    lab: '#8b5cf6',
    visit: '#10b981',
    imaging: '#f59e0b',
  };

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
        {(['all', 'prescriptions', 'labs', 'visits', 'imaging'] as RecordType[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Records List */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {filtered.map((record) => (
          <TouchableOpacity key={record.id} style={styles.recordCard}>
            <View style={[styles.recordIcon, { backgroundColor: typeColors[record.type] + '20' }]}>
              <Text style={{ fontSize: 20 }}>{typeIcons[record.type]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.recordTitle}>{record.title}</Text>
              <Text style={styles.recordDesc} numberOfLines={2}>{record.description}</Text>
              <Text style={styles.recordDate}>
                {new Date(record.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </View>
            <Text style={{ color: '#9ca3af', fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  filterContainer: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', maxHeight: 56 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f3f4f6', marginRight: 8 },
  filterTabActive: { backgroundColor: '#1d4ed8' },
  filterText: { fontSize: 13, fontWeight: '500', color: '#6b7280' },
  filterTextActive: { color: '#ffffff' },
  recordCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#ffffff', marginHorizontal: 16, marginTop: 8, padding: 16, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  recordIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  recordTitle: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  recordDesc: { fontSize: 12, color: '#6b7280', marginTop: 2, lineHeight: 16 },
  recordDate: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
});
