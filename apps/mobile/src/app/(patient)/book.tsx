import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { useState } from 'react';

interface Doctor {
  id: string;
  name: string;
  specialization: string;
  clinicName: string;
  nextAvailable: string;
  fee: number;
  rating: number;
}

const DOCTORS: Doctor[] = [
  { id: '1', name: 'Dr. Rajesh Sharma', specialization: 'General Medicine', clinicName: 'CliniqAI Health Center', nextAvailable: '2026-03-09 10:00', fee: 500, rating: 4.8 },
  { id: '2', name: 'Dr. Priya Gupta', specialization: 'Dermatology', clinicName: 'Skin & Care Clinic', nextAvailable: '2026-03-09 14:00', fee: 800, rating: 4.9 },
  { id: '3', name: 'Dr. Amit Patel', specialization: 'Orthopedics', clinicName: 'Bone & Joint Center', nextAvailable: '2026-03-10 11:00', fee: 700, rating: 4.7 },
];

const TIME_SLOTS = ['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '05:00 PM'];

export default function BookAppointment() {
  const [step, setStep] = useState<'doctor' | 'slot' | 'confirm'>('doctor');
  const [search, setSearch] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [consultationType, setConsultationType] = useState<'in-person' | 'video'>('in-person');

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      date: d.toISOString().split('T')[0],
      day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      num: d.getDate(),
      month: d.toLocaleDateString('en-IN', { month: 'short' }),
    };
  });

  const filteredDoctors = DOCTORS.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()) || d.specialization.toLowerCase().includes(search.toLowerCase())
  );

  if (step === 'confirm') {
    return (
      <View style={styles.container}>
        <View style={styles.confirmCard}>
          <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: 16 }}>✅</Text>
          <Text style={styles.confirmTitle}>Appointment Booked!</Text>
          <Text style={styles.confirmSubtext}>Your appointment has been confirmed</Text>

          <View style={styles.confirmDetails}>
            <DetailRow label="Doctor" value={selectedDoctor?.name || ''} />
            <DetailRow label="Specialization" value={selectedDoctor?.specialization || ''} />
            <DetailRow label="Date" value={selectedDate} />
            <DetailRow label="Time" value={selectedSlot} />
            <DetailRow label="Type" value={consultationType === 'video' ? 'Video Consultation' : 'In-Person Visit'} />
            <DetailRow label="Fee" value={`₹${selectedDoctor?.fee || 0}`} />
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={() => { setStep('doctor'); setSelectedDoctor(null); }}>
            <Text style={styles.primaryButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (step === 'slot' && selectedDoctor) {
    return (
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.selectedDoctorBar}>
          <Text style={styles.selectedDoctorName}>{selectedDoctor.name}</Text>
          <Text style={styles.selectedDoctorSpec}>{selectedDoctor.specialization}</Text>
        </View>

        {/* Consultation Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Consultation Type</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              style={[styles.typeOption, consultationType === 'in-person' && styles.typeOptionActive]}
              onPress={() => setConsultationType('in-person')}
            >
              <Text style={{ fontSize: 24 }}>🏥</Text>
              <Text style={[styles.typeLabel, consultationType === 'in-person' && { color: colors.primary[600] }]}>In-Person</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeOption, consultationType === 'video' && styles.typeOptionActive]}
              onPress={() => setConsultationType('video')}
            >
              <Text style={{ fontSize: 24 }}>📹</Text>
              <Text style={[styles.typeLabel, consultationType === 'video' && { color: colors.primary[600] }]}>Video Call</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Date Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {dates.map((d) => (
              <TouchableOpacity
                key={d.date}
                style={[styles.dateCard, selectedDate === d.date && styles.dateCardActive]}
                onPress={() => setSelectedDate(d.date)}
              >
                <Text style={[styles.dateCardDay, selectedDate === d.date && { color: colors.white }]}>{d.day}</Text>
                <Text style={[styles.dateCardNum, selectedDate === d.date && { color: colors.white }]}>{d.num}</Text>
                <Text style={[styles.dateCardMonth, selectedDate === d.date && { color: colors.primary[100] }]}>{d.month}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Time Slots */}
        {selectedDate && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Available Slots</Text>
            <View style={styles.slotGrid}>
              {TIME_SLOTS.map((slot) => (
                <TouchableOpacity
                  key={slot}
                  style={[styles.slotButton, selectedSlot === slot && styles.slotButtonActive]}
                  onPress={() => setSelectedSlot(slot)}
                >
                  <Text style={[styles.slotText, selectedSlot === slot && { color: colors.white }]}>{slot}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {selectedSlot && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.primaryButton} onPress={() => setStep('confirm')}>
              <Text style={styles.primaryButtonText}>Confirm Booking - ₹{selectedDoctor.fee}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search doctors or specialization..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor=colors.text.disabled
        />
      </View>

      {/* Doctor List */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {filteredDoctors.map((doctor) => (
          <TouchableOpacity
            key={doctor.id}
            style={styles.doctorCard}
            onPress={() => { setSelectedDoctor(doctor); setStep('slot'); }}
          >
            <View style={styles.doctorAvatar}>
              <Text style={{ fontSize: 24 }}>👨‍⚕️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.doctorName}>{doctor.name}</Text>
              <Text style={styles.doctorSpec}>{doctor.specialization}</Text>
              <Text style={styles.clinicName}>{doctor.clinicName}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <Text style={{ fontSize: 12, color: colors.warning.main }}>★ {doctor.rating}</Text>
                <Text style={{ fontSize: 12, color: colors.success.main }}>₹{doctor.fee}</Text>
              </View>
            </View>
            <Text style={{ color: colors.info.main, fontWeight: '600', fontSize: 13 }}>Book →</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
      <Text style={{ color: colors.text.tertiary, fontSize: 14 }}>{label}</Text>
      <Text style={{ fontWeight: '600', fontSize: 14, color: colors.text.secondary }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  searchContainer: { padding: 16, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  searchInput: { backgroundColor: colors.borderLight, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, fontSize: 14 },
  doctorCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, marginHorizontal: 16, marginTop: 8, padding: 16, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  doctorAvatar: { width: 48, height: 48, backgroundColor: '#eff6ff', borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  doctorName: { fontSize: 15, fontWeight: '600', color: colors.text.secondary },
  doctorSpec: { fontSize: 12, color: colors.text.tertiary },
  clinicName: { fontSize: 11, color: colors.text.disabled, marginTop: 2 },
  selectedDoctorBar: { backgroundColor: colors.primary[600], padding: 16 },
  selectedDoctorName: { fontSize: 16, fontWeight: '600', color: colors.white },
  selectedDoctorSpec: { fontSize: 12, color: '#93c5fd' },
  section: { padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text.secondary, marginBottom: 12 },
  typeOption: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 2, borderColor: colors.border, alignItems: 'center', gap: 8 },
  typeOptionActive: { borderColor: colors.primary[600], backgroundColor: '#eff6ff' },
  typeLabel: { fontSize: 13, fontWeight: '600', color: colors.text.tertiary },
  dateCard: { width: 64, padding: 12, borderRadius: 12, backgroundColor: colors.white, marginRight: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  dateCardActive: { backgroundColor: colors.primary[600], borderColor: colors.primary[600] },
  dateCardDay: { fontSize: 11, color: colors.text.tertiary, fontWeight: '500' },
  dateCardNum: { fontSize: 20, fontWeight: 'bold', color: colors.text.secondary, marginVertical: 2 },
  dateCardMonth: { fontSize: 11, color: colors.text.disabled },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  slotButtonActive: { backgroundColor: colors.primary[600], borderColor: colors.primary[600] },
  slotText: { fontSize: 13, color: colors.text.secondary, fontWeight: '500' },
  primaryButton: { backgroundColor: colors.primary[600], paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  confirmCard: { margin: 24, backgroundColor: colors.white, borderRadius: 16, padding: 24, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 },
  confirmTitle: { fontSize: 22, fontWeight: 'bold', color: colors.text.secondary, textAlign: 'center' },
  confirmSubtext: { fontSize: 14, color: colors.text.tertiary, textAlign: 'center', marginBottom: 24 },
  confirmDetails: { marginBottom: 24 },
});
