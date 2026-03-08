import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { colors, shadow, radius } from "../../theme";

const STATS = [
  { label: "Today's Patients", value: "24", trend: "+3" },
  { label: "Appointments", value: "18", trend: "2 left" },
  { label: "Revenue Today", value: "₹12,400", trend: "+8%" },
  { label: "Pending Labs", value: "5", trend: "" },
];

const UPCOMING = [
  { id: "1", time: "10:30 AM", name: "Priya Sharma", type: "Follow-up", status: "checked-in" },
  { id: "2", time: "11:00 AM", name: "Rahul Verma", type: "New Visit", status: "waiting" },
  { id: "3", time: "11:30 AM", name: "Anita Desai", type: "Lab Review", status: "scheduled" },
  { id: "4", time: "12:00 PM", name: "Vikram Singh", type: "Consultation", status: "scheduled" },
];

const ALERTS = [
  { id: "1", text: "Critical: SpO2 < 90% for patient Meena Patel", severity: "critical" },
  { id: "2", text: "Lab results ready for Rahul Verma (CBC)", severity: "info" },
  { id: "3", text: "Low stock: Amoxicillin 500mg (12 units left)", severity: "warning" },
];

function StatCard({ label, value, trend }: { label: string; value: string; trend: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {trend ? <Text style={styles.statTrend}>{trend}</Text> : null}
    </View>
  );
}

function AlertBadge({ severity }: { severity: string }) {
  const badgeColors: Record<string, string> = {
    critical: colors.critical.main,
    warning: colors.warning.main,
    info: colors.info.main,
  };
  return (
    <View style={[styles.alertBadge, { backgroundColor: badgeColors[severity] ?? colors.text.tertiary }]}>
      <Text style={styles.alertBadgeText}>{severity.toUpperCase()}</Text>
    </View>
  );
}

function StatusDot({ status }: { status: string }) {
  const dotColors: Record<string, string> = {
    "checked-in": colors.status.checkedIn,
    waiting: colors.status.waiting,
    scheduled: colors.status.scheduled,
  };
  return <View style={[styles.statusDot, { backgroundColor: dotColors[status] ?? colors.status.scheduled }]} />;
}

export default function DashboardScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1000); }} tintColor={colors.primary[600]} />}
    >
      <View style={styles.greetingRow}>
        <View>
          <Text style={styles.greeting}>{greeting()}, Doctor</Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </Text>
        </View>
        <TouchableOpacity style={styles.newPatientBtn} onPress={() => router.push("/patients")}>
          <Text style={styles.newPatientBtnText}>+ New Patient</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsGrid}>
        {STATS.map((s) => <StatCard key={s.label} {...s} />)}
      </View>

      {ALERTS.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alerts</Text>
          {ALERTS.map((a) => (
            <View key={a.id} style={styles.alertRow}>
              <AlertBadge severity={a.severity} />
              <Text style={styles.alertText} numberOfLines={2}>{a.text}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming</Text>
          <TouchableOpacity onPress={() => router.push("/appointments")}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>
        {UPCOMING.map((appt) => (
          <TouchableOpacity key={appt.id} style={styles.apptCard}>
            <View style={styles.apptTimeCol}>
              <Text style={styles.apptTime}>{appt.time}</Text>
              <StatusDot status={appt.status} />
            </View>
            <View style={styles.apptInfo}>
              <Text style={styles.apptName}>{appt.name}</Text>
              <Text style={styles.apptType}>{appt.type}</Text>
            </View>
            <Text style={styles.apptStatus}>{appt.status.replace("-", " ")}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          {[
            { label: "Start Consult", icon: "🩺" },
            { label: "Walk-in", icon: "🚶" },
            { label: "View Labs", icon: "🧪" },
            { label: "Pharmacy", icon: "💊" },
          ].map((action) => (
            <TouchableOpacity key={action.label} style={styles.actionBtn}>
              <Text style={styles.actionIcon}>{action.icon}</Text>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  greetingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  greeting: { fontSize: 22, fontWeight: "700", color: colors.text.primary },
  date: { fontSize: 13, color: colors.text.tertiary, marginTop: 2 },
  newPatientBtn: { backgroundColor: colors.primary[600], paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.md },
  newPatientBtnText: { color: colors.white, fontSize: 13, fontWeight: "600" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, marginTop: 12 },
  statCard: { width: "48%", backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, margin: "1%", ...shadow.sm },
  statValue: { fontSize: 24, fontWeight: "700", color: colors.text.primary },
  statLabel: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  statTrend: { fontSize: 11, color: colors.success.text, marginTop: 4, fontWeight: "500" },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text.primary, marginBottom: 10 },
  seeAll: { fontSize: 13, color: colors.primary[600], fontWeight: "600" },
  alertRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, padding: 12, borderRadius: radius.md, marginBottom: 8, gap: 10 },
  alertBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  alertBadgeText: { color: colors.white, fontSize: 9, fontWeight: "700" },
  alertText: { flex: 1, fontSize: 13, color: colors.text.secondary },
  apptCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, padding: 14, borderRadius: radius.lg, marginBottom: 8, ...shadow.sm },
  apptTimeCol: { alignItems: "center", width: 70 },
  apptTime: { fontSize: 13, fontWeight: "600", color: colors.text.secondary },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  apptInfo: { flex: 1, marginLeft: 12 },
  apptName: { fontSize: 15, fontWeight: "600", color: colors.text.primary },
  apptType: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  apptStatus: { fontSize: 11, color: colors.text.tertiary, textTransform: "capitalize" },
  actionsRow: { flexDirection: "row", justifyContent: "space-between" },
  actionBtn: { alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, width: "23%", ...shadow.sm },
  actionIcon: { fontSize: 24 },
  actionLabel: { fontSize: 10, color: colors.text.secondary, fontWeight: "600", marginTop: 6, textAlign: "center" },
});
