import { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, RefreshControl, ActivityIndicator } from "react-native";
import { colors, shadow, radius } from "../../theme";
import { getAccessToken } from "../../lib/auth";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

interface Patient {
  id: string;
  phone: string;
  name?: string;
  fhirPatientId: string;
  tags: string[];
  createdAt: string;
  medicalHistory?: unknown;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function PatientCard({ patient }: { patient: Patient }) {
  const displayName = patient.name || "Unnamed Patient";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <TouchableOpacity style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardName}>{displayName}</Text>
          {patient.tags && patient.tags.length > 0 && (
            <View style={styles.tagBadge}>
              <Text style={styles.tagBadgeText}>{patient.tags[0]}</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardMeta}>{patient.phone}</Text>
        <Text style={styles.cardVisit}>Registered: {formatDate(patient.createdAt)}</Text>
      </View>
      <Text style={styles.chevron}>&rsaquo;</Text>
    </TouchableOpacity>
  );
}

export default function PatientsScreen() {
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPatients = async () => {
    try {
      setError(null);
      const token = getAccessToken();
      const res = await fetch(`${API_URL}/api/patients?page=1&limit=50`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch patients (${res.status})`);
      }
      const json = await res.json();
      setPatients(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load patients");
    }
  };

  useEffect(() => {
    fetchPatients().finally(() => setLoading(false));
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPatients();
    setRefreshing(false);
  };

  const filtered = patients.filter(
    (p) =>
      (p.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      p.phone.includes(search)
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading patients...</Text>
      </View>
    );
  }

  if (error && patients.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); fetchPatients().finally(() => setLoading(false)); }}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput style={styles.searchInput} placeholder="Search by name or phone..." placeholderTextColor={colors.text.placeholder} value={search} onChangeText={setSearch} />
        <TouchableOpacity style={styles.addBtn}><Text style={styles.addBtnText}>+ Add</Text></TouchableOpacity>
      </View>
      <Text style={styles.countText}>{filtered.length} patients</Text>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PatientCard patient={item} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary[600]} />}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No patients found</Text></View>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: "center", justifyContent: "center" },
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
  tagBadge: { backgroundColor: colors.success.bg, paddingHorizontal: 5, paddingVertical: 1, borderRadius: radius.sm },
  tagBadgeText: { fontSize: 9, color: colors.success.text, fontWeight: "700" },
  cardMeta: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  cardVisit: { fontSize: 11, color: colors.text.disabled, marginTop: 2 },
  chevron: { fontSize: 20, color: colors.border, marginLeft: 8 },
  empty: { alignItems: "center", paddingTop: 40 },
  emptyText: { fontSize: 14, color: colors.text.disabled },
  loadingText: { fontSize: 14, color: colors.text.tertiary, marginTop: 12 },
  errorText: { fontSize: 14, color: colors.critical.main, textAlign: "center", paddingHorizontal: 32, marginBottom: 16 },
  retryBtn: { backgroundColor: colors.primary[600], borderRadius: radius.lg, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText: { color: colors.white, fontSize: 14, fontWeight: "600" },
});
