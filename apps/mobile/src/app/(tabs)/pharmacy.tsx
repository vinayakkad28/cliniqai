import { useState } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, RefreshControl } from "react-native";
import { colors, shadow, radius } from "../../theme";

interface Medicine { id: string; name: string; generic: string; stock: number; unit: string; batchExpiry: string; mrp: number; category: string; }
type FilterTab = "all" | "low" | "expiring" | "out";
const LOW_THRESHOLD = 20;

const INVENTORY: Medicine[] = [
  { id: "1", name: "Amoxicillin 500mg", generic: "Amoxicillin", stock: 12, unit: "strips", batchExpiry: "Apr 2026", mrp: 85, category: "Antibiotic" },
  { id: "2", name: "Metformin 500mg", generic: "Metformin HCl", stock: 240, unit: "tabs", batchExpiry: "Dec 2026", mrp: 45, category: "Antidiabetic" },
  { id: "3", name: "Amlodipine 5mg", generic: "Amlodipine Besylate", stock: 0, unit: "tabs", batchExpiry: "—", mrp: 52, category: "Antihypertensive" },
  { id: "4", name: "Pantoprazole 40mg", generic: "Pantoprazole Na", stock: 85, unit: "tabs", batchExpiry: "Jan 2027", mrp: 68, category: "PPI" },
  { id: "5", name: "Azithromycin 250mg", generic: "Azithromycin", stock: 8, unit: "strips", batchExpiry: "May 2026", mrp: 120, category: "Antibiotic" },
  { id: "6", name: "Paracetamol 650mg", generic: "Acetaminophen", stock: 500, unit: "tabs", batchExpiry: "Nov 2026", mrp: 25, category: "Analgesic" },
  { id: "7", name: "Cetirizine 10mg", generic: "Cetirizine HCl", stock: 150, unit: "tabs", batchExpiry: "Aug 2026", mrp: 32, category: "Antihistamine" },
  { id: "8", name: "Insulin Glargine", generic: "Insulin Glargine", stock: 3, unit: "pens", batchExpiry: "Mar 2026", mrp: 950, category: "Insulin" },
];

function isExpiringSoon(expiry: string): boolean {
  if (expiry === "—") return false;
  const d = new Date(expiry); const t = new Date(); t.setMonth(t.getMonth() + 3); return d <= t;
}

function StockBadge({ stock, expiry }: { stock: number; expiry: string }) {
  let bg = colors.success.bg, color = colors.success.text, label = "In Stock";
  if (stock === 0) { bg = colors.critical.bg; color = colors.critical.text; label = "Out of Stock"; }
  else if (stock < LOW_THRESHOLD) { bg = colors.warning.bg; color = colors.warning.text; label = "Low Stock"; }
  else if (isExpiringSoon(expiry)) { bg = colors.warning.bg; color = colors.warning.text; label = "Expiring Soon"; }
  return <View style={[styles.stockBadge, { backgroundColor: bg }]}><Text style={[styles.stockBadgeText, { color }]}>{label}</Text></View>;
}

function MedicineCard({ med }: { med: Medicine }) {
  return (
    <TouchableOpacity style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}><Text style={styles.medName}>{med.name}</Text><Text style={styles.medGeneric}>{med.generic} &middot; {med.category}</Text></View>
        <StockBadge stock={med.stock} expiry={med.batchExpiry} />
      </View>
      <View style={styles.cardBottom}>
        <View><Text style={styles.statLabel}>Stock</Text><Text style={[styles.statValue, med.stock < LOW_THRESHOLD && { color: colors.pharmacy.outOfStock }]}>{med.stock} {med.unit}</Text></View>
        <View><Text style={styles.statLabel}>Batch Expiry</Text><Text style={[styles.statValue, isExpiringSoon(med.batchExpiry) && { color: colors.pharmacy.expiringSoon }]}>{med.batchExpiry}</Text></View>
        <View><Text style={styles.statLabel}>MRP</Text><Text style={styles.statValue}>₹{med.mrp}</Text></View>
      </View>
    </TouchableOpacity>
  );
}

export default function PharmacyScreen() {
  const [search, setSearch] = useState(""); const [tab, setTab] = useState<FilterTab>("all"); const [refreshing, setRefreshing] = useState(false);
  const filtered = INVENTORY.filter((m) => {
    const ms = m.name.toLowerCase().includes(search.toLowerCase()) || m.generic.toLowerCase().includes(search.toLowerCase());
    if (!ms) return false; if (tab === "low") return m.stock > 0 && m.stock < LOW_THRESHOLD; if (tab === "out") return m.stock === 0; if (tab === "expiring") return isExpiringSoon(m.batchExpiry); return true;
  });
  const lowCount = INVENTORY.filter((m) => m.stock > 0 && m.stock < LOW_THRESHOLD).length;
  const outCount = INVENTORY.filter((m) => m.stock === 0).length;
  const expiringCount = INVENTORY.filter((m) => isExpiringSoon(m.batchExpiry)).length;
  const TABS: { key: FilterTab; label: string; count?: number }[] = [{ key: "all", label: "All" }, { key: "low", label: "Low", count: lowCount }, { key: "out", label: "Out", count: outCount }, { key: "expiring", label: "Expiring", count: expiringCount }];

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}><TextInput style={styles.searchInput} placeholder="Search medicines..." placeholderTextColor={colors.text.placeholder} value={search} onChangeText={setSearch} /></View>
      <View style={styles.tabRow}>{TABS.map((t) => (
        <TouchableOpacity key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
          <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}{t.count !== undefined && t.count > 0 ? ` (${t.count})` : ""}</Text>
        </TouchableOpacity>
      ))}</View>
      <FlatList data={filtered} keyExtractor={(item) => item.id} renderItem={({ item }) => <MedicineCard med={item} />} contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1000); }} tintColor={colors.primary[600]} />}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No medicines found</Text></View>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  searchRow: { paddingHorizontal: 16, paddingTop: 12 },
  searchInput: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.text.primary, borderWidth: 1, borderColor: colors.border },
  tabRow: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 10, gap: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.primary[600], borderColor: colors.primary[600] },
  tabText: { fontSize: 12, fontWeight: "600", color: colors.text.tertiary },
  tabTextActive: { color: colors.white },
  list: { padding: 16, paddingTop: 10 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, marginBottom: 10, ...shadow.sm },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  medName: { fontSize: 15, fontWeight: "600", color: colors.text.primary },
  medGeneric: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  stockBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.md },
  stockBadgeText: { fontSize: 10, fontWeight: "700" },
  cardBottom: { flexDirection: "row", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderLight, gap: 20 },
  statLabel: { fontSize: 10, color: colors.text.disabled, fontWeight: "500" },
  statValue: { fontSize: 13, color: colors.text.secondary, fontWeight: "600", marginTop: 1 },
  empty: { alignItems: "center", paddingTop: 40 },
  emptyText: { fontSize: 14, color: colors.text.disabled },
});
