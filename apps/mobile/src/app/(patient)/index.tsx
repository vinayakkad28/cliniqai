import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';

export default function PatientHome() {
  const router = useRouter();
  const [greeting, setGreeting] = useState('Good Morning');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 17) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Greeting */}
      <View style={styles.greetingCard}>
        <Text style={styles.greetingText}>{greeting}!</Text>
        <Text style={styles.greetingSubtext}>Stay on top of your health</Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <QuickAction icon="📅" label="Book Appointment" onPress={() => router.push('/(patient)/book')} color="#3b82f6" />
          <QuickAction icon="💊" label="My Medicines" onPress={() => router.push('/(patient)/medications')} color="#10b981" />
          <QuickAction icon="🔬" label="Lab Reports" onPress={() => router.push('/(patient)/records')} color="#8b5cf6" />
          <QuickAction icon="📞" label="Video Consult" onPress={() => {}} color="#f59e0b" />
        </View>
      </View>

      {/* Upcoming Appointments */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
        <View style={styles.card}>
          <View style={styles.appointmentRow}>
            <View style={styles.dateBox}>
              <Text style={styles.dateDay}>12</Text>
              <Text style={styles.dateMonth}>MAR</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.doctorName}>Dr. Sharma</Text>
              <Text style={styles.specialty}>General Medicine</Text>
              <Text style={styles.time}>10:30 AM - 11:00 AM</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: '#dbeafe' }]}>
              <Text style={[styles.statusText, { color: '#1d4ed8' }]}>Confirmed</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Medication Reminders */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today's Medications</Text>
        <View style={styles.card}>
          <MedicationItem name="Metformin 500mg" time="8:00 AM" status="taken" />
          <MedicationItem name="Amlodipine 5mg" time="9:00 AM" status="taken" />
          <MedicationItem name="Atorvastatin 10mg" time="9:00 PM" status="upcoming" />
        </View>
      </View>

      {/* Health Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Health Summary</Text>
        <View style={styles.healthGrid}>
          <View style={[styles.healthCard, { backgroundColor: '#fef2f2' }]}>
            <Text style={{ fontSize: 24 }}>❤️</Text>
            <Text style={styles.healthValue}>72</Text>
            <Text style={styles.healthLabel}>Heart Rate</Text>
          </View>
          <View style={[styles.healthCard, { backgroundColor: '#eff6ff' }]}>
            <Text style={{ fontSize: 24 }}>🩸</Text>
            <Text style={styles.healthValue}>120/80</Text>
            <Text style={styles.healthLabel}>Blood Pressure</Text>
          </View>
          <View style={[styles.healthCard, { backgroundColor: '#f0fdf4' }]}>
            <Text style={{ fontSize: 24 }}>🩺</Text>
            <Text style={styles.healthValue}>98%</Text>
            <Text style={styles.healthLabel}>SpO2</Text>
          </View>
          <View style={[styles.healthCard, { backgroundColor: '#fefce8' }]}>
            <Text style={{ fontSize: 24 }}>🌡️</Text>
            <Text style={styles.healthValue}>37.0</Text>
            <Text style={styles.healthLabel}>Temperature</Text>
          </View>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function QuickAction({ icon, label, onPress, color }: { icon: string; label: string; onPress: () => void; color: string }) {
  return (
    <TouchableOpacity style={[styles.quickAction, { backgroundColor: color + '15' }]} onPress={onPress}>
      <Text style={{ fontSize: 28 }}>{icon}</Text>
      <Text style={[styles.quickActionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function MedicationItem({ name, time, status }: { name: string; time: string; status: 'taken' | 'upcoming' | 'missed' }) {
  return (
    <View style={styles.medItem}>
      <View style={[styles.medDot, { backgroundColor: status === 'taken' ? '#10b981' : status === 'missed' ? '#ef4444' : '#f59e0b' }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.medName}>{name}</Text>
        <Text style={styles.medTime}>{time}</Text>
      </View>
      <Text style={[styles.medStatus, { color: status === 'taken' ? '#10b981' : status === 'missed' ? '#ef4444' : '#9ca3af' }]}>
        {status === 'taken' ? '✓ Taken' : status === 'missed' ? '✗ Missed' : 'Upcoming'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  greetingCard: { backgroundColor: '#1d4ed8', padding: 24, paddingTop: 16 },
  greetingText: { fontSize: 26, fontWeight: 'bold', color: '#ffffff' },
  greetingSubtext: { fontSize: 14, color: '#93c5fd', marginTop: 4 },
  section: { padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937', marginBottom: 12 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickAction: { width: '47%', padding: 16, borderRadius: 12, alignItems: 'center', gap: 8 },
  quickActionLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  card: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  appointmentRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateBox: { width: 48, height: 48, backgroundColor: '#eff6ff', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontSize: 18, fontWeight: 'bold', color: '#1d4ed8' },
  dateMonth: { fontSize: 10, color: '#60a5fa', fontWeight: '600' },
  doctorName: { fontSize: 15, fontWeight: '600', color: '#1f2937' },
  specialty: { fontSize: 12, color: '#6b7280' },
  time: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '600' },
  medItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  medDot: { width: 8, height: 8, borderRadius: 4 },
  medName: { fontSize: 14, fontWeight: '500', color: '#1f2937' },
  medTime: { fontSize: 12, color: '#9ca3af' },
  medStatus: { fontSize: 12, fontWeight: '500' },
  healthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  healthCard: { width: '47%', padding: 16, borderRadius: 12, alignItems: 'center', gap: 6 },
  healthValue: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  healthLabel: { fontSize: 11, color: '#6b7280' },
});
