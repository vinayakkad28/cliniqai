"use client";

import { useState, useEffect } from "react";

interface DoctorInfo {
  id: string;
  name: string;
  specialties: string[];
  bio: string | null;
  clinic: { name: string; address: string } | null;
  workingHours: { dayOfWeek: string; startTime: string; endTime: string; slotDurationMins: number }[];
}

interface BookingResult {
  appointmentId: string;
  message: string;
  doctor: string;
  date: string;
  time: string;
  scheduledAt: string;
}

type Step = "loading" | "slots" | "details" | "confirmed" | "error";

export default function BookingPage({ params }: { params: { doctorId: string } }) {
  const { doctorId } = params;

  const [doctor, setDoctor] = useState<DoctorInfo | null>(null);
  const [step, setStep] = useState<Step>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  // Slot selection
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Patient details
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState("");

  // Confirmation
  const [booking, setBooking] = useState<BookingResult | null>(null);

  // Set default date to today IST
  useEffect(() => {
    const now = new Date();
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    setSelectedDate(ist.toISOString().split("T")[0]);
  }, []);

  // Fetch doctor info
  useEffect(() => {
    fetch(`/api/public/doctors/${doctorId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Doctor not found");
        return r.json();
      })
      .then((data: DoctorInfo) => {
        setDoctor(data);
        setStep("slots");
      })
      .catch(() => {
        setErrorMsg("Doctor not found or booking is unavailable.");
        setStep("error");
      });
  }, [doctorId]);

  // Fetch slots when date changes
  useEffect(() => {
    if (!selectedDate || !doctor) return;
    setLoadingSlots(true);
    setSelectedSlot("");
    fetch(`/api/public/doctors/${doctorId}/slots?date=${selectedDate}`)
      .then((r) => r.json())
      .then((data) => {
        setSlots(data.slots ?? []);
      })
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, doctor, doctorId]);

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      setFieldError("Enter a valid 10-digit phone number");
      return;
    }
    if (!name.trim()) {
      setFieldError("Name is required");
      return;
    }
    setFieldError("");
    setSubmitting(true);

    try {
      const phoneFormatted = cleanPhone.startsWith("91") ? `+${cleanPhone}` : `+91${cleanPhone}`;
      const res = await fetch("/api/public/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId,
          phone: phoneFormatted,
          name: name.trim(),
          date: selectedDate,
          time: selectedSlot,
          reason: reason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFieldError(data.error ?? "Booking failed. Please try again.");
        return;
      }

      setBooking(data);
      setStep("confirmed");
    } catch {
      setFieldError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Generate next 14 days for date picker
  const dateOptions: string[] = [];
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  for (let i = 0; i < 14; i++) {
    const d = new Date(ist);
    d.setDate(d.getDate() + i);
    dateOptions.push(d.toISOString().split("T")[0]);
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" });
  }

  function formatTime(time: string) {
    const [h, m] = time.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  }

  if (step === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </main>
    );
  }

  if (step === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl bg-card shadow-lg border border-border/50 p-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-destructive/10 mb-4">
            <svg className="w-7 h-7 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-heading font-bold text-foreground mb-2">Unavailable</h1>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
        </div>
      </main>
    );
  }

  if (step === "confirmed" && booking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-accent/10 blur-3xl" />
        </div>
        <div className="relative w-full max-w-md rounded-2xl bg-card shadow-lg border border-border/50 p-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 mb-4">
            <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground mb-1">Appointment Confirmed!</h1>
          <p className="text-sm text-muted-foreground mb-6">Your appointment has been booked successfully.</p>

          <div className="rounded-xl border border-border bg-muted/30 p-4 text-left space-y-3 mb-6">
            <div>
              <p className="text-xs text-muted-foreground">Doctor</p>
              <p className="text-sm font-medium text-foreground">Dr. {booking.doctor}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Date & Time</p>
              <p className="text-sm font-medium text-foreground">
                {formatDate(booking.date)} at {formatTime(booking.time)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Appointment ID</p>
              <p className="text-xs font-mono text-muted-foreground">{booking.appointmentId}</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            A confirmation SMS has been sent to your phone number.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-secondary/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg rounded-2xl bg-card/90 backdrop-blur-sm shadow-lg border border-border/50 p-6 sm:p-8">
        {/* Doctor Info */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary mb-3">
            <svg className="w-6 h-6 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h1 className="text-xl font-heading font-bold text-foreground">
            Book Appointment
          </h1>
          {doctor && (
            <div className="mt-2">
              <p className="text-base font-medium text-foreground">Dr. {doctor.name}</p>
              {doctor.specialties.length > 0 && (
                <p className="text-sm text-muted-foreground">{doctor.specialties.join(", ")}</p>
              )}
              {doctor.clinic && (
                <p className="text-xs text-muted-foreground mt-1">{doctor.clinic.name}</p>
              )}
            </div>
          )}
        </div>

        {step === "slots" ? (
          <div className="space-y-5">
            {/* Date Selection */}
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-2">Select Date</label>
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2">
                {dateOptions.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDate(d)}
                    className={`flex-shrink-0 cursor-pointer rounded-lg px-3 py-2 text-center text-sm border transition-colors ${
                      selectedDate === d
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border text-card-foreground hover:border-primary/50"
                    }`}
                  >
                    <div className="text-xs opacity-75">
                      {new Date(d + "T12:00:00").toLocaleDateString("en-IN", { weekday: "short" })}
                    </div>
                    <div className="font-medium">
                      {new Date(d + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Time Slots */}
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-2">Select Time</label>
              {loadingSlots ? (
                <div className="py-8 text-center text-sm text-muted-foreground animate-pulse">Loading slots...</div>
              ) : slots.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No available slots for this date.
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {slots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`cursor-pointer rounded-lg px-2 py-2 text-sm border transition-colors ${
                        selectedSlot === slot
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card border-border text-card-foreground hover:border-primary/50"
                      }`}
                    >
                      {formatTime(slot)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Continue Button */}
            <button
              type="button"
              disabled={!selectedSlot}
              onClick={() => setStep("details")}
              className="w-full cursor-pointer rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              Continue
            </button>
          </div>
        ) : step === "details" ? (
          <form onSubmit={handleBook} className="space-y-4">
            <div className="rounded-lg bg-muted/50 border border-border px-3 py-2 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Appointment</p>
                <p className="text-sm font-medium text-card-foreground">
                  {formatDate(selectedDate)} at {formatTime(selectedSlot)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep("slots")}
                className="cursor-pointer text-xs text-primary hover:underline"
              >
                Change
              </button>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-card-foreground mb-1">
                Full Name <span className="text-destructive">*</span>
              </label>
              <input
                id="name"
                type="text"
                required
                placeholder="Patient name"
                value={name}
                onChange={(e) => { setName(e.target.value); setFieldError(""); }}
                className="w-full rounded-lg border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-card-foreground mb-1">
                Phone Number <span className="text-destructive">*</span>
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-border bg-muted text-sm text-muted-foreground">
                  +91
                </span>
                <input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  required
                  placeholder="98765 43210"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value.replace(/[^\d]/g, "")); setFieldError(""); }}
                  maxLength={10}
                  className="w-full rounded-r-lg border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-card-foreground mb-1">
                Reason for Visit <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <textarea
                id="reason"
                placeholder="Brief description of your concern"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                maxLength={500}
                className="w-full rounded-lg border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary resize-none"
              />
            </div>

            {fieldError && <p className="text-sm text-destructive" role="alert">{fieldError}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full cursor-pointer rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {submitting ? "Booking..." : "Confirm Booking"}
            </button>
          </form>
        ) : null}

        <p className="mt-6 text-center text-2xs text-muted-foreground">
          Powered by <span className="font-medium text-primary">CliniqAI</span>
        </p>
      </div>
    </main>
  );
}
