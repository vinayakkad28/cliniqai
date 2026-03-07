"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const BASE = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001/api";
const AI_BASE = process.env["NEXT_PUBLIC_AI_URL"] ?? "http://localhost:8001";

interface Medication {
  drug: string;
  dose: string;
  frequency: string;
  duration: string;
  route: string;
  notes: string;
}

const BLANK_MED: Medication = { drug: "", dose: "", frequency: "", duration: "", route: "oral", notes: "" };

const FREQUENCIES = ["OD", "BD", "TDS", "QID", "SOS", "HS", "AC", "PC", "Stat"];
const ROUTES = ["oral", "iv", "im", "topical", "inhaled", "sublingual", "rectal", "ophthalmic", "otic"];
const DURATIONS = ["1 day", "3 days", "5 days", "7 days", "10 days", "14 days", "1 month", "3 months", "Ongoing"];

// ─── Type declarations for Web Speech API ─────────────────────────────────────
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    onend: (() => void) | null;
  }
  interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
  }
  interface SpeechRecognitionResultList {
    readonly length: number;
    [index: number]: SpeechRecognitionResult;
  }
  interface SpeechRecognitionResult {
    readonly length: number;
    readonly isFinal: boolean;
    [index: number]: SpeechRecognitionAlternative;
  }
  interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
  }
}

