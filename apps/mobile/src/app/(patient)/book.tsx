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
              <Text style={[styles.typeLabel, consultationType === 'in-person' && { color: '#1d4ed8' }]}>In-Person</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeOption, consultationType === 'video' && styles.typeOptionActive]}
              onPress={() => setConsultationType('video')}
            >
              <Text style={{ fontSize: 24 }}>📹</Text>
              <Text style={[styles.typeLabel, consultationType === 'video' && { color: '#1d4ed8' }]}>Video Call</Text>
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
                <Text style={[styles.dateCardDay, selectedDate === d.date && { color: '#fff' }]}>{d.day}</Text>
                <Text style={[styles.dateCardNum, selectedDate === d.date && { color: '#fff' }]}>{d.num}</Text>
                <Text style={[styles.dateCardMonth, selectedDate === d.date && { color: '#dbeafe' }]}>{d.month}</Text>
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
                  <Text style={[styles.slotText, selectedSlot === slot && { color: '#fff' }]}>{slot}</Text>
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
          placeholderTextColor="#9ca3af"
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
                <Text style={{ fontSize: 12, color: '#f59e0b' }}>★ {doctor.rating}</Text>
                <Text style={{ fontSize: 12, color: '#10b981' }}>₹{doctor.fee}</Text>
              </View>
            </View>
            <Text style={{ color: '#3b82f6', fontWeight: '600', fontSize: 13 }}>Book →</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
      <Text style={{ color: '#6b7280', fontSize: 14 }}>{label}</Text>
      <Text style={{ fontWeight: '600', fontSize: 14, color: '#1f2937' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  searchContainer: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  searchInput: { backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, fontSize: 14 },
  doctorCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, padding: 16, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  doctorAvatar: { width: 48, height: 48, backgroundColor: '#eff6ff', borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  doctorName: { fontSize: 15, fontWeight: '600', color: '#1f2937' },
  doctorSpec: { fontSize: 12, color: '#6b7280' },
  clinicName: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  selectedDoctorBar: { backgroundColor: '#1d4ed8', padding: 16 },
  selectedDoctorName: { fontSize: 16, fontWeight: '600', color: '#fff' },
  selectedDoctorSpec: { fontSize: 12, color: '#93c5fd' },
  section: { padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1f2937', marginBottom: 12 },
  typeOption: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 2, borderColor: '#e5e7eb', alignItems: 'center', gap: 8 },
  typeOptionActive: { borderColor: '#1d4ed8', backgroundColor: '#eff6ff' },
  typeLabel: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  dateCard: { width: 64, padding: 12, borderRadius: 12, backgroundColor: '#fff', marginRight: 8, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  dateCardActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  dateCardDay: { fontSize: 11, color: '#6b7280', fontWeight: '500' },
  dateCardNum: { fontSize: 20, fontWeight: 'bold', color: '#1f2937', marginVertical: 2 },
  dateCardMonth: { fontSize: 11, color: '#9ca3af' },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  slotButtonActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  slotText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  primaryButton: { backgroundColor: '#1d4ed8', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  confirmCard: { margin: 24, backgroundColor: '#fff', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 },
  confirmTitle: { fontSize: 22, fontWeight: 'bold', color: '#1f2937', textAlign: 'center' },
  confirmSubtext: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 24 },
  confirmDetails: { marginBottom: 24 },
});
