'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { QRCode } from '@/components/QRCode';

interface EPrescriptionData {
  prescriptionId: string;
  doctorName: string;
  doctorRegistration: string;
  clinicName: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  date: string;
  diagnosis: string;
  medications: {
    drug: string;
    dose: string;
    frequency: string;
    duration: string;
    route: string;
    instructions?: string;
  }[];
  advice?: string;
  followUpDate?: string;
  signature: string;
  qrData: string;
}

export default function EPrescriptionPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
  const printRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<EPrescriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    generatePrescription();
  }, [id]);

  async function generatePrescription() {
    try {
      // First get the consultation to find the prescription
      const consultation = await api.consultations.get(id as string) as any;
      const prescriptionId = consultation.prescription_id ?? consultation.prescriptions?.[0]?.id;
      if (!prescriptionId) {
        setError('No prescription found for this consultation. Create a prescription first.');
        setLoading(false);
        return;
      }

      const res = await fetch(`${apiUrl}/e-prescription/${prescriptionId}/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Failed to generate e-prescription');
      const prescriptionData = await res.json();
      setData(prescriptionData);
    } catch (err: any) {
      setError(err.message || 'Failed to generate e-prescription');
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  async function handleShareWhatsApp() {
    if (!data) return;
    try {
      await fetch(`${apiUrl}/prescriptions/${data.prescriptionId}/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channel: 'whatsapp' }),
      });
      alert('Prescription sent via WhatsApp!');
    } catch {
      alert('Failed to send via WhatsApp');
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Generating e-prescription...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600">{error}</p>
          <button onClick={() => router.back()} className="mt-4 text-blue-600 hover:underline">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-6">
      {/* Action Bar */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
          ← Back to Consultation
        </button>
        <div className="flex gap-3">
          <button
            onClick={handleShareWhatsApp}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
            </svg>
            Share via WhatsApp
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Prescription Document */}
      <div ref={printRef} className="bg-white rounded-xl shadow-lg border max-w-3xl mx-auto print:shadow-none print:border-none">
        {/* Header */}
        <div className="border-b-2 border-blue-600 p-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold text-blue-800">{data.clinicName || 'CliniqAI Clinic'}</h1>
              <p className="text-gray-600 mt-1">{data.doctorName}</p>
              <p className="text-sm text-gray-500">{data.doctorRegistration && `Reg. No: ${data.doctorRegistration}`}</p>
            </div>
            <div className="text-right">
              <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full">
                E-PRESCRIPTION
              </span>
              <p className="text-sm text-gray-500 mt-2">Date: {data.date}</p>
              <p className="text-xs text-gray-400">ID: {data.prescriptionId.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>
        </div>

        {/* Patient Info */}
        <div className="bg-gray-50 px-6 py-3 flex gap-8 text-sm border-b">
          <div>
            <span className="text-gray-500">Patient: </span>
            <span className="font-medium">{data.patientName}</span>
          </div>
          <div>
            <span className="text-gray-500">Age: </span>
            <span className="font-medium">{data.patientAge} yrs</span>
          </div>
          <div>
            <span className="text-gray-500">Gender: </span>
            <span className="font-medium capitalize">{data.patientGender}</span>
          </div>
        </div>

        {/* Diagnosis */}
        {data.diagnosis && (
          <div className="px-6 py-3 border-b">
            <span className="text-sm text-gray-500">Diagnosis: </span>
            <span className="text-sm font-medium">{data.diagnosis}</span>
          </div>
        )}

        {/* Rx Symbol + Medications */}
        <div className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <span className="text-3xl font-serif text-blue-600">&#8478;</span>
            <div className="flex-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 font-medium">#</th>
                    <th className="pb-2 font-medium">Medication</th>
                    <th className="pb-2 font-medium">Dose</th>
                    <th className="pb-2 font-medium">Frequency</th>
                    <th className="pb-2 font-medium">Duration</th>
                    <th className="pb-2 font-medium">Route</th>
                  </tr>
                </thead>
                <tbody>
                  {data.medications.map((med, i) => (
                    <tr key={i} className="border-b border-dashed">
                      <td className="py-2 text-gray-400">{i + 1}</td>
                      <td className="py-2 font-medium">{med.drug}</td>
                      <td className="py-2">{med.dose}</td>
                      <td className="py-2">{med.frequency}</td>
                      <td className="py-2">{med.duration}</td>
                      <td className="py-2">{med.route}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Advice */}
          {data.advice && (
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-sm font-medium text-yellow-800">Advice:</p>
              <p className="text-sm text-yellow-700">{data.advice}</p>
            </div>
          )}

          {/* Follow-up */}
          {data.followUpDate && (
            <div className="mt-3 text-sm text-gray-600">
              <span className="font-medium">Follow-up: </span>
              {data.followUpDate}
            </div>
          )}
        </div>

        {/* Footer with QR + Signature */}
        <div className="border-t px-6 py-4 flex justify-between items-end">
          <div className="text-center">
            <QRCode
              data={data.qrData || `cliniqai://verify/${data.prescriptionId}`}
              size={96}
              className="border border-gray-200 rounded"
            />
            <p className="text-[10px] text-gray-400 mt-1">Scan to verify</p>
          </div>

          <div className="text-right">
            <div className="border-t border-gray-300 pt-2 mt-8 inline-block min-w-[200px]">
              <p className="text-sm font-medium">{data.doctorName}</p>
              <p className="text-xs text-gray-500">{data.doctorRegistration && `Reg: ${data.doctorRegistration}`}</p>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Digitally Signed</p>
          </div>
        </div>

        {/* Digital Verification Strip */}
        <div className="bg-gray-50 px-6 py-2 text-center border-t">
          <p className="text-[10px] text-gray-400">
            Digital Signature: {data.signature.slice(0, 32)}... | Generated via CliniqAI |{' '}
            Verify at app.cliniqai.com/verify/{data.prescriptionId.slice(0, 8)}
          </p>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:hidden { display: none !important; }
          #__next { visibility: visible; }
          [ref="printRef"], [ref="printRef"] * { visibility: visible; }
        }
      `}</style>
    </div>
  );
}