export default function NewPrescriptionPage({ params }: { params: { id: string } }) {
  const { id: consultationId } = params;
  const router = useRouter();

  const [medications, setMedications] = useState<Medication[]>([{ ...BLANK_MED }]);
  const [sendVia, setSendVia] = useState("none");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [ddiWarnings, setDdiWarnings] = useState<Array<{ drug_a: string; drug_b: string; severity: string; description: string }>>([]);
  const [requiresAck, setRequiresAck] = useState(false);

  // Voice dictation
  const [voiceMode, setVoiceMode] = useState(false);
  const [recordingMode, setRecordingMode] = useState<"browser" | "audio">("browser");
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiProcessing, setAiProcessing] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);

  // AI Audio mode (MediaRecorder)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [uploadTranscribing, setUploadTranscribing] = useState(false);
  const [mediaRecording, setMediaRecording] = useState(false);

  useEffect(() => {
    setSpeechSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  function startRecording() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    let finalTranscript = "";
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]!;
        if (result.isFinal) {
          finalTranscript += result[0]!.transcript + " ";
        } else {
          interim += result[0]!.transcript;
        }
      }
      setTranscript(finalTranscript + interim);
    };

    recognition.onerror = () => {
      setRecording(false);
    };

    recognition.onend = () => {
      setRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
    setTranscript("");
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    setRecording(false);
  }

  async function processTranscript() {
    if (!transcript.trim()) return;
    setAiProcessing(true);
    try {
      const token = localStorage.getItem("cliniqai_access_token") ?? "";
      const res = await fetch(`${AI_BASE}/voice/structure`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Internal-Token": token },
        body: JSON.stringify({ transcript }),
      });
      if (res.ok) {
        const data = await res.json();
        const meds = data.medications as Array<{ drug: string; dose: string; frequency: string; duration: string; route?: string; additional_instructions?: string }> | undefined;
        if (meds && meds.length > 0) {
          setMedications(meds.map((m) => ({
            drug: m.drug ?? "",
            dose: m.dose ?? "",
            frequency: m.frequency ?? "",
            duration: m.duration ?? "",
            route: m.route ?? "oral",
            notes: m.additional_instructions ?? "",
          })));
          setVoiceMode(false);
        }
      }
    } catch {
      // AI service not available; show transcript for manual entry
    } finally {
      setAiProcessing(false);
    }
  }

  async function startMediaRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setMediaRecording(true);
      setAudioBlob(null);
    } catch {
      // microphone access denied
    }
  }

  function stopMediaRecording() {
    mediaRecorderRef.current?.stop();
    setMediaRecording(false);
  }

  async function uploadAndTranscribe() {
    if (!audioBlob) return;
    setUploadTranscribing(true);
    try {
      const token = localStorage.getItem("cliniqai_access_token") ?? "";
      const form = new FormData();
      form.append("audio", audioBlob, "recording.webm");
      const res = await fetch(`${AI_BASE}/voice/transcribe`, {
        method: "POST",
        headers: { "X-Internal-Token": token },
        body: form,
      });
      if (res.ok) {
        const data = await res.json();
        const meds = data.structured?.medications as Array<{ drug: string; dose: string; frequency: string; duration: string; route?: string; additional_instructions?: string }> | undefined;
        if (meds && meds.length > 0) {
          setMedications(meds.map((m) => ({
            drug: m.drug ?? "",
            dose: m.dose ?? "",
            frequency: m.frequency ?? "",
            duration: m.duration ?? "",
            route: m.route ?? "oral",
            notes: m.additional_instructions ?? "",
          })));
          setVoiceMode(false);
        } else if (data.transcript) {
          // AI couldn't extract medications — show transcript for manual confirm
          setTranscript(data.transcript);
          setRecordingMode("browser");
        }
      }
    } catch {
      // silent fail
    } finally {
      setUploadTranscribing(false);
    }
  }

  function updateMed(i: number, field: keyof Medication, value: string) {
    setMedications((prev) => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
  }

  function addMed() {
    setMedications((prev) => [...prev, { ...BLANK_MED }]);
  }

  function removeMed(i: number) {
    setMedications((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(acknowledgeDdi = false) {
    const valid = medications.every((m) => m.drug && m.dose && m.frequency && m.duration);
    if (!valid) {
      setError("Please fill in all required fields for each medication.");
      return;
    }
    setSubmitting(true);
    setError("");
    setDdiWarnings([]);

    const token = localStorage.getItem("cliniqai_access_token") ?? "";
    try {
      const res = await fetch(`${BASE}/prescriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ consultationId, medications, sendVia, acknowledgeDdi }),
      });
      const data = await res.json();

      if (res.status === 422 && data.requiresConfirmation) {
        setDdiWarnings(data.ddiAlerts ?? []);
        setRequiresAck(true);
        setSubmitting(false);
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Failed to save prescription");
        setSubmitting(false);
        return;
      }

      router.replace(`/dashboard/consultations/${consultationId}`);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-900">← Back</button>
          <h1 className="text-xl font-bold text-gray-900">New Prescription</h1>
        </div>
        <button
          type="button"
          onClick={() => setVoiceMode(!voiceMode)}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            voiceMode ? "bg-red-50 border border-red-200 text-red-700" : "bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100"
          }`}
        >
          🎙️ {voiceMode ? "Close Voice" : "Voice Dictation"}
        </button>
      </div>

      {/* Voice dictation panel */}
      {voiceMode && (
        <div className="mb-5 rounded-xl border border-purple-200 bg-purple-50 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-purple-800">Voice Dictation</h2>
            <div className="flex gap-1 rounded-lg border border-purple-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setRecordingMode("browser")}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${recordingMode === "browser" ? "bg-purple-600 text-white" : "text-purple-700 hover:bg-purple-50"}`}
              >
                Browser
              </button>
              <button
                type="button"
                onClick={() => setRecordingMode("audio")}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${recordingMode === "audio" ? "bg-purple-600 text-white" : "text-purple-700 hover:bg-purple-50"}`}
              >
                AI Audio
              </button>
            </div>
          </div>

          {recordingMode === "browser" ? (
            <>
              <p className="mb-3 text-xs text-purple-600">
                Dictate using browser speech-to-text (e.g. &quot;Tab Paracetamol 500mg twice daily for 5 days&quot;)
              </p>
              <div className="flex gap-3 mb-3">
                {!recording ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
                  >
                    🎙️ Start Recording
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 animate-pulse"
                  >
                    ⏹ Stop
                  </button>
                )}
              </div>
              {transcript && (
                <div className="rounded-lg bg-white border border-purple-200 p-3 mb-3">
                  <p className="text-xs font-medium text-gray-500 mb-1">Transcript:</p>
                  <p className="text-sm text-gray-800">{transcript}</p>
                </div>
              )}
              {transcript && !recording && (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={processTranscript}
                    disabled={aiProcessing}
                    className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
                  >
                    {aiProcessing ? "AI Processing…" : "Extract Medications"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTranscript("")}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Clear
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="mb-3 text-xs text-purple-600">
                Records audio and sends to Gemini AI for transcription and medication extraction.
              </p>
              <div className="flex gap-3 mb-3">
                {!mediaRecording ? (
                  <button
                    type="button"
                    onClick={startMediaRecording}
                    className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
                  >
                    🎙️ Start Recording
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopMediaRecording}
                    className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 animate-pulse"
                  >
                    ⏹ Stop Recording
                  </button>
                )}
              </div>
              {audioBlob && !mediaRecording && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-purple-700">
                    Audio recorded ({(audioBlob.size / 1024).toFixed(0)} KB)
                  </span>
                  <button
                    type="button"
                    onClick={uploadAndTranscribe}
                    disabled={uploadTranscribing}
                    className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
                  >
                    {uploadTranscribing ? "Transcribing with AI…" : "Transcribe with AI"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudioBlob(null)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Discard
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="space-y-4">
        {medications.map((med, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Medication {i + 1}</h3>
              {medications.length > 1 && (
                <button type="button" onClick={() => removeMed(i)} className="text-xs text-red-500 hover:underline">Remove</button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="col-span-2 sm:col-span-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Drug Name *</label>
                <input
                  type="text"
                  value={med.drug}
                  onChange={(e) => updateMed(i, "drug", e.target.value)}
                  placeholder="e.g. Paracetamol 500mg Tab"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Dose *</label>
                <input
                  type="text"
                  value={med.dose}
                  onChange={(e) => updateMed(i, "dose", e.target.value)}
                  placeholder="e.g. 1 tab"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Frequency *</label>
                <select
                  value={med.frequency}
                  onChange={(e) => updateMed(i, "frequency", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select</option>
                  {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Duration *</label>
                <select
                  value={med.duration}
                  onChange={(e) => updateMed(i, "duration", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select</option>
                  {DURATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Route</label>
                <select
                  value={med.route}
                  onChange={(e) => updateMed(i, "route", e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {ROUTES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="col-span-2 sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Instructions <span className="text-gray-400">(optional)</span></label>
                <input
                  type="text"
                  value={med.notes}
                  onChange={(e) => updateMed(i, "notes", e.target.value)}
                  placeholder="e.g. Take after meals"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        ))}

        <button type="button" onClick={addMed} className="text-sm text-blue-600 hover:underline font-medium">
          + Add another medication
        </button>

        {/* DDI warnings */}
        {ddiWarnings.length > 0 && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-3">
            <p className="text-sm font-semibold text-orange-800">Drug Interaction Warnings</p>
            {ddiWarnings.map((w, i) => (
              <div key={i} className="rounded-lg bg-white border border-orange-100 px-3 py-2.5">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs font-bold rounded px-1.5 py-0.5 ${w.severity === "major" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                    {w.severity.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-600">{w.drug_a} + {w.drug_b}</span>
                </div>
                <p className="text-xs text-gray-700">{w.description}</p>
              </div>
            ))}
            {requiresAck && (
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={submitting}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
                >
                  Override & Save
                </button>
                <button
                  onClick={() => { setDdiWarnings([]); setRequiresAck(false); }}
                  className="rounded-lg bg-white border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Edit Medications
                </button>
              </div>
            )}
          </div>
        )}

        {/* Send via */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-2">Send prescription to patient via</label>
          <div className="flex gap-4">
            {["none", "whatsapp", "sms"].map((v) => (
              <label key={v} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" value={v} checked={sendVia === v} onChange={() => setSendVia(v)} className="text-blue-600" />
                <span className="text-sm text-gray-700 capitalize">{v === "none" ? "Don't send" : v}</span>
              </label>
            ))}
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>}

        {!requiresAck && (
          <button
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Save Prescription"}
          </button>
        )}
      </div>
    </div>
  );
}
