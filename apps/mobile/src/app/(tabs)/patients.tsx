import { useState } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, RefreshControl } from "react-native";
import { colors, shadow, radius } from "../../theme";

interface Patient { id: string; name: string; phone: string; age: number; gender: "M"|"F"|"O"; lastVisit: string; diagnosis: string; abhaLinked: boolean; }

const PATIENTS: Patient[] = [
  { id: "1", name: "Priya Sharma", phone: "98765XXXXX", age: 34, gender: "F", lastVisit: "2 Mar 2026", diagnosis: "Type 2 Diabetes", abhaLinked: true },
  { id: "2", name: "Rahul Verma", phone: "87654XXXXX", age: 45, gender: "M", lastVisit: "5 Mar 2026", diagnosis: "Hypertension", abhaLinked: false },
  { id: "3", name: "Anita Desai", phone: "76543XXXXX", age: 28, gender: "F", lastVisit: "7 Mar 2026", diagnosis: "PCOD", abhaLinked: true },
  { id: "4", name: "Vikram Singh", phone: "65432XXXXX", age: 52, gender: "M", lastVisit: "1 Mar 2026", diagnosis: "Coronary Artery Disease", abhaLinked: false },
  { id: "5", name: "Meena Patel", phone: "54321XXXXX", age: 61, gender: "F", lastVisit: "28 Feb 2026", diagnosis: "Chronic Kidney Disease", abhaLinked: true },
  { id: "6", name: "Arjun Nair", phone: "43210XXXXX", age: 19, gender: "M", lastVisit: "6 Mar 2026", diagnosis: "Asthma", abhaLinked: false },
  { id: "7", name: "Kavita Reddy", phone: "32109XXXXX", age: 40, gender: "F", lastVisit: "4 Mar 2026", diagnosis: "Hypothyroidism", abhaLinked: true },
];

function PatientCard({ patient }: { patient: Patient }) {
  return (
    <TouchableOpacity style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{patient.name.split(" ").map((n) => n[0]).join("")}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardName}>{patient.name}</Text>
          {patient.abhaLinked && <View style={styles.abhaBadge}><Text style={styles.abhaBadgeText}>ABHA</Text></View>}
        </View>
        <Text style={styles.cardMeta}>{patient.age}y / {patient.gender} &middot; {patient.phone}</Text>
        <Text style={styles.cardDiagnosis}>{patient.diagnosis}</Text>
        <Text style={styles.cardVisit}>Last visit: {patient.lastVisit}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

export default function PatientsScreen() {
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const filtered = PATIENTS.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.phone.includes(search) || p.diagnosis.toLowerCase().includes(search.toLowerCase()));

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput style={styles.searchInput} placeholder="Search by name, phone, or diagnosis..." placeholderTextColor={colors.text.placeholder} value={search} onChangeText={setSearch} />
        <TouchableOpacity style={styles.addBtn}><Text style={styles.addBtnText}>+ Add</Text></TouchableOpacity>
      </View>
      <Text style={styles.countText}>{filtered.length} patients</Text>
      <FlatList data={filtered} keyExtractor={(item) => item.id} renderItem={({ item }) => <PatientCard patient={item} />} contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1000); }} tintColor={colors.primary[600]} />}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No patients found</Text></View>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  searchRow: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  searchInput: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.text.primary, borderWidth: 1, borderColor: colors.border },
  addBtn: { backgroundColor: colors.primary[600], borderRadius: radius.lg, paddingHorizontal: 16, justifyContent: "center" },
  addBtnText: { color: colors.white, fontSize: 14, fontWeight: "600" },
  countText: { fontSize: 12, color: colors.text.tertiary, paddingHorizontal: 16, marginTop: 8 },
  list: { padding: 16, paddingTop: 8 },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, marginBottom: 10, ...shadow.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary[100], alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 15, fontWeight: "700", color: colors.primary[700] },
  cardBody: { flex: 1, marginLeft: 12 },
  cardTopRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardName: { fontSize: 15, fontWeight: "600", color: colors.text.primary },
  abhaBadge: { backgroundColor: colors.success.bg, paddingHorizontal: 5, paddingVertical: 1, borderRadius: radius.sm },
  abhaBadgeText: { fontSize: 9, color: colors.success.text, fontWeight: "700" },
  cardMeta: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  cardDiagnosis: { fontSize: 13, color: colors.text.secondary, marginTop: 2, fontWeight: "500" },
  cardVisit: { fontSize: 11, color: colors.text.disabled, marginTop: 2 },
  chevron: { fontSize: 20, color: colors.border, marginLeft: 8 },
  empty: { alignItems: "center", paddingTop: 40 },
  emptyText: { fontSize: 14, color: colors.text.disabled },
});
