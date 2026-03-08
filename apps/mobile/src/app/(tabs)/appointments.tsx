import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";

const BLUE = "#1d4ed8";

type ApptStatus = "checked-in" | "waiting" | "in-progress" | "completed" | "no-show";

interface Appointment {
  id: string;
  time: string;
  patient: string;
  type: string;
  status: ApptStatus;
  tokenNo: number;
}

interface Section {
  title: string;
  data: Appointment[];
}

const SCHEDULE: Section[] = [
  {
    title: "In Progress",
    data: [
      { id: "1", time: "10:00 AM", patient: "Priya Sharma", type: "Follow-up", status: "in-progress", tokenNo: 8 },
    ],
  },
  {
    title: "Waiting",
    data: [
      { id: "2", time: "10:30 AM", patient: "Rahul Verma", type: "New Visit", status: "checked-in", tokenNo: 9 },
      { id: "3", time: "11:00 AM", patient: "Anita Desai", type: "Lab Review", status: "waiting", tokenNo: 10 },
    ],
  },
  {
    title: "Upcoming",
    data: [
      { id: "4", time: "11:30 AM", patient: "Vikram Singh", type: "Consultation", status: "waiting", tokenNo: 11 },
      { id: "5", time: "12:00 PM", patient: "Meena Patel", type: "Follow-up", status: "waiting", tokenNo: 12 },
      { id: "6", time: "12:30 PM", patient: "Arjun Nair", type: "New Visit", status: "waiting", tokenNo: 13 },
    ],
  },
  {
    title: "Completed",
    data: [
      { id: "7", time: "09:00 AM", patient: "Kavita Reddy", type: "Follow-up", status: "completed", tokenNo: 5 },
      { id: "8", time: "09:30 AM", patient: "Suresh Kumar", type: "Consultation", status: "completed", tokenNo: 6 },
      { id: "9", time: "09:45 AM", patient: "Deepa Iyer", type: "Lab Review", status: "no-show", tokenNo: 7 },
    ],
  },
];

const STATUS_COLORS: Record<ApptStatus, string> = {
  "checked-in": "#16a34a",
  waiting: "#f59e0b",
  "in-progress": BLUE,
  completed: "#6b7280",
  "no-show": "#dc2626",
};

function AppointmentCard({ appt }: { appt: Appointment }) {
  const statusColor = STATUS_COLORS[appt.status];
  const isDone = appt.status === "completed" || appt.status === "no-show";

  return (
    <TouchableOpacity style={[styles.card, isDone && styles.cardDone]}>
      <View style={styles.tokenCol}>
        <Text style={[styles.tokenNo, { color: statusColor }]}>#{appt.tokenNo}</Text>
        <Text style={styles.cardTime}>{appt.time}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardName, isDone && styles.textDone]}>{appt.patient}</Text>
        <Text style={styles.cardType}>{appt.type}</Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: statusColor + "18" }]}>
        <Text style={[styles.statusText, { color: statusColor }]}>
          {appt.status.replace("-", " ")}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function AppointmentsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"today" | "tomorrow" | "week">("today");

  const totalToday = SCHEDULE.reduce((sum, s) => sum + s.data.length, 0);
  const completed = SCHEDULE.find((s) => s.title === "Completed")?.data.length ?? 0;

  return (
    <View style={styles.container}>
      {/* Day Tabs */}
      <View style={styles.tabRow}>
        {(["today", "tomorrow", "week"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary Bar */}
      <View style={styles.summaryBar}>
        <Text style={styles.summaryText}>
          {completed}/{totalToday} seen
        </Text>
        <TouchableOpacity style={styles.walkInBtn}>
          <Text style={styles.walkInBtnText}>+ Walk-in</Text>
        </TouchableOpacity>
      </View>

      {/* Schedule */}
      <SectionList
        sections={SCHEDULE}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        renderItem={({ item }) => <AppointmentCard appt={item} />}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setTimeout(() => setRefreshing(false), 1000);
            }}
            tintColor={BLUE}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  tabActive: { backgroundColor: BLUE, borderColor: BLUE },
  tabText: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  tabTextActive: { color: "#fff" },
  summaryBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  summaryText: { fontSize: 13, color: "#6b7280" },
  walkInBtn: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  walkInBtnText: { fontSize: 12, color: BLUE, fontWeight: "600" },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 6,
    gap: 6,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#374151" },
  sectionCount: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6b7280",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: "hidden",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardDone: { opacity: 0.6 },
  tokenCol: { alignItems: "center", width: 52 },
  tokenNo: { fontSize: 16, fontWeight: "700" },
  cardTime: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  cardBody: { flex: 1, marginLeft: 10 },
  cardName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  textDone: { textDecorationLine: "line-through", color: "#6b7280" },
  cardType: { fontSize: 12, color: "#6b7280", marginTop: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: "700", textTransform: "capitalize" },
});
