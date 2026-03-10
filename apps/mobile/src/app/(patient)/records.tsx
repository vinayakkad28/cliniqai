import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import { useState } from 'react';

// ── Design tokens ───────────────────────────────────────────────────────────
const PRIMARY = '#2563EB';
const PRIMARY_LIGHT = '#DBEAFE';
const SURFACE = '#F8FAFC';
const WHITE = '#FFFFFF';
const TEXT_PRIMARY = '#0F172A';
const TEXT_SECONDARY = '#64748B';
const TEXT_DISABLED = '#94A3B8';
const BORDER_LIGHT = '#F1F5F9';
const BORDER = '#E2E8F0';
const SUCCESS_MAIN = '#22C55E';
const SUCCESS_BG = '#F0FDF4';
const SUCCESS_TEXT = '#15803D';
const INFO_MAIN = '#3B82F6';
const WARNING_MAIN = '#F97316';

// ── Filter types ────────────────────────────────────────────────────────────
type RecordFilter = 'all' | 'lab' | 'prescription' | 'imaging' | 'consultation';

const FILTER_OPTIONS: { key: RecordFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'lab', label: 'Lab Results' },
  { key: 'prescription', label: 'Prescriptions' },
  { key: 'imaging', label: 'Imaging' },
  { key: 'consultation', label: 'Consultation Notes' },
];

// ── Mock data ───────────────────────────────────────────────────────────────

interface HealthRecord {
  id: string;
  type: 'lab' | 'prescription' | 'imaging' | 'consultation';
  title: string;
  date: string;
  doctor: string;
  summary: string;
  details: string;
  abdmLinked: boolean;
}

const RECORDS: HealthRecord[] = [
  {
    id: '1',
    type: 'lab',
    title: 'Complete Blood Count (CBC)',
    date: '2026-03-05',
    doctor: 'Dr. Rajesh Sharma',
    summary: 'Hemoglobin: 14.2 g/dL, WBC: 7,200/uL - All normal',
    details:
      'Hemoglobin: 14.2 g/dL (Normal: 13.0-17.0)\nWBC: 7,200/uL (Normal: 4,500-11,000)\nRBC: 5.1 M/uL (Normal: 4.7-6.1)\nPlatelets: 250,000/uL (Normal: 150,000-400,000)\nHematocrit: 42% (Normal: 38-50%)\n\nAll parameters within normal range. No abnormalities detected.',
    abdmLinked: true,
  },
  {
    id: '2',
    type: 'prescription',
    title: 'Prescription - Diabetes Management',
    date: '2026-03-05',
    doctor: 'Dr. Rajesh Sharma',
    summary: 'Metformin 500mg, Amlodipine 5mg, Atorvastatin 10mg',
    details:
      '1. Metformin 500mg - Twice daily after meals (3 months)\n2. Amlodipine 5mg - Once daily morning (3 months)\n3. Atorvastatin 10mg - Once daily at night (6 months)\n\nAdvice: Low-sodium diet, regular exercise, monitor blood sugar fasting and post-prandial weekly.',
    abdmLinked: true,
  },
  {
    id: '3',
    type: 'lab',
    title: 'HbA1c Test',
    date: '2026-02-20',
    doctor: 'Dr. Rajesh Sharma',
    summary: 'HbA1c: 7.2% - Above target (goal <7%)',
    details:
      'HbA1c: 7.2% (Target: <7.0%)\n\nInterpretation: Slightly above target. Indicates average blood sugar of ~160 mg/dL over past 3 months. Medication adjustment recommended. Recheck in 3 months.\n\nFasting Glucose: 142 mg/dL (Target: 80-130)\nPost-prandial Glucose: 198 mg/dL (Target: <180)',
    abdmLinked: true,
  },
  {
    id: '4',
    type: 'consultation',
    title: 'Follow-up Consultation',
    date: '2026-02-25',
    doctor: 'Dr. Rajesh Sharma',
    summary: 'Blood sugar review - Type 2 Diabetes Management',
    details:
      'Chief Complaint: Follow-up for Type 2 Diabetes and Hypertension\n\nVitals: BP 138/86 mmHg, HR 78 bpm, SpO2 98%\nWeight: 82 kg (prev: 84 kg - improved)\n\nAssessment:\n- Diabetes: Fair control, HbA1c 7.2%. Increased Metformin dose.\n- Hypertension: Borderline. Continue Amlodipine 5mg.\n- Dyslipidemia: Stable on Atorvastatin.\n\nPlan: Recheck HbA1c in 3 months. Continue current medications. Diet and exercise counseling given.',
    abdmLinked: false,
  },
  {
    id: '5',
    type: 'imaging',
    title: 'Chest X-Ray (PA View)',
    date: '2026-02-15',
    doctor: 'Dr. Rajesh Sharma',
    summary: 'No abnormalities detected. Lungs clear.',
    details:
      'Findings:\n- Heart size: Normal\n- Lungs: Clear, no infiltrates or effusions\n- Mediastinum: Normal width\n- Costophrenic angles: Sharp bilaterally\n- Bones: No fractures or lytic lesions\n\nImpression: Normal chest radiograph. No acute cardiopulmonary abnormality.',
    abdmLinked: true,
  },
  {
    id: '6',
    type: 'prescription',
    title: 'Prescription - Gastritis Treatment',
    date: '2026-02-10',
    doctor: 'Dr. Priya Gupta',
    summary: 'Omeprazole 20mg for gastritis',
    details:
      '1. Omeprazole 20mg - Once daily before breakfast (14 days)\n2. Domperidone 10mg - As needed for nausea\n\nAdvice: Avoid spicy and fried foods. Eat smaller, frequent meals. Avoid lying down immediately after eating.',
    abdmLinked: false,
  },
  {
    id: '7',
    type: 'consultation',
    title: 'Initial Consultation',
    date: '2026-01-30',
    doctor: 'Dr. Rajesh Sharma',
    summary: 'General checkup, BP elevated, started on Amlodipine',
    details:
      'Chief Complaint: General health checkup, occasional headaches\n\nVitals: BP 152/94 mmHg, HR 82 bpm, SpO2 99%\nWeight: 84 kg, Height: 172 cm, BMI: 28.4\n\nAssessment:\n- New diagnosis: Hypertension Stage 1\n- Known Type 2 Diabetes on Metformin\n- Overweight (BMI 28.4)\n\nPlan: Start Amlodipine 5mg. Continue Metformin 500mg BD. Order CBC, HbA1c, Lipid profile, Chest X-Ray. Follow up in 4 weeks.',
    abdmLinked: true,
  },
  {
    id: '8',
    type: 'lab',
    title: 'Lipid Profile',
    date: '2026-01-28',
    doctor: 'Dr. Rajesh Sharma',
    summary: 'Total Cholesterol: 224 mg/dL - Borderline high',
    details:
      'Total Cholesterol: 224 mg/dL (Desirable: <200)\nLDL: 148 mg/dL (Optimal: <100)\nHDL: 42 mg/dL (Low: <40, Desirable: >60)\nTriglycerides: 170 mg/dL (Normal: <150)\nVLDL: 34 mg/dL\n\nInterpretation: Borderline high cholesterol with elevated LDL and triglycerides. Statin therapy recommended. Start Atorvastatin 10mg at night.',
    abdmLinked: true,
  },
];

