'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

interface AbdmStatus {
  abhaNumber: string | null;
  abhaAddress: string | null;
  abdmLinked: boolean;
  consents: ConsentRecord[];
  healthRecords: HealthRecord[];
}

interface ConsentRecord {
  id: string;
  consent_request_id: string;
  status: string;
  purpose: string;
  created_at: string;
  responded_at: string | null;
}

interface HealthRecord {
  id: string;
  record_type: string;
  source_hip: string;
  fetched_at: string;
  status: string;
}

export default function AbdmPage() {
  const { id: patientId } = useParams();
  const { token } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<AbdmStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');

  // Link ABHA states
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [abhaInput, setAbhaInput] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [aadhaarInput, setAadhaarInput] = useState('');
  const [txnId, setTxnId] = useState('');
  const [otpInput, setOtpInput] = useState('');

  useEffect(() => {
    loadAbdmStatus();
  }, [patientId]);

  async function loadAbdmStatus() {
    try {
      const patient = await api.patients.get(patientId as string) as any;
      const consentsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/abdm/consent/${patientId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const consents = consentsRes.ok ? await consentsRes.json() : [];

      setStatus({
        abhaNumber: patient.abha_number || null,
        abhaAddress: patient.abha_address || null,
        abdmLinked: patient.abdm_linked || false,
        consents,
        healthRecords: [],
      });
    } catch (err) {
      console.error('Failed to load ABDM status:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleLinkAbha() {
    setActionLoading('link');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/abdm/abha/link`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, abhaNumber: abhaInput }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('ABHA linked successfully!');
        setShowLinkModal(false);
        loadAbdmStatus();
      } else {
        alert(data.error || 'Failed to link ABHA');
      }
    } catch (err) {
      alert('Failed to link ABHA');
    } finally {
      setActionLoading('');
    }
  }

  async function handleCreateAbha() {
    setActionLoading('create');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/abdm/abha/create`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, aadhaarNumber: aadhaarInput }),
      });
      const data = await res.json();
      if (res.ok) {
        setTxnId(data.txnId);
        setOtpStep(true);
      } else {
        alert(data.error || 'Failed to send OTP');
      }
    } catch (err) {
      alert('Failed to create ABHA');
    } finally {
      setActionLoading('');
    }
  }

  async function handleVerifyOtp() {
    setActionLoading('verify');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/abdm/abha/verify-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, txnId, otp: otpInput }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`ABHA created: ${data.abhaNumber}`);
        setShowLinkModal(false);
        setOtpStep(false);
        loadAbdmStatus();
      } else {
        alert(data.error || 'OTP verification failed');
      }
    } catch (err) {
      alert('Verification failed');
    } finally {
      setActionLoading('');
    }
  }

  async function handleRequestConsent() {
    setActionLoading('consent');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/abdm/consent/request`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          purpose: 'CAREMGT',
          healthInfoTypes: ['Prescription', 'DiagnosticReport', 'OPConsultation', 'DischargeSummary'],
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        loadAbdmStatus();
      } else {
        alert(data.error || 'Consent request failed');
      }
    } catch (err) {
      alert('Failed to request consent');
    } finally {
      setActionLoading('');
    }
  }

  async function handlePushRecords(consultationId: string) {
    setActionLoading('push');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/abdm/records/push`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, consultationId }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('Records pushed to ABDM!');
      } else {
        alert(data.error || 'Failed to push records');
      }
    } catch (err) {
      alert('Failed to push records');
    } finally {
      setActionLoading('');
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="h-32 bg-gray-100 rounded" />
          <div className="h-48 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-2 block">
            ← Back to Patient
          </button>
          <h1 className="text-2xl font-bold text-gray-900">ABDM / ABHA Integration</h1>
          <p className="text-sm text-gray-500">Ayushman Bharat Digital Mission - Health Records</p>
        </div>
      </div>

      {/* ABHA Status Card */}
      <div className={`rounded-xl border p-6 ${status?.abdmLinked ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">
              {status?.abdmLinked ? 'ABHA Linked' : 'ABHA Not Linked'}
            </h3>
            {status?.abhaNumber && (
              <div className="mt-2 space-y-1">
                <p className="text-sm"><span className="text-gray-500">ABHA Number:</span> <span className="font-mono font-medium">{status.abhaNumber}</span></p>
                <p className="text-sm"><span className="text-gray-500">ABHA Address:</span> <span className="font-mono font-medium">{status.abhaAddress}</span></p>
              </div>
            )}
          </div>
          {!status?.abdmLinked && (
            <button
              onClick={() => setShowLinkModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Link ABHA
            </button>
          )}
        </div>
      </div>

      {/* Actions */}
      {status?.abdmLinked && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={handleRequestConsent}
            disabled={actionLoading === 'consent'}
            className="p-4 bg-white rounded-xl border hover:border-blue-300 hover:shadow-sm transition-all text-left"
          >
            <div className="text-2xl mb-2">📋</div>
            <h4 className="font-semibold">Request Health Records</h4>
            <p className="text-sm text-gray-500 mt-1">Fetch records from other hospitals via ABDM consent</p>
          </button>

          <button
            onClick={() => handlePushRecords('latest')}
            disabled={actionLoading === 'push'}
            className="p-4 bg-white rounded-xl border hover:border-green-300 hover:shadow-sm transition-all text-left"
          >
            <div className="text-2xl mb-2">📤</div>
            <h4 className="font-semibold">Push Records to ABDM</h4>
            <p className="text-sm text-gray-500 mt-1">Share this patient's records with ABDM network</p>
          </button>

          <div className="p-4 bg-white rounded-xl border text-left">
            <div className="text-2xl mb-2">🔒</div>
            <h4 className="font-semibold">Consent History</h4>
            <p className="text-sm text-gray-500 mt-1">{status.consents.length} consent request(s)</p>
          </div>
        </div>
      )}

      {/* Consent History */}
      {status?.consents && status.consents.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Consent Requests</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 font-medium text-gray-500">Request ID</th>
                <th className="text-left p-3 font-medium text-gray-500">Purpose</th>
                <th className="text-left p-3 font-medium text-gray-500">Status</th>
                <th className="text-left p-3 font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody>
              {status.consents.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-3 font-mono text-xs">{c.consent_request_id.slice(0, 16)}...</td>
                  <td className="p-3">{c.purpose}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.status === 'GRANTED' ? 'bg-green-100 text-green-700' :
                      c.status === 'DENIED' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="p-3 text-gray-500">{new Date(c.created_at).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Link ABHA Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Link ABHA Number</h3>

            {!otpStep ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Existing ABHA Number</label>
                  <input
                    type="text"
                    value={abhaInput}
                    onChange={(e) => setAbhaInput(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="XX-XXXX-XXXX-XXXX"
                  />
                  <button
                    onClick={handleLinkAbha}
                    disabled={!abhaInput || actionLoading === 'link'}
                    className="mt-2 w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {actionLoading === 'link' ? 'Linking...' : 'Link ABHA'}
                  </button>
                </div>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-sm"><span className="bg-white px-2 text-gray-400">OR</span></div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Create New ABHA (via Aadhaar)</label>
                  <input
                    type="text"
                    value={aadhaarInput}
                    onChange={(e) => setAadhaarInput(e.target.value.replace(/\D/g, '').slice(0, 12))}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="12-digit Aadhaar Number"
                    maxLength={12}
                  />
                  <button
                    onClick={handleCreateAbha}
                    disabled={aadhaarInput.length !== 12 || actionLoading === 'create'}
                    className="mt-2 w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {actionLoading === 'create' ? 'Sending OTP...' : 'Send Aadhaar OTP'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">OTP sent to Aadhaar-linked mobile number</p>
                <input
                  type="text"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-3 py-2 border rounded-lg text-center text-2xl tracking-widest"
                  placeholder="------"
                  maxLength={6}
                />
                <button
                  onClick={handleVerifyOtp}
                  disabled={otpInput.length !== 6 || actionLoading === 'verify'}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {actionLoading === 'verify' ? 'Verifying...' : 'Verify & Create ABHA'}
                </button>
              </div>
            )}

            <button onClick={() => { setShowLinkModal(false); setOtpStep(false); }} className="mt-4 w-full py-2 text-gray-500 hover:text-gray-700">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
