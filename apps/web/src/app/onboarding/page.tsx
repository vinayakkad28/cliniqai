'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = 'welcome' | 'profile' | 'clinic' | 'hours' | 'staff' | 'preferences' | 'complete';

interface StepMeta {
  id: Step;
  label: string;
  description: string;
  icon: string;
}

interface StaffInvite {
  phone: string;
  name: string;
  role: 'nurse' | 'receptionist';
}

interface DaySchedule {
  day: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
  slotDuration: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS: StepMeta[] = [
  { id: 'welcome', label: 'Welcome', description: 'Welcome to CliniqAI', icon: '👋' },
  { id: 'profile', label: 'Doctor Profile', description: 'Your professional details', icon: '🩺' },
  { id: 'clinic', label: 'Clinic Setup', description: 'Your practice information', icon: '🏥' },
  { id: 'hours', label: 'Working Hours', description: 'When you see patients', icon: '🕐' },
  { id: 'staff', label: 'Staff', description: 'Invite your team', icon: '👥' },
  { id: 'preferences', label: 'Preferences', description: 'Customize your experience', icon: '⚙️' },
  { id: 'complete', label: 'All Set!', description: 'Start using CliniqAI', icon: '✅' },
];

const SPECIALTIES = [
  'General Practice',
  'Internal Medicine',
  'Pediatrics',
  'Dermatology',
  'Orthopedics',
  'Gynecology',
  'Cardiology',
  'ENT',
  'Ophthalmology',
  'Psychiatry',
  'Pulmonology',
  'Gastroenterology',
  'Neurology',
  'Urology',
  'Oncology',
  'Endocrinology',
  'Nephrology',
  'Rheumatology',
  'General Surgery',
  'Radiology',
];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'mr', label: 'Marathi' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'kn', label: 'Kannada' },
  { value: 'bn', label: 'Bengali' },
  { value: 'gu', label: 'Gujarati' },
  { value: 'ml', label: 'Malayalam' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<Step>>(new Set());

  // Profile state
  const [profile, setProfile] = useState({
    name: user?.doctor?.name || '',
    specialties: [] as string[],
    licenseNumber: '',
    bio: '',
  });

  // Clinic state
  const [clinic, setClinic] = useState({
    name: '',
    address: '',
    gstNumber: '',
    logoUrl: '',
  });
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Working hours state
  const [hours, setHours] = useState<DaySchedule[]>(
    DAYS_OF_WEEK.map((day) => ({
      day,
      enabled: day !== 'Sunday',
      startTime: '09:00',
      endTime: '17:00',
      slotDuration: 15,
    }))
  );

  // Staff state
  const [staffList, setStaffList] = useState<StaffInvite[]>([]);
  const [newStaff, setNewStaff] = useState<StaffInvite>({ phone: '', name: '', role: 'nurse' });
  const [invitedStaff, setInvitedStaff] = useState<string[]>([]);

  // Preferences state
  const [preferences, setPreferences] = useState({
    language: 'en',
    notifications: {
      appointments: true,
      reminders: true,
      reports: true,
      marketing: false,
    },
    theme: 'light' as 'light' | 'dark' | 'system',
  });

  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  // Specialty toggle
  const toggleSpecialty = useCallback((specialty: string) => {
    setProfile((prev) => ({
      ...prev,
      specialties: prev.specialties.includes(specialty)
        ? prev.specialties.filter((s) => s !== specialty)
        : [...prev.specialties, specialty],
    }));
  }, []);

  // Add staff member to list
  const addStaffMember = useCallback(() => {
    if (!newStaff.phone || !newStaff.name) return;
    setStaffList((prev) => [...prev, { ...newStaff }]);
    setNewStaff({ phone: '', name: '', role: 'nurse' });
  }, [newStaff]);

  // Remove staff member from list
  const removeStaffMember = useCallback((index: number) => {
    setStaffList((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Navigate to a specific step
  const goToStep = useCallback((step: Step) => {
    setError(null);
    setCurrentStep(step);
  }, []);

  // Handle back navigation
  const handleBack = useCallback(() => {
    const prevStep = STEPS[currentIndex - 1];
    if (prevStep) goToStep(prevStep.id);
  }, [currentIndex, goToStep]);

  // Handle next / save for each step
  async function handleNext() {
    setSaving(true);
    setError(null);

    try {
      if (currentStep === 'welcome') {
        goToStep('profile');
      } else if (currentStep === 'profile') {
        if (!profile.name.trim()) {
          setError('Please enter your name.');
          setSaving(false);
          return;
        }
        await api.doctors.patchMe({
          name: profile.name.trim(),
          specialties: profile.specialties.length > 0 ? profile.specialties : undefined,
          licenseNumber: profile.licenseNumber || undefined,
          bio: profile.bio || undefined,
        });
        setCompletedSteps((prev) => new Set(prev).add('profile'));
        goToStep('clinic');
      } else if (currentStep === 'clinic') {
        if (!clinic.name.trim()) {
          setError('Please enter your clinic name.');
          setSaving(false);
          return;
        }
        await api.clinic.patch({
          name: clinic.name.trim(),
          address: clinic.address.trim() || undefined,
          gstNumber: clinic.gstNumber.trim() || undefined,
          logoUrl: clinic.logoUrl || undefined,
        });
        setCompletedSteps((prev) => new Set(prev).add('clinic'));
        goToStep('hours');
      } else if (currentStep === 'hours') {
        const workingHours = hours
          .filter((h) => h.enabled)
          .map((h) => ({
            dayOfWeek: h.day.toLowerCase(),
            startTime: h.startTime,
            endTime: h.endTime,
            slotDurationMins: h.slotDuration,
          }));
        if (workingHours.length > 0) {
          await api.doctors.putWorkingHours(workingHours);
        }
        setCompletedSteps((prev) => new Set(prev).add('hours'));
        goToStep('staff');
      } else if (currentStep === 'staff') {
        // Invite all staff that haven't been invited yet
        for (const member of staffList) {
          if (!invitedStaff.includes(member.phone)) {
            try {
              await api.staff.create({
                phone: member.phone,
                name: member.name,
                role: member.role,
              });
              setInvitedStaff((prev) => [...prev, member.phone]);
            } catch (err) {
              console.error(`Failed to invite ${member.name}:`, err);
            }
          }
        }
        setCompletedSteps((prev) => new Set(prev).add('staff'));
        goToStep('preferences');
      } else if (currentStep === 'preferences') {
        // Preferences are stored locally for now
        localStorage.setItem('cliniqai_language', preferences.language);
        localStorage.setItem('cliniqai_theme', preferences.theme);
        localStorage.setItem('cliniqai_notifications', JSON.stringify(preferences.notifications));
        setCompletedSteps((prev) => new Set(prev).add('preferences'));
        goToStep('complete');
      } else if (currentStep === 'complete') {
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Onboarding step error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ─── Render Helpers ──────────────────────────────────────────────────────────

  function renderProgressBar() {
    return (
      <div className="flex items-center justify-between mb-2">
        {STEPS.map((step, i) => {
          const isCompleted = completedSteps.has(step.id);
          const isCurrent = i === currentIndex;
          const isPast = i < currentIndex;

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <button
                onClick={() => {
                  if (isPast || isCompleted) goToStep(step.id);
                }}
                disabled={!isPast && !isCompleted && !isCurrent}
                className={`
                  relative w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold
                  transition-all duration-300 shrink-0
                  ${isCompleted || isPast
                    ? 'bg-primary-700 text-white shadow-md cursor-pointer hover:bg-primary-800'
                    : isCurrent
                      ? 'bg-primary-700 text-white shadow-lg ring-4 ring-primary-200'
                      : 'bg-slate-200 text-slate-400 cursor-default'
                  }
                `}
                title={step.label}
              >
                {isCompleted || isPast ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </button>
              {i < STEPS.length - 1 && (
                <div className="flex-1 mx-2">
                  <div className="h-1 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isPast || isCompleted ? 'bg-primary-700 w-full' : 'bg-slate-200 w-0'
                      }`}
                      style={{ width: isPast || isCompleted ? '100%' : '0%' }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function renderStepLabels() {
    return (
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((step, i) => {
          const isCurrent = i === currentIndex;
          return (
            <div key={step.id} className={`text-center flex-1 last:flex-none ${i < STEPS.length - 1 ? '' : ''}`}>
              <span
                className={`text-xs font-medium transition-colors duration-300 hidden sm:block ${
                  isCurrent ? 'text-primary-700' : 'text-slate-400'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // ─── Step: Welcome ─────────────────────────────────────────────────────────

  function renderWelcome() {
    return (
      <div className="animate-slide-up text-center py-8">
        {/* Medical cross icon */}
        <div className="w-24 h-24 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-primary-200">
          <svg className="w-12 h-12 text-primary-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </div>

        <h2 className="text-3xl font-bold text-slate-900 mb-3">
          Welcome to CliniqAI
        </h2>
        <p className="text-lg text-slate-500 mb-8 max-w-md mx-auto">
          Your AI-powered clinic management platform. Let&apos;s set up your practice in just a few minutes.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto mb-8">
          <div className="cliniq-card p-4 text-center">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-700">AI Diagnosis</p>
            <p className="text-xs text-slate-400 mt-1">Smart clinical support</p>
          </div>
          <div className="cliniq-card p-4 text-center">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-700">Digital Rx</p>
            <p className="text-xs text-slate-400 mt-1">Voice prescriptions</p>
          </div>
          <div className="cliniq-card p-4 text-center">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-700">Analytics</p>
            <p className="text-xs text-slate-400 mt-1">Revenue insights</p>
          </div>
        </div>

        <p className="text-sm text-slate-400">
          This setup takes about 3-5 minutes. You can always update these settings later.
        </p>
      </div>
    );
  }

  // ─── Step: Profile ─────────────────────────────────────────────────────────

  function renderProfile() {
    return (
      <div className="animate-slide-up space-y-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-3 border-2 border-primary-200">
            <svg className="w-8 h-8 text-primary-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-900">Doctor Profile</h3>
          <p className="text-sm text-slate-500 mt-1">Tell us about yourself</p>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-200 focus:border-primary-700 transition-colors text-slate-900"
            placeholder="Dr. Vinayak Kad"
          />
        </div>

        {/* Specialties - Multi-select */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Specialties <span className="text-slate-400 text-xs font-normal">(select all that apply)</span>
          </label>
          <div className="flex flex-wrap gap-2 p-3 border border-slate-200 rounded-lg bg-slate-50 max-h-48 overflow-y-auto">
            {SPECIALTIES.map((specialty) => {
              const isSelected = profile.specialties.includes(specialty);
              return (
                <button
                  key={specialty}
                  type="button"
                  onClick={() => toggleSpecialty(specialty)}
                  className={`
                    px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200
                    ${isSelected
                      ? 'bg-primary-700 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:border-primary-200 hover:text-primary-700'
                    }
                  `}
                >
                  {isSelected && (
                    <svg className="w-3.5 h-3.5 inline mr-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {specialty}
                </button>
              );
            })}
          </div>
          {profile.specialties.length > 0 && (
            <p className="text-xs text-primary-700 mt-1.5">
              {profile.specialties.length} selected: {profile.specialties.join(', ')}
            </p>
          )}
        </div>

        {/* License Number */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            License / Registration Number
          </label>
          <input
            type="text"
            value={profile.licenseNumber}
            onChange={(e) => setProfile({ ...profile, licenseNumber: e.target.value })}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-200 focus:border-primary-700 transition-colors text-slate-900"
            placeholder="MH/12345/2020"
          />
        </div>

        {/* Bio */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Bio <span className="text-slate-400 text-xs font-normal">(optional, visible to patients)</span>
          </label>
          <textarea
            value={profile.bio}
            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-200 focus:border-primary-700 transition-colors text-slate-900 resize-none"
            rows={3}
            placeholder="Brief introduction about your practice and experience..."
            maxLength={500}
          />
          <p className="text-xs text-slate-400 mt-1 text-right">{profile.bio.length}/500</p>
        </div>
      </div>
    );
  }

  // ─── Step: Clinic ──────────────────────────────────────────────────────────

  function renderClinic() {
    return (
      <div className="animate-slide-up space-y-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-3 border-2 border-primary-200">
            <svg className="w-8 h-8 text-primary-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-900">Clinic Setup</h3>
          <p className="text-sm text-slate-500 mt-1">Configure your practice details</p>
        </div>

        {/* Clinic Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Clinic Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={clinic.name}
            onChange={(e) => setClinic({ ...clinic, name: e.target.value })}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-200 focus:border-primary-700 transition-colors text-slate-900"
            placeholder="CliniqAI Health Center"
          />
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Address</label>
          <textarea
            value={clinic.address}
            onChange={(e) => setClinic({ ...clinic, address: e.target.value })}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-200 focus:border-primary-700 transition-colors text-slate-900 resize-none"
            rows={2}
            placeholder="123, MG Road, Pune, Maharashtra 411001"
          />
        </div>

        {/* GST Number */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            GST Number <span className="text-slate-400 text-xs font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={clinic.gstNumber}
            onChange={(e) => setClinic({ ...clinic, gstNumber: e.target.value })}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-200 focus:border-primary-700 transition-colors text-slate-900"
            placeholder="27AABCT1234F1ZP"
          />
        </div>

        {/* Logo Upload */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Clinic Logo <span className="text-slate-400 text-xs font-normal">(optional)</span>
          </label>
          <div
            onClick={() => logoInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary-200 hover:bg-primary-50/30 transition-all duration-200"
          >
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  // In production, this would upload to cloud storage
                  const reader = new FileReader();
                  reader.onload = () => {
                    setClinic({ ...clinic, logoUrl: reader.result as string });
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
            {clinic.logoUrl ? (
              <div className="flex flex-col items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={clinic.logoUrl} alt="Clinic logo" className="w-16 h-16 rounded-lg object-cover mb-2" />
                <p className="text-sm text-primary-700 font-medium">Click to change logo</p>
              </div>
            ) : (
              <>
                <svg className="w-10 h-10 text-slate-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                </svg>
                <p className="text-sm text-slate-500 font-medium">Click to upload logo</p>
                <p className="text-xs text-slate-400 mt-1">PNG, JPG up to 2MB</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Step: Working Hours ───────────────────────────────────────────────────

  function renderHours() {
    return (
      <div className="animate-slide-up space-y-5">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-3 border-2 border-primary-200">
            <svg className="w-8 h-8 text-primary-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-900">Working Hours</h3>
          <p className="text-sm text-slate-500 mt-1">Set your availability for each day. You can change this later.</p>
        </div>

        <div className="space-y-2">
          {hours.map((h, i) => (
            <div
              key={h.day}
              className={`
                flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border transition-all duration-200
                ${h.enabled
                  ? 'bg-primary-50/50 border-primary-200'
                  : 'bg-slate-50 border-slate-200'
                }
              `}
            >
              {/* Day toggle */}
              <label className="flex items-center gap-2.5 sm:w-32 shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={h.enabled}
                  onChange={(e) => {
                    const updated = [...hours];
                    updated[i] = { ...updated[i], enabled: e.target.checked };
                    setHours(updated);
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-primary-700 focus:ring-primary-200"
                />
                <span className={`text-sm font-medium ${h.enabled ? 'text-slate-900' : 'text-slate-400'}`}>
                  {h.day}
                </span>
              </label>

              {h.enabled && (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="time"
                      value={h.startTime}
                      onChange={(e) => {
                        const updated = [...hours];
                        updated[i] = { ...updated[i], startTime: e.target.value };
                        setHours(updated);
                      }}
                      className="px-2 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-700"
                    />
                    <span className="text-slate-400 text-sm">to</span>
                    <input
                      type="time"
                      value={h.endTime}
                      onChange={(e) => {
                        const updated = [...hours];
                        updated[i] = { ...updated[i], endTime: e.target.value };
                        setHours(updated);
                      }}
                      className="px-2 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-700"
                    />
                  </div>

                  {/* Slot duration */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-xs text-slate-500 hidden sm:inline">Slot:</span>
                    <select
                      value={h.slotDuration}
                      onChange={(e) => {
                        const updated = [...hours];
                        updated[i] = { ...updated[i], slotDuration: Number(e.target.value) };
                        setHours(updated);
                      }}
                      className="px-2 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-700 bg-white"
                    >
                      <option value={10}>10 min</option>
                      <option value={15}>15 min</option>
                      <option value={20}>20 min</option>
                      <option value={30}>30 min</option>
                      <option value={45}>45 min</option>
                      <option value={60}>60 min</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Step: Staff ───────────────────────────────────────────────────────────

  function renderStaff() {
    return (
      <div className="animate-slide-up space-y-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-3 border-2 border-primary-200">
            <svg className="w-8 h-8 text-primary-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-900">Invite Staff</h3>
          <p className="text-sm text-slate-500 mt-1">Add your nurses and receptionists. You can skip this for now.</p>
        </div>

        {/* Staff list */}
        {staffList.length > 0 && (
          <div className="space-y-2">
            {staffList.map((member, i) => (
              <div key={i} className="cliniq-card p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${
                    member.role === 'nurse' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{member.name}</p>
                    <p className="text-xs text-slate-500">{member.phone} &middot; {member.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {invitedStaff.includes(member.phone) && (
                    <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Invited
                    </span>
                  )}
                  <button
                    onClick={() => removeStaffMember(i)}
                    className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                    title="Remove"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add new staff form */}
        <div className="cliniq-card p-4 space-y-3">
          <p className="text-sm font-medium text-slate-700">Add a team member</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={newStaff.name}
              onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-200 focus:border-primary-700 text-sm text-slate-900"
              placeholder="Full name"
            />
            <input
              type="tel"
              value={newStaff.phone}
              onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-200 focus:border-primary-700 text-sm text-slate-900"
              placeholder="Phone number"
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              value={newStaff.role}
              onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value as 'nurse' | 'receptionist' })}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-200 focus:border-primary-700 text-sm bg-white text-slate-900"
            >
              <option value="nurse">Nurse</option>
              <option value="receptionist">Receptionist</option>
            </select>
            <button
              type="button"
              onClick={addStaffMember}
              disabled={!newStaff.name || !newStaff.phone}
              className="cliniq-btn-secondary px-4 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + Add
            </button>
          </div>
        </div>

        {staffList.length === 0 && (
          <div className="text-center py-4">
            <p className="text-sm text-slate-400">No staff added yet. You can add team members anytime from Settings.</p>
          </div>
        )}
      </div>
    );
  }

  // ─── Step: Preferences ─────────────────────────────────────────────────────

  function renderPreferences() {
    return (
      <div className="animate-slide-up space-y-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-3 border-2 border-primary-200">
            <svg className="w-8 h-8 text-primary-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-900">Preferences</h3>
          <p className="text-sm text-slate-500 mt-1">Customize your CliniqAI experience</p>
        </div>

        {/* Language */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Language</label>
          <select
            value={preferences.language}
            onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-200 focus:border-primary-700 text-sm bg-white text-slate-900"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>{lang.label}</option>
            ))}
          </select>
        </div>

        {/* Theme */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Theme</label>
          <div className="grid grid-cols-3 gap-3">
            {(['light', 'dark', 'system'] as const).map((theme) => (
              <button
                key={theme}
                type="button"
                onClick={() => setPreferences({ ...preferences, theme })}
                className={`
                  p-3 rounded-lg border-2 text-center transition-all duration-200
                  ${preferences.theme === theme
                    ? 'border-primary-700 bg-primary-50 text-primary-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }
                `}
              >
                <div className="flex justify-center mb-1.5">
                  {theme === 'light' && (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                    </svg>
                  )}
                  {theme === 'dark' && (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                    </svg>
                  )}
                  {theme === 'system' && (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                    </svg>
                  )}
                </div>
                <span className="text-sm font-medium capitalize">{theme}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">Notifications</label>
          <div className="space-y-3">
            {[
              { key: 'appointments' as const, label: 'Appointment Reminders', desc: 'Get notified about upcoming appointments' },
              { key: 'reminders' as const, label: 'Follow-up Reminders', desc: 'Reminders for patient follow-ups' },
              { key: 'reports' as const, label: 'Reports & Analytics', desc: 'Weekly clinic performance reports' },
              { key: 'marketing' as const, label: 'Product Updates', desc: 'New features and announcements' },
            ].map((item) => (
              <label
                key={item.key}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-slate-700">{item.label}</p>
                  <p className="text-xs text-slate-400">{item.desc}</p>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={preferences.notifications[item.key]}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        notifications: {
                          ...preferences.notifications,
                          [item.key]: e.target.checked,
                        },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-slate-200 rounded-full peer peer-checked:bg-primary-700 transition-colors" />
                  <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm peer-checked:translate-x-4 transition-transform" />
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Step: Complete ────────────────────────────────────────────────────────

  function renderComplete() {
    return (
      <div className="animate-slide-up text-center py-8">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-green-200">
          <svg className="w-12 h-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.745 3.745 0 011.043 3.296A3.745 3.745 0 0121 12z" />
          </svg>
        </div>

        <h2 className="text-3xl font-bold text-slate-900 mb-3">You&apos;re All Set!</h2>
        <p className="text-lg text-slate-500 mb-8 max-w-md mx-auto">
          Your clinic is configured and ready. Start seeing patients with AI-powered assistance.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto mb-10">
          <div className="cliniq-card-elevated p-5 text-center">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-700">AI Diagnosis</p>
            <p className="text-xs text-slate-400 mt-1">Smart clinical support</p>
          </div>
          <div className="cliniq-card-elevated p-5 text-center">
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-700">Voice Rx</p>
            <p className="text-xs text-slate-400 mt-1">Dictate prescriptions</p>
          </div>
          <div className="cliniq-card-elevated p-5 text-center">
            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-700">X-Ray AI</p>
            <p className="text-xs text-slate-400 mt-1">Imaging analysis</p>
          </div>
        </div>

        <div className="cliniq-card p-4 max-w-md mx-auto text-left">
          <p className="text-sm font-medium text-slate-700 mb-2">Quick summary</p>
          <ul className="space-y-1.5 text-sm text-slate-500">
            {profile.name && <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Profile: Dr. {profile.name}</li>}
            {clinic.name && <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Clinic: {clinic.name}</li>}
            <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Working: {hours.filter(h => h.enabled).length} days/week</li>
            {staffList.length > 0 && <li className="flex items-center gap-2"><span className="text-green-500">&#10003;</span> Staff: {staffList.length} member{staffList.length > 1 ? 's' : ''} invited</li>}
          </ul>
        </div>
      </div>
    );
  }

  // ─── Main Render ───────────────────────────────────────────────────────────

  const stepContent: Record<Step, () => JSX.Element> = {
    welcome: renderWelcome,
    profile: renderProfile,
    clinic: renderClinic,
    hours: renderHours,
    staff: renderStaff,
    preferences: renderPreferences,
    complete: renderComplete,
  };

  const isSkippableStep = currentStep === 'staff';
  const isFirstStep = currentStep === 'welcome';
  const isLastStep = currentStep === 'complete';

  return (
    <div className="min-h-screen bg-surface-secondary">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-700 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <span className="text-lg font-bold text-primary-700">CliniqAI</span>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            Skip Setup
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Progress */}
        {!isFirstStep && (
          <div className="mb-8">
            {renderProgressBar()}
            {renderStepLabels()}
          </div>
        )}

        {/* Step card */}
        <div className="cliniq-card-elevated p-6 sm:p-8 max-w-2xl mx-auto">
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              {error}
            </div>
          )}

          {/* Step content */}
          {stepContent[currentStep]()}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
            <button
              onClick={handleBack}
              disabled={isFirstStep}
              className={`
                flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors
                ${isFirstStep
                  ? 'invisible'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                }
              `}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Back
            </button>

            <div className="flex items-center gap-3">
              {isSkippableStep && (
                <button
                  onClick={() => {
                    setCompletedSteps((prev) => new Set(prev).add('staff'));
                    goToStep('preferences');
                  }}
                  className="cliniq-btn-secondary px-4 py-2 text-sm"
                >
                  Skip for now
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={saving}
                className="cliniq-btn-primary px-6 py-2.5 text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </>
                ) : isLastStep ? (
                  <>
                    Go to Dashboard
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </>
                ) : isFirstStep ? (
                  <>
                    Get Started
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </>
                ) : (
                  <>
                    Save & Continue
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Step indicator for mobile */}
        <p className="text-center text-xs text-slate-400 mt-4">
          Step {currentIndex + 1} of {STEPS.length}
        </p>
      </div>
    </div>
  );
}
