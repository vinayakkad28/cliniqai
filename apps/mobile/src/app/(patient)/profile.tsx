import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';

export default function PatientProfile() {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={{ fontSize: 40 }}>👤</Text>
        </View>
        <Text style={styles.name}>Ravi Kumar</Text>
        <Text style={styles.phone}>+91 98765 43210</Text>
        <View style={styles.abhaBar}>
          <Text style={styles.abhaLabel}>ABHA</Text>
          <Text style={styles.abhaNumber}>91-1234-5678-9012</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Personal Information</Text>
        <View style={styles.card}>
          <InfoRow label="Date of Birth" value="15 Jan 1990" />
          <InfoRow label="Gender" value="Male" />
          <InfoRow label="Blood Group" value="B+" />
          <InfoRow label="Email" value="ravi@example.com" />
          <InfoRow label="Address" value="123, MG Road, Pune" />
          <InfoRow label="Emergency Contact" value="+91 87654 32109" />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Medical Information</Text>
        <View style={styles.card}>
          <InfoRow label="Allergies" value="Penicillin, Sulfa drugs" />
          <InfoRow label="Chronic Conditions" value="Type 2 Diabetes, Hypertension" />
          <InfoRow label="Current Medications" value="3 active" />
          <InfoRow label="Past Surgeries" value="Appendectomy (2018)" />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <MenuItem icon="🔒" label="Privacy Settings" />
          <MenuItem icon="🔔" label="Notification Preferences" />
          <MenuItem icon="🌐" label="Language" value="English" />
          <MenuItem icon="📱" label="Linked Devices" value="2 devices" />
          <MenuItem icon="📤" label="Export Health Records" />
          <MenuItem icon="❓" label="Help & Support" />
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
      <Text style={styles.version}>CliniqAI Patient App v1.0.0</Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function MenuItem({ icon, label, value }: { icon: string; label: string; value?: string }) {
  return (
    <TouchableOpacity style={styles.menuItem}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
      <Text style={styles.menuLabel}>{label}</Text>
      <Text style={styles.menuValue}>{value || '›'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.primary[600], padding: 24, alignItems: 'center', paddingTop: 16 },
  avatar: { width: 80, height: 80, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 22, fontWeight: 'bold', color: colors.white, marginTop: 12 },
  phone: { fontSize: 14, color: '#93c5fd', marginTop: 4 },
  abhaBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  abhaLabel: { fontSize: 10, fontWeight: '700', color: '#93c5fd' },
  abhaNumber: { fontSize: 13, color: colors.white, fontFamily: 'monospace' },
  section: { padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text.secondary, marginBottom: 8 },
  card: { backgroundColor: colors.white, borderRadius: 12, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  infoLabel: { fontSize: 13, color: colors.text.tertiary },
  infoValue: { fontSize: 13, fontWeight: '500', color: colors.text.secondary, maxWidth: '60%', textAlign: 'right' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  menuLabel: { flex: 1, fontSize: 14, color: colors.text.secondary },
  menuValue: { fontSize: 13, color: colors.text.disabled },
  logoutButton: { marginHorizontal: 16, marginTop: 8, padding: 16, backgroundColor: '#fef2f2', borderRadius: 12, alignItems: 'center' },
  logoutText: { color: colors.critical.main, fontWeight: '600', fontSize: 15 },
  version: { textAlign: 'center', color: colors.text.disabled, fontSize: 11, marginTop: 16 },
});
