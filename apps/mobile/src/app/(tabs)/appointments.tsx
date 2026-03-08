import { useState } from "react";
import { View, Text, StyleSheet, SectionList, TouchableOpacity, RefreshControl } from "react-native";
import { colors, shadow, radius } from "../../theme";

type ApptStatus = "checked-in" | "waiting" | "in-progress" | "completed" | "no-show";
interface Appointment { id: string; time: string; patient: string; type: string; status: ApptStatus; tokenNo: number; }
interface Section { title: string; data: Appointment[]; }

const SCHEDULE: Section[] = [
  { title: "In Progress", data: [{ id: "1", time: "10:00 AM", patient: "Priya Sharma", type: "Follow-up", status: "in-progress", tokenNo: 8 }] },
  { title: "Waiting", data: [
    { id: "2", time: "10:30 AM", patient: "Rahul Verma", type: "New Visit", status: "checked-in", tokenNo: 9 },
    { id: "3", time: "11:00 AM", patient: "Anita Desai", type: "Lab Review", status: "waiting", tokenNo: 10 },
  ]},
  { title: "Upcoming", data: [
    { id: "4", time: "11:30 AM", patient: "Vikram Singh", type: "Consultation", status: "waiting", tokenNo: 11 },
    { id: "5", time: "12:00 PM", patient: "Meena Patel", type: "Follow-up", status: "waiting", tokenNo: 12 },
    { id: "6", time: "12:30 PM", patient: "Arjun Nair", type: "New Visit", status: "waiting", tokenNo: 13 },
  ]},
  { title: "Completed", data: [
    { id: "7", time: "09:00 AM", patient: "Kavita Reddy", type: "Follow-up", status: "completed", tokenNo: 5 },
    { id: "8", time: "09:30 AM", patient: "Suresh Kumar", type: "Consultation", status: "completed", tokenNo: 6 },
    { id: "9", time: "09:45 AM", patient: "Deepa Iyer", type: "Lab Review", status: "no-show", tokenNo: 7 },
  ]},
];

const STATUS_COLORS: Record<ApptStatus, string> = {
  "checked-in": colors.status.checkedIn, waiting: colors.status.waiting,
  "in-progress": colors.status.inProgress, completed: colors.status.completed, "no-show": colors.status.noShow,
};

function AppointmentCard({ appt }: { appt: Appointment }) {
  const sc = STATUS_COLORS[appt.status];
  const isDone = appt.status === "completed" || appt.status === "no-show";
  return (
    <TouchableOpacity style={[styles.card, isDone && styles.cardDone]}>
      <View style={styles.tokenCol}>
        <Text style={[styles.tokenNo, { color: sc }]}>#{appt.tokenNo}</Text>
        <Text style={styles.cardTime}>{appt.time}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardName, isDone && styles.textDone]}>{appt.patient}</Text>
        <Text style={styles.cardType}>{appt.type}</Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: sc + "18" }]}>
        <Text style={[styles.statusText, { color: sc }]}>{appt.status.replace("-", " ")}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function AppointmentsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"today"|"tomorrow"|"week">("today");
  const totalToday = SCHEDULE.reduce((sum, s) => sum + s.data.length, 0);
  const completed = SCHEDULE.find((s) => s.title === "Completed")?.data.length ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        {(["today", "tomorrow", "week"] as const).map((tab) => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.summaryBar}>
        <Text style={styles.summaryText}>{completed}/{totalToday} seen</Text>
        <TouchableOpacity style={styles.walkInBtn}><Text style={styles.walkInBtnText}>+ Walk-in</Text></TouchableOpacity>
      </View>
      <SectionList sections={SCHEDULE} keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{section.title}</Text><Text style={styles.sectionCount}>{section.data.length}</Text></View>
        )}
        renderItem={({ item }) => <AppointmentCard appt={item} />}
        contentContainerStyle={styles.list} stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1000); }} tintColor={colors.primary[600]} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  tabRow: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.primary[600], borderColor: colors.primary[600] },
  tabText: { fontSize: 13, fontWeight: "600", color: colors.text.tertiary },
  tabTextActive: { color: colors.white },
  summaryBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10 },
  summaryText: { fontSize: 13, color: colors.text.tertiary },
  walkInBtn: { backgroundColor: colors.primary[100], paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.md },
  walkInBtnText: { fontSize: 12, color: colors.primary[700], fontWeight: "600" },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginTop: 12, marginBottom: 6, gap: 6 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text.secondary },
  sectionCount: { fontSize: 11, fontWeight: "600", color: colors.text.tertiary, backgroundColor: colors.borderLight, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.sm, overflow: "hidden" },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, marginBottom: 8, ...shadow.sm },
  cardDone: { opacity: 0.6 },
  tokenCol: { alignItems: "center", width: 52 },
  tokenNo: { fontSize: 16, fontWeight: "700" },
  cardTime: { fontSize: 11, color: colors.text.disabled, marginTop: 2 },
  cardBody: { flex: 1, marginLeft: 10 },
  cardName: { fontSize: 15, fontWeight: "600", color: colors.text.primary },
  textDone: { textDecorationLine: "line-through", color: colors.text.tertiary },
  cardType: { fontSize: 12, color: colors.text.tertiary, marginTop: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.md },
  statusText: { fontSize: 10, fontWeight: "700", textTransform: "capitalize" },
});
