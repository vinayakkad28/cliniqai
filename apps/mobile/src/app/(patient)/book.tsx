import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from 'react-native';
import { useState } from 'react';

// ── Design tokens ───────────────────────────────────────────────────────────
const PRIMARY = '#2563EB';
const PRIMARY_DARK = '#1D4ED8';
const PRIMARY_LIGHT = '#DBEAFE';
const PRIMARY_BG = '#EFF6FF';
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
const WARNING_MAIN = '#F59E0B';

// ── Interfaces ──────────────────────────────────────────────────────────────

interface Doctor {
  id: string;
  name: string;
  specialization: string;
  clinicName: string;
  nextAvailable: string;
  fee: number;
  rating: number;
  experience: string;
  languages: string[];
}

type AppointmentType = 'walk-in' | 'telemedicine' | 'follow-up';
type BookingStep = 'doctor' | 'slot' | 'confirm' | 'success';

// ── Mock data ───────────────────────────────────────────────────────────────

const DOCTORS: Doctor[] = [
  {
    id: '1',
    name: 'Dr. Rajesh Sharma',
    specialization: 'General Medicine',
    clinicName: 'CliniqAI Health Center',
    nextAvailable: '2026-03-12 10:00',
    fee: 500,
    rating: 4.8,
    experience: '15 years',
    languages: ['Hindi', 'English'],
  },
  {
    id: '2',
    name: 'Dr. Priya Gupta',
    specialization: 'Dermatology',
    clinicName: 'Skin & Care Clinic',
    nextAvailable: '2026-03-12 14:00',
    fee: 800,
    rating: 4.9,
    experience: '12 years',
    languages: ['Hindi', 'English', 'Marathi'],
  },
  {
    id: '3',
    name: 'Dr. Amit Patel',
    specialization: 'Orthopedics',
    clinicName: 'Bone & Joint Center',
    nextAvailable: '2026-03-13 11:00',
    fee: 700,
    rating: 4.7,
    experience: '18 years',
    languages: ['Hindi', 'English', 'Gujarati'],
  },
  {
    id: '4',
    name: 'Dr. Sneha Reddy',
    specialization: 'Gynecology',
    clinicName: 'Women Care Hospital',
    nextAvailable: '2026-03-12 09:30',
    fee: 600,
    rating: 4.9,
    experience: '10 years',
    languages: ['Hindi', 'English', 'Telugu'],
  },
  {
    id: '5',
    name: 'Dr. Vikram Singh',
    specialization: 'Cardiology',
    clinicName: 'Heart & Vascular Institute',
    nextAvailable: '2026-03-14 10:00',
    fee: 1200,
    rating: 4.8,
    experience: '20 years',
    languages: ['Hindi', 'English', 'Punjabi'],
  },
];

const MORNING_SLOTS = [
  '09:00 AM',
  '09:30 AM',
  '10:00 AM',
  '10:30 AM',
  '11:00 AM',
  '11:30 AM',
];
const AFTERNOON_SLOTS = [
  '02:00 PM',
  '02:30 PM',
  '03:00 PM',
  '03:30 PM',
  '04:00 PM',
  '04:30 PM',
];
const EVENING_SLOTS = ['05:00 PM', '05:30 PM', '06:00 PM', '06:30 PM'];

const APPOINTMENT_TYPES: { key: AppointmentType; label: string; icon: string; desc: string }[] = [
  {
    key: 'walk-in',
    label: 'Walk-in',
    icon: '🏥',
    desc: 'Visit the clinic in person',
  },
  {
    key: 'telemedicine',
    label: 'Telemedicine',
    icon: '📹',
    desc: 'Video consultation from home',
  },
  {
    key: 'follow-up',
    label: 'Follow-up',
    icon: '🔄',
    desc: 'Follow-up on previous visit',
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function generateTokenNumber(): string {
  const num = Math.floor(Math.random() * 50) + 1;
  return `T-${String(num).padStart(3, '0')}`;
}

function getNext7Days(): {
  date: string;
  day: string;
  num: number;
  month: string;
  isToday: boolean;
}[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      date: d.toISOString().split('T')[0],
      day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      num: d.getDate(),
      month: d.toLocaleDateString('en-IN', { month: 'short' }),
      isToday: i === 0,
    };
  });
}

