'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

type Step = 'profile' | 'clinic' | 'hours' | 'import' | 'done';

const STEPS: { id: Step; label: string; description: string }[] = [
  { id: 'profile', label: 'Doctor Profile', description: 'Your professional details' },
  { id: 'clinic', label: 'Clinic Setup', description: 'Your practice information' },
  { id: 'hours', label: 'Working Hours', description: 'When you see patients' },
  { id: 'import', label: 'Import Patients', description: 'Bring your existing patients' },
  { id: 'done', label: 'All Set!', description: 'Start using CliniqAI' },
];

export default function OnboardingPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('profile');
  const [saving, setSaving] = useState(false);

  // Profile state
  const [profile, setProfile] = useState({
    firstName: user?.first_name || '',
    lastName: user?.last_name || '',
    qualification: '',
    specialization: '',
    registrationNumber: '',
    experience: '',
  });

  // Clinic state
  const [clinic, setClinic] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    email: '',
    gstin: '',
  });

  // Working hours state
  const [hours, setHours] = useState(
    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => ({
      day,
      enabled: day !== 'Saturday',
      morning: { start: '09:00', end: '13:00' },
      evening: { start: '17:00', end: '20:00' },
    }))
  );

  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  async function handleNext() {
    setSaving(true);
    try {
      if (currentStep === 'profile') {
        await api.doctors.patchMe({
          name: `${profile.firstName} ${profile.lastName}`.trim(),
          specialties: profile.specialization ? [profile.specialization] : undefined,
          licenseNumber: profile.registrationNumber,
        });
        setCurrentStep('clinic');
      } else if (currentStep === 'clinic') {
        await api.clinic.patch({
          name: clinic.name,
          address: `${clinic.address}, ${clinic.city}, ${clinic.state} - ${clinic.pincode}`,
          gstNumber: clinic.gstin || undefined,
        });
        setCurrentStep('hours');
      } else if (currentStep === 'hours') {
        const workingHours = hours
          .filter((h) => h.enabled)
          .flatMap((h) => [
            { dayOfWeek: h.day.toLowerCase(), startTime: h.morning.start, endTime: h.morning.end, slotDurationMins: 15 },
            { dayOfWeek: h.day.toLowerCase(), startTime: h.evening.start, endTime: h.evening.end, slotDurationMins: 15 },
          ]);
        await api.doctors.putWorkingHours(workingHours);
        setCurrentStep('import');
      } else if (currentStep === 'import') {
        setCurrentStep('done');
      } else if (currentStep === 'done') {
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Onboarding step error:', err);
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-blue-600">CliniqAI</h1>
          <button onClick={() => router.push('/dashboard')} className="text-sm text-gray-500 hover:text-gray-700">
            Skip Setup →
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((step, i) => (
            <div key={step.id} className="flex items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  i < currentIndex
                    ? 'bg-green-500 text-white'
                    : i === currentIndex
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                }`}
              >
                {i < currentIndex ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-1 mx-2 rounded ${i < currentIndex ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">{STEPS[currentIndex].label}</h2>
          <p className="text-gray-500 mt-1">{STEPS[currentIndex].description}</p>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-xl shadow-sm border p-8 max-w-2xl mx-auto">
          {currentStep === 'profile' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={profile.firstName}
                    onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Vinayak"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={profile.lastName}
                    onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Kad"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Qualification *</label>
                <input
                  type="text"
                  value={profile.qualification}
                  onChange={(e) => setProfile({ ...profile, qualification: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="MBBS, MD"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Specialization</label>
                <select
                  value={profile.specialization}
                  onChange={(e) => setProfile({ ...profile, specialization: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select specialization</option>
                  <option value="General Practice">General Practice</option>
                  <option value="Internal Medicine">Internal Medicine</option>
                  <option value="Pediatrics">Pediatrics</option>
                  <option value="Dermatology">Dermatology</option>
                  <option value="Orthopedics">Orthopedics</option>
                  <option value="Gynecology">Gynecology</option>
                  <option value="Cardiology">Cardiology</option>
                  <option value="ENT">ENT</option>
                  <option value="Ophthalmology">Ophthalmology</option>
                  <option value="Psychiatry">Psychiatry</option>
                  <option value="Pulmonology">Pulmonology</option>
                  <option value="Gastroenterology">Gastroenterology</option>
                  <option value="Neurology">Neurology</option>
                  <option value="Urology">Urology</option>
                  <option value="Oncology">Oncology</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">MCI/NMC Registration No. *</label>
                  <input
                    type="text"
                    value={profile.registrationNumber}
                    onChange={(e) => setProfile({ ...profile, registrationNumber: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="MH/12345/2020"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Years of Experience</label>
                  <input
                    type="number"
                    value={profile.experience}
                    onChange={(e) => setProfile({ ...profile, experience: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="5"
                    min="0"
                    max="60"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 'clinic' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Clinic Name *</label>
                <input
                  type="text"
                  value={clinic.name}
                  onChange={(e) => setClinic({ ...clinic, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="CliniqAI Health Center"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                <textarea
                  value={clinic.address}
                  onChange={(e) => setClinic({ ...clinic, address: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                  placeholder="123, MG Road, Near City Hospital"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input
                    type="text"
                    value={clinic.city}
                    onChange={(e) => setClinic({ ...clinic, city: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Pune"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                  <select
                    value={clinic.state}
                    onChange={(e) => setClinic({ ...clinic, state: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select</option>
                    <option value="Maharashtra">Maharashtra</option>
                    <option value="Karnataka">Karnataka</option>
                    <option value="Tamil Nadu">Tamil Nadu</option>
                    <option value="Delhi">Delhi</option>
                    <option value="Gujarat">Gujarat</option>
                    <option value="Rajasthan">Rajasthan</option>
                    <option value="Uttar Pradesh">Uttar Pradesh</option>
                    <option value="West Bengal">West Bengal</option>
                    <option value="Telangana">Telangana</option>
                    <option value="Kerala">Kerala</option>
                    <option value="Andhra Pradesh">Andhra Pradesh</option>
                    <option value="Madhya Pradesh">Madhya Pradesh</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pincode *</label>
                  <input
                    type="text"
                    value={clinic.pincode}
                    onChange={(e) => setClinic({ ...clinic, pincode: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="411001"
                    maxLength={6}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Clinic Phone</label>
                  <input
                    type="tel"
                    value={clinic.phone}
                    onChange={(e) => setClinic({ ...clinic, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="+91 20 1234 5678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN (optional)</label>
                  <input
                    type="text"
                    value={clinic.gstin}
                    onChange={(e) => setClinic({ ...clinic, gstin: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="27AABCT1234F1ZP"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 'hours' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 mb-4">Set your consultation hours. You can change these anytime from Settings.</p>
              {hours.map((h, i) => (
                <div key={h.day} className={`flex items-center gap-4 p-3 rounded-lg ${h.enabled ? 'bg-blue-50' : 'bg-gray-50'}`}>
                  <label className="flex items-center gap-2 w-28">
                    <input
                      type="checkbox"
                      checked={h.enabled}
                      onChange={(e) => {
                        const updated = [...hours];
                        updated[i].enabled = e.target.checked;
                        setHours(updated);
                      }}
                      className="rounded border-gray-300 text-blue-600"
                    />
                    <span className={`text-sm font-medium ${h.enabled ? 'text-gray-900' : 'text-gray-400'}`}>{h.day}</span>
                  </label>
                  {h.enabled && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">Morning:</span>
                      <input
                        type="time"
                        value={h.morning.start}
                        onChange={(e) => {
                          const updated = [...hours];
                          updated[i].morning.start = e.target.value;
                          setHours(updated);
                        }}
                        className="px-2 py-1 border rounded text-sm"
                      />
                      <span>-</span>
                      <input
                        type="time"
                        value={h.morning.end}
                        onChange={(e) => {
                          const updated = [...hours];
                          updated[i].morning.end = e.target.value;
                          setHours(updated);
                        }}
                        className="px-2 py-1 border rounded text-sm"
                      />
                      <span className="text-gray-500 ml-2">Evening:</span>
                      <input
                        type="time"
                        value={h.evening.start}
                        onChange={(e) => {
                          const updated = [...hours];
                          updated[i].evening.start = e.target.value;
                          setHours(updated);
                        }}
                        className="px-2 py-1 border rounded text-sm"
                      />
                      <span>-</span>
                      <input
                        type="time"
                        value={h.evening.end}
                        onChange={(e) => {
                          const updated = [...hours];
                          updated[i].evening.end = e.target.value;
                          setHours(updated);
                        }}
                        className="px-2 py-1 border rounded text-sm"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {currentStep === 'import' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Import Your Patient List</h3>
              <p className="text-gray-500 mb-6">Upload a CSV file with your existing patients to get started quickly.</p>

              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-blue-400 transition-colors cursor-pointer">
                <input type="file" accept=".csv" className="hidden" id="csvUpload" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) alert(`Imported ${file.name}. Processing...`);
                }} />
                <label htmlFor="csvUpload" className="cursor-pointer">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm text-gray-600 font-medium">Click to upload CSV</p>
                  <p className="text-xs text-gray-400 mt-1">Columns: Name, Phone, Age, Gender, Blood Group</p>
                </label>
              </div>

              <p className="text-sm text-gray-400 mt-4">You can also add patients manually later from the Patients page.</p>
            </div>
          )}

          {currentStep === 'done' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">You're All Set!</h3>
              <p className="text-gray-500 mb-6">Your clinic is ready. Start seeing patients with AI-powered assistance.</p>

              <div className="grid grid-cols-3 gap-4 text-center mb-8">
                <div className="p-4 bg-blue-50 rounded-xl">
                  <p className="text-2xl font-bold text-blue-600">AI</p>
                  <p className="text-xs text-gray-500 mt-1">Diagnosis Assist</p>
                </div>
                <div className="p-4 bg-green-50 rounded-xl">
                  <p className="text-2xl font-bold text-green-600">Rx</p>
                  <p className="text-xs text-gray-500 mt-1">Voice Prescriptions</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-xl">
                  <p className="text-2xl font-bold text-purple-600">X-Ray</p>
                  <p className="text-xs text-gray-500 mt-1">AI Analysis</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            <button
              onClick={() => {
                const prev = STEPS[currentIndex - 1];
                if (prev) setCurrentStep(prev.id);
              }}
              disabled={currentIndex === 0}
              className="px-4 py-2 text-gray-500 hover:text-gray-700 disabled:invisible"
            >
              ← Back
            </button>
            <button
              onClick={handleNext}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {saving ? 'Saving...' : currentStep === 'done' ? 'Go to Dashboard' : currentStep === 'import' ? 'Skip & Continue' : 'Save & Continue →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