// ── Type configuration ──────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  string,
  { icon: string; color: string; label: string }
> = {
  lab: { icon: '🔬', color: '#8B5CF6', label: 'Lab Result' },
  prescription: { icon: '💊', color: INFO_MAIN, label: 'Prescription' },
  imaging: { icon: '📷', color: WARNING_MAIN, label: 'Imaging' },
  consultation: { icon: '🩺', color: SUCCESS_MAIN, label: 'Consultation' },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function groupByDate(records: HealthRecord[]): { date: string; items: HealthRecord[] }[] {
  const groups: Record<string, HealthRecord[]> = {};
  for (const r of records) {
    if (!groups[r.date]) groups[r.date] = [];
    groups[r.date].push(r);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, items }));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ── Component ───────────────────────────────────────────────────────────────

export default function HealthRecords() {
  const [filter, setFilter] = useState<RecordFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered =
    filter === 'all' ? RECORDS : RECORDS.filter((r) => r.type === filter);

  const grouped = groupByDate(filtered);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <View style={styles.container}>
      {/* ── ABDM Connected Banner ── */}
      <View style={styles.abdmBanner}>
        <Text style={{ fontSize: 16 }}>🔗</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.abdmTitle}>ABDM Connected</Text>
          <Text style={styles.abdmSubtext}>
            Your health records are linked via Ayushman Bharat Digital Mission
          </Text>
        </View>
        <View style={styles.abdmBadge}>
          <Text style={styles.abdmBadgeText}>LINKED</Text>
        </View>
      </View>

      {/* ── Filter Tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {FILTER_OPTIONS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterTab,
              filter === f.key && styles.filterTabActive,
            ]}
            onPress={() => setFilter(f.key)}
          >
            <Text
              style={[
                styles.filterText,
                filter === f.key && styles.filterTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Records grouped by date ── */}
      <FlatList
        data={grouped}
        keyExtractor={(item) => item.date}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item: group }) => (
          <View style={styles.dateGroup}>
            <Text style={styles.dateGroupTitle}>{formatDate(group.date)}</Text>
            {group.items.map((record) => {
              const config = TYPE_CONFIG[record.type];
              const isExpanded = expandedId === record.id;
              return (
                <TouchableOpacity
                  key={record.id}
                  style={styles.recordCard}
                  onPress={() => toggleExpand(record.id)}
                  activeOpacity={0.7}
                >
                  {/* Record Header */}
                  <View style={styles.recordHeader}>
                    <View
                      style={[
                        styles.recordIcon,
                        { backgroundColor: config.color + '20' },
                      ]}
                    >
                      <Text style={{ fontSize: 20 }}>{config.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.recordTitleRow}>
                        <Text style={styles.recordTitle} numberOfLines={1}>
                          {record.title}
                        </Text>
                        {record.abdmLinked && (
                          <View style={styles.abdmIndicator}>
                            <Text style={styles.abdmIndicatorText}>ABDM</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.recordDoctor}>{record.doctor}</Text>
                      <Text style={styles.recordSummary} numberOfLines={2}>
                        {record.summary}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.expandArrow,
                        isExpanded && styles.expandArrowOpen,
                      ]}
                    >
                      {isExpanded ? '▾' : '›'}
                    </Text>
                  </View>

                  {/* Record Type Badge */}
                  <View style={styles.recordBadgeRow}>
                    <View
                      style={[
                        styles.typeBadge,
                        { backgroundColor: config.color + '15' },
                      ]}
                    >
                      <Text
                        style={[styles.typeBadgeText, { color: config.color }]}
                      >
                        {config.label}
                      </Text>
                    </View>
                  </View>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <View style={styles.expandedSection}>
                      <View style={styles.expandedDivider} />
                      <Text style={styles.expandedLabel}>Full Details</Text>
                      <Text style={styles.expandedText}>{record.details}</Text>
                      <View style={styles.expandedActions}>
                        <TouchableOpacity style={styles.actionButton}>
                          <Text style={styles.actionButtonText}>
                            📥 Download
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton}>
                          <Text style={styles.actionButtonText}>
                            📤 Share
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      />
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SURFACE },

  // ABDM banner
  abdmBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: SUCCESS_BG,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#BBF7D0',
  },
  abdmTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: SUCCESS_TEXT,
  },
  abdmSubtext: {
    fontSize: 11,
    color: SUCCESS_TEXT,
    opacity: 0.8,
    marginTop: 1,
  },
  abdmBadge: {
    backgroundColor: SUCCESS_MAIN,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  abdmBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: WHITE,
  },

  // Filter
  filterContainer: {
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
    maxHeight: 56,
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: BORDER_LIGHT,
    marginRight: 0,
  },
  filterTabActive: {
    backgroundColor: PRIMARY,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_SECONDARY,
  },
  filterTextActive: {
    color: WHITE,
  },

  // Date groups
  dateGroup: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  dateGroupTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Record cards
  recordCard: {
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  recordIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recordTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    flex: 1,
  },
  recordDoctor: {
    fontSize: 12,
    color: PRIMARY,
    marginTop: 2,
    fontWeight: '500',
  },
  recordSummary: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 3,
    lineHeight: 17,
  },
  expandArrow: {
    fontSize: 18,
    color: TEXT_DISABLED,
    marginTop: 4,
  },
  expandArrowOpen: {
    color: PRIMARY,
  },

  // ABDM indicator
  abdmIndicator: {
    backgroundColor: PRIMARY_LIGHT,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  abdmIndicatorText: {
    fontSize: 8,
    fontWeight: '700',
    color: PRIMARY,
  },

  // Type badge
  recordBadgeRow: {
    flexDirection: 'row',
    marginTop: 8,
    marginLeft: 56,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },

  // Expanded section
  expandedSection: {
    marginTop: 12,
  },
  expandedDivider: {
    height: 1,
    backgroundColor: BORDER_LIGHT,
    marginBottom: 12,
  },
  expandedLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  expandedText: {
    fontSize: 13,
    color: TEXT_PRIMARY,
    lineHeight: 20,
    fontFamily: 'monospace',
    backgroundColor: SURFACE,
    padding: 12,
    borderRadius: 8,
  },
  expandedActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_PRIMARY,
  },
});