// ── Component ───────────────────────────────────────────────────────────────

export default function BookAppointment() {
  const [step, setStep] = useState<BookingStep>('doctor');
  const [search, setSearch] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [appointmentType, setAppointmentType] =
    useState<AppointmentType>('walk-in');
  const [tokenNumber, setTokenNumber] = useState('');

  const dates = getNext7Days();

  const filteredDoctors = DOCTORS.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.specialization.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectDoctor = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setStep('slot');
  };

  const handleConfirmBooking = () => {
    const token = generateTokenNumber();
    setTokenNumber(token);
    setStep('success');
  };

  const handleNewBooking = () => {
    setStep('doctor');
    setSelectedDoctor(null);
    setSelectedDate('');
    setSelectedSlot('');
    setAppointmentType('walk-in');
    setTokenNumber('');
    setSearch('');
  };

  // ── Success Screen ──
  if (step === 'success') {
    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.successContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.successCard}>
            <View style={styles.successIconCircle}>
              <Text style={{ fontSize: 48 }}>✅</Text>
            </View>
            <Text style={styles.successTitle}>Appointment Booked!</Text>
            <Text style={styles.successSubtext}>
              Your appointment has been confirmed
            </Text>

            {/* Token Number */}
            <View style={styles.tokenCard}>
              <Text style={styles.tokenLabel}>Your Token Number</Text>
              <Text style={styles.tokenNumber}>{tokenNumber}</Text>
              <Text style={styles.tokenHint}>
                Show this at the reception desk
              </Text>
            </View>

            {/* Booking Details */}
            <View style={styles.confirmDetails}>
              <DetailRow label="Doctor" value={selectedDoctor?.name || ''} />
              <DetailRow
                label="Specialization"
                value={selectedDoctor?.specialization || ''}
              />
              <DetailRow label="Clinic" value={selectedDoctor?.clinicName || ''} />
              <DetailRow
                label="Date"
                value={
                  selectedDate
                    ? new Date(selectedDate).toLocaleDateString('en-IN', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : ''
                }
              />
              <DetailRow label="Time" value={selectedSlot} />
              <DetailRow
                label="Type"
                value={
                  APPOINTMENT_TYPES.find((t) => t.key === appointmentType)
                    ?.label || ''
                }
              />
              <DetailRow
                label="Fee"
                value={`₹${selectedDoctor?.fee || 0}`}
              />
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleNewBooking}
            >
              <Text style={styles.primaryButtonText}>Book Another</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>
                Add to Calendar
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Confirmation Screen ──
  if (step === 'confirm' && selectedDoctor) {
    return (
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.confirmHeader}>
          <Text style={styles.confirmHeaderTitle}>Review & Confirm</Text>
          <Text style={styles.confirmHeaderSub}>
            Please review your appointment details
          </Text>
        </View>

        <View style={styles.confirmCard}>
          {/* Doctor Info */}
          <View style={styles.confirmDoctorRow}>
            <View style={styles.doctorAvatar}>
              <Text style={{ fontSize: 28 }}>👨‍⚕️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.confirmDoctorName}>
                {selectedDoctor.name}
              </Text>
              <Text style={styles.confirmDoctorSpec}>
                {selectedDoctor.specialization}
              </Text>
              <Text style={styles.confirmClinic}>
                {selectedDoctor.clinicName}
              </Text>
            </View>
          </View>

          <View style={styles.confirmDivider} />

          <DetailRow
            label="Date"
            value={
              selectedDate
                ? new Date(selectedDate).toLocaleDateString('en-IN', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })
                : ''
            }
          />
          <DetailRow label="Time" value={selectedSlot} />
          <DetailRow
            label="Type"
            value={
              APPOINTMENT_TYPES.find((t) => t.key === appointmentType)?.label ||
              ''
            }
          />
          <DetailRow
            label="Consultation Fee"
            value={`₹${selectedDoctor.fee}`}
          />
        </View>

        <View style={styles.confirmActions}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep('slot')}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, { flex: 1 }]}
            onPress={handleConfirmBooking}
          >
            <Text style={styles.primaryButtonText}>
              Confirm Booking
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // ── Slot Selection Screen ──
  if (step === 'slot' && selectedDoctor) {
    return (
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Selected Doctor Bar */}
        <View style={styles.selectedDoctorBar}>
          <View style={styles.selectedDoctorInfo}>
            <Text style={styles.selectedDoctorName}>
              {selectedDoctor.name}
            </Text>
            <Text style={styles.selectedDoctorSpec}>
              {selectedDoctor.specialization} | {selectedDoctor.clinicName}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setStep('doctor')}>
            <Text style={styles.changeLink}>Change</Text>
          </TouchableOpacity>
        </View>

        {/* Appointment Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appointment Type</Text>
          <View style={styles.typeGrid}>
            {APPOINTMENT_TYPES.map((type) => (
              <TouchableOpacity
                key={type.key}
                style={[
                  styles.typeOption,
                  appointmentType === type.key && styles.typeOptionActive,
                ]}
                onPress={() => setAppointmentType(type.key)}
              >
                <Text style={{ fontSize: 24 }}>{type.icon}</Text>
                <Text
                  style={[
                    styles.typeLabel,
                    appointmentType === type.key && { color: PRIMARY },
                  ]}
                >
                  {type.label}
                </Text>
                <Text style={styles.typeDesc}>{type.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Date Selection (Calendar View) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {dates.map((d) => (
              <TouchableOpacity
                key={d.date}
                style={[
                  styles.dateCard,
                  selectedDate === d.date && styles.dateCardActive,
                  d.isToday && !selectedDate && styles.dateCardToday,
                ]}
                onPress={() => setSelectedDate(d.date)}
              >
                <Text
                  style={[
                    styles.dateCardDay,
                    selectedDate === d.date && { color: WHITE },
                  ]}
                >
                  {d.day}
                </Text>
                <Text
                  style={[
                    styles.dateCardNum,
                    selectedDate === d.date && { color: WHITE },
                  ]}
                >
                  {d.num}
                </Text>
                <Text
                  style={[
                    styles.dateCardMonth,
                    selectedDate === d.date && { color: PRIMARY_LIGHT },
                  ]}
                >
                  {d.month}
                </Text>
                {d.isToday && (
                  <View
                    style={[
                      styles.todayDot,
                      selectedDate === d.date && { backgroundColor: WHITE },
                    ]}
                  />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Available Time Slots Grid */}
        {selectedDate && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Available Slots</Text>

            <Text style={styles.slotGroupLabel}>Morning</Text>
            <View style={styles.slotGrid}>
              {MORNING_SLOTS.map((slot) => (
                <TouchableOpacity
                  key={slot}
                  style={[
                    styles.slotButton,
                    selectedSlot === slot && styles.slotButtonActive,
                  ]}
                  onPress={() => setSelectedSlot(slot)}
                >
                  <Text
                    style={[
                      styles.slotText,
                      selectedSlot === slot && { color: WHITE },
                    ]}
                  >
                    {slot}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.slotGroupLabel}>Afternoon</Text>
            <View style={styles.slotGrid}>
              {AFTERNOON_SLOTS.map((slot) => (
                <TouchableOpacity
                  key={slot}
                  style={[
                    styles.slotButton,
                    selectedSlot === slot && styles.slotButtonActive,
                  ]}
                  onPress={() => setSelectedSlot(slot)}
                >
                  <Text
                    style={[
                      styles.slotText,
                      selectedSlot === slot && { color: WHITE },
                    ]}
                  >
                    {slot}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.slotGroupLabel}>Evening</Text>
            <View style={styles.slotGrid}>
              {EVENING_SLOTS.map((slot) => (
                <TouchableOpacity
                  key={slot}
                  style={[
                    styles.slotButton,
                    selectedSlot === slot && styles.slotButtonActive,
                  ]}
                  onPress={() => setSelectedSlot(slot)}
                >
                  <Text
                    style={[
                      styles.slotText,
                      selectedSlot === slot && { color: WHITE },
                    ]}
                  >
                    {slot}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Continue Button */}
        {selectedSlot && selectedDate && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setStep('confirm')}
            >
              <Text style={styles.primaryButtonText}>
                Continue - ₹{selectedDoctor.fee}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // ── Doctor Search / Selection Screen ──
  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <Text style={{ fontSize: 16 }}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search doctors, specializations..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={TEXT_DISABLED}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.clearSearch}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Specialization Quick Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.specialtyFilter}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {[
          'All',
          'General Medicine',
          'Dermatology',
          'Orthopedics',
          'Gynecology',
          'Cardiology',
        ].map((spec) => (
          <TouchableOpacity
            key={spec}
            style={[
              styles.specChip,
              search === (spec === 'All' ? '' : spec) && styles.specChipActive,
            ]}
            onPress={() => setSearch(spec === 'All' ? '' : spec)}
          >
            <Text
              style={[
                styles.specChipText,
                search === (spec === 'All' ? '' : spec) &&
                  styles.specChipTextActive,
              ]}
            >
              {spec}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Doctor List */}
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.resultCount}>
          {filteredDoctors.length} doctor
          {filteredDoctors.length !== 1 ? 's' : ''} found
        </Text>
        {filteredDoctors.map((doctor) => (
          <TouchableOpacity
            key={doctor.id}
            style={styles.doctorCard}
            onPress={() => handleSelectDoctor(doctor)}
            activeOpacity={0.7}
          >
            <View style={styles.doctorAvatar}>
              <Text style={{ fontSize: 28 }}>👨‍⚕️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.doctorName}>{doctor.name}</Text>
              <Text style={styles.doctorSpec}>{doctor.specialization}</Text>
              <Text style={styles.clinicName}>{doctor.clinicName}</Text>
              <View style={styles.doctorMeta}>
                <Text style={styles.ratingText}>
                  ★ {doctor.rating}
                </Text>
                <View style={styles.metaDot} />
                <Text style={styles.expText}>{doctor.experience}</Text>
                <View style={styles.metaDot} />
                <Text style={styles.feeText}>₹{doctor.fee}</Text>
              </View>
              <Text style={styles.langText}>
                Speaks: {doctor.languages.join(', ')}
              </Text>
            </View>
            <View style={styles.bookArrow}>
              <Text style={styles.bookArrowText}>Book</Text>
              <Text style={{ color: PRIMARY, fontSize: 16 }}>→</Text>
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={detailStyles.row}>
      <Text style={detailStyles.label}>{label}</Text>
      <Text style={detailStyles.value}>{value}</Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  label: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },
  value: {
    fontWeight: '600',
    fontSize: 14,
    color: TEXT_PRIMARY,
    maxWidth: '60%',
    textAlign: 'right',
  },
});

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SURFACE },

  // Search
  searchContainer: {
    padding: 16,
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BORDER_LIGHT,
    borderRadius: 12,
    paddingHorizontal: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  clearSearch: {
    fontSize: 14,
    color: TEXT_DISABLED,
    padding: 4,
  },

  // Specialty filter
  specialtyFilter: {
    backgroundColor: WHITE,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
    maxHeight: 52,
  },
  specChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: BORDER_LIGHT,
  },
  specChipActive: {
    backgroundColor: PRIMARY,
  },
  specChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: TEXT_SECONDARY,
  },
  specChipTextActive: {
    color: WHITE,
  },
  resultCount: {
    fontSize: 12,
    color: TEXT_DISABLED,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },

  // Doctor card
  doctorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: WHITE,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  doctorAvatar: {
    width: 52,
    height: 52,
    backgroundColor: PRIMARY_BG,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doctorName: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  doctorSpec: {
    fontSize: 13,
    color: PRIMARY,
    fontWeight: '500',
    marginTop: 1,
  },
  clinicName: {
    fontSize: 11,
    color: TEXT_DISABLED,
    marginTop: 2,
  },
  doctorMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  ratingText: {
    fontSize: 12,
    color: WARNING_MAIN,
    fontWeight: '600',
  },
  expText: {
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  feeText: {
    fontSize: 12,
    color: SUCCESS_TEXT,
    fontWeight: '600',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: TEXT_DISABLED,
  },
  langText: {
    fontSize: 11,
    color: TEXT_DISABLED,
    marginTop: 2,
  },
  bookArrow: {
    alignItems: 'center',
    gap: 2,
  },
  bookArrowText: {
    color: PRIMARY,
    fontWeight: '600',
    fontSize: 12,
  },

  // Selected doctor bar
  selectedDoctorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: PRIMARY,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectedDoctorInfo: {
    flex: 1,
  },
  selectedDoctorName: {
    fontSize: 16,
    fontWeight: '600',
    color: WHITE,
  },
  selectedDoctorSpec: {
    fontSize: 12,
    color: PRIMARY_LIGHT,
    marginTop: 2,
  },
  changeLink: {
    fontSize: 13,
    color: PRIMARY_LIGHT,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  // Appointment type
  section: { padding: 16 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 12,
  },
  typeGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  typeOption: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: BORDER,
    alignItems: 'center',
    gap: 6,
  },
  typeOptionActive: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY_BG,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  typeDesc: {
    fontSize: 10,
    color: TEXT_DISABLED,
    textAlign: 'center',
  },

  // Date cards
  dateCard: {
    width: 64,
    padding: 12,
    borderRadius: 12,
    backgroundColor: WHITE,
    marginRight: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  dateCardActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  dateCardToday: {
    borderColor: PRIMARY,
  },
  dateCardDay: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    fontWeight: '500',
  },
  dateCardNum: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    marginVertical: 2,
  },
  dateCardMonth: {
    fontSize: 11,
    color: TEXT_DISABLED,
  },
  todayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: PRIMARY,
    marginTop: 4,
  },

  // Time slot grid
  slotGroupLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    marginTop: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  slotButtonActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  slotText: {
    fontSize: 13,
    color: TEXT_PRIMARY,
    fontWeight: '500',
  },

  // Primary button
  primaryButton: {
    backgroundColor: PRIMARY,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: 10,
  },
  secondaryButtonText: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '600',
  },
  backButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
  },
  backButtonText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: '600',
  },

  // Confirm screen
  confirmHeader: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  confirmHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: WHITE,
  },
  confirmHeaderSub: {
    fontSize: 13,
    color: PRIMARY_LIGHT,
    marginTop: 4,
  },
  confirmCard: {
    margin: 16,
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  confirmDoctorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  confirmDoctorName: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  confirmDoctorSpec: {
    fontSize: 13,
    color: PRIMARY,
    fontWeight: '500',
  },
  confirmClinic: {
    fontSize: 12,
    color: TEXT_DISABLED,
    marginTop: 1,
  },
  confirmDivider: {
    height: 1,
    backgroundColor: BORDER_LIGHT,
    marginBottom: 8,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
  },
  confirmDetails: {
    marginBottom: 20,
  },

  // Success screen
  successContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  successCard: {
    backgroundColor: WHITE,
    borderRadius: 20,
    padding: 28,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  successIconCircle: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
  },
  successSubtext: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 20,
  },
  tokenCard: {
    backgroundColor: SUCCESS_BG,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  tokenLabel: {
    fontSize: 11,
    color: SUCCESS_TEXT,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tokenNumber: {
    fontSize: 36,
    fontWeight: '800',
    color: SUCCESS_TEXT,
    marginVertical: 4,
  },
  tokenHint: {
    fontSize: 11,
    color: SUCCESS_TEXT,
    opacity: 0.8,
  },
});
