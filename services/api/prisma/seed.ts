/**
 * Demo seed script — populates a realistic Indian clinic for live demos.
 *
 * Usage:  npx tsx prisma/seed.ts
 *
 * Creates:
 *   - 1 doctor (Dr. Priya Sharma, +919876543210, password: demo1234)
 *   - 1 clinic (CliniqAI Demo Clinic, Mumbai)
 *   - 12 patients with realistic Indian names and medical histories
 *   - 20 appointments (mix of completed, scheduled, walk-in)
 *   - 8 consultations with SOAP notes, vitals, diagnoses
 *   - 8 prescriptions with medications
 *   - 8 invoices (mix of paid/pending)
 *   - 5 medicines in pharmacy inventory
 *   - 3 lab orders
 *   - 2 follow-ups
 *   - Working hours (Mon-Sat 9am-6pm)
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uuid() {
  return crypto.randomUUID();
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), 0, 0);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(9 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), 0, 0);
  return d;
}

function today(hour: number, min = 0): Date {
  const d = new Date();
  d.setHours(hour, min, 0, 0);
  return d;
}

// ─── IDs ──────────────────────────────────────────────────────────────────────

const doctorUserId = uuid();
const doctorId = uuid();
const clinicId = uuid();

const patientIds = Array.from({ length: 12 }, () => ({ id: uuid(), userId: uuid() }));

// ─── Data ─────────────────────────────────────────────────────────────────────

const patients = [
  { name: "Rajesh Kumar", phone: "+919812345001", gender: "male", dob: "1985-03-15", bloodGroup: "B+", history: { allergies: ["Penicillin"], chronic: ["Type 2 Diabetes"], surgeries: [] } },
  { name: "Anita Deshmukh", phone: "+919812345002", gender: "female", dob: "1990-07-22", bloodGroup: "O+", history: { allergies: [], chronic: ["Hypertension"], surgeries: ["Appendectomy 2018"] } },
  { name: "Mohammed Irfan", phone: "+919812345003", gender: "male", dob: "1978-11-05", bloodGroup: "A+", history: { allergies: ["Sulfa drugs"], chronic: ["Asthma", "GERD"], surgeries: [] } },
  { name: "Sunita Patel", phone: "+919812345004", gender: "female", dob: "1965-01-30", bloodGroup: "AB+", history: { allergies: [], chronic: ["Osteoarthritis", "Hypothyroidism"], surgeries: ["Knee replacement 2022"] } },
  { name: "Vikram Singh", phone: "+919812345005", gender: "male", dob: "1992-09-12", bloodGroup: "O-", history: { allergies: ["NSAIDs"], chronic: [], surgeries: [] } },
  { name: "Priya Nair", phone: "+919812345006", gender: "female", dob: "1988-04-18", bloodGroup: "B+", history: { allergies: [], chronic: ["PCOS"], surgeries: [] } },
  { name: "Arun Mehta", phone: "+919812345007", gender: "male", dob: "1955-12-01", bloodGroup: "A-", history: { allergies: ["Aspirin"], chronic: ["CAD", "Hypertension", "Type 2 Diabetes"], surgeries: ["CABG 2019"] } },
  { name: "Deepa Krishnan", phone: "+919812345008", gender: "female", dob: "1995-06-25", bloodGroup: "O+", history: { allergies: [], chronic: [], surgeries: [] } },
  { name: "Sanjay Gupta", phone: "+919812345009", gender: "male", dob: "1970-08-14", bloodGroup: "B-", history: { allergies: [], chronic: ["Chronic kidney disease Stage 2"], surgeries: [] } },
  { name: "Kavita Reddy", phone: "+919812345010", gender: "female", dob: "1982-02-28", bloodGroup: "A+", history: { allergies: ["Codeine"], chronic: ["Migraine"], surgeries: [] } },
  { name: "Rohit Sharma", phone: "+919812345011", gender: "male", dob: "2000-05-10", bloodGroup: "O+", history: { allergies: [], chronic: [], surgeries: [] } },
  { name: "Fatima Begum", phone: "+919812345012", gender: "female", dob: "1975-10-03", bloodGroup: "AB-", history: { allergies: ["Metformin"], chronic: ["Rheumatoid Arthritis"], surgeries: [] } },
];

const consultationData = [
  {
    chief: "Persistent cough and fever for 5 days",
    diagnosis: "Acute upper respiratory tract infection",
    icd: ["J06.9"],
    soap: {
      subjective: "Patient reports dry cough x5 days, low-grade fever (99-100°F), mild sore throat. No breathlessness or chest pain. No recent travel.",
      objective: "Temp 99.4°F, throat mildly congested, bilateral clear lung fields, no lymphadenopathy.",
      assessment: "Acute URTI, likely viral. No signs of lower respiratory involvement.",
      plan: "Symptomatic management. Paracetamol 500mg TDS, cough syrup. Review if fever persists >3 days or new symptoms develop.",
    },
    vitals: { bp: "120/80", pulse: 88, temp: 99.4, spo2: 98, weight: 72, height: 170 },
    meds: [
      { name: "Paracetamol 500mg", dosage: "1 tablet", frequency: "Three times daily", duration: "5 days", instructions: "After food" },
      { name: "Dextromethorphan Syrup 10ml", dosage: "10ml", frequency: "Twice daily", duration: "5 days", instructions: "Before sleep" },
    ],
    amount: 500,
  },
  {
    chief: "Routine diabetes follow-up",
    diagnosis: "Type 2 Diabetes Mellitus — well controlled",
    icd: ["E11.65"],
    soap: {
      subjective: "Routine 3-monthly follow-up. Patient compliant with Metformin 500mg BD. No hypoglycemic episodes. Diet maintained. Walking 30 min daily.",
      objective: "BP 130/84, BMI 27.2, bilateral foot exam — normal sensation, pedal pulses present. Last HbA1c 6.8%.",
      assessment: "T2DM well controlled on current regimen. Mild overweight.",
      plan: "Continue Metformin 500mg BD. Repeat HbA1c + lipid panel in 3 months. Reinforce diet and exercise.",
    },
    vitals: { bp: "130/84", pulse: 76, temp: 98.6, spo2: 99, weight: 78, height: 169 },
    meds: [
      { name: "Metformin 500mg", dosage: "1 tablet", frequency: "Twice daily", duration: "90 days", instructions: "After food" },
    ],
    amount: 700,
  },
  {
    chief: "Severe headache and neck stiffness",
    diagnosis: "Migraine without aura",
    icd: ["G43.009"],
    soap: {
      subjective: "Patient c/o severe throbbing headache R temporal region since morning. Associated nausea, photophobia. Similar episodes 2-3x/month. No aura, no weakness.",
      objective: "Vitals stable. Neck supple (no true rigidity). Cranial nerves intact. Fundoscopy — no papilledema.",
      assessment: "Recurrent episodic migraine without aura. Frequency warrants prophylaxis.",
      plan: "Acute: Sumatriptan 50mg stat + Domperidone. Prophylaxis: Start Propranolol 20mg BD. Maintain headache diary. Review in 4 weeks.",
    },
    vitals: { bp: "118/76", pulse: 82, temp: 98.4, spo2: 99, weight: 62, height: 158 },
    meds: [
      { name: "Sumatriptan 50mg", dosage: "1 tablet", frequency: "As needed (max 2/day)", duration: "As needed", instructions: "At onset of migraine" },
      { name: "Domperidone 10mg", dosage: "1 tablet", frequency: "Three times daily", duration: "5 days", instructions: "Before food" },
      { name: "Propranolol 20mg", dosage: "1 tablet", frequency: "Twice daily", duration: "30 days", instructions: "Prophylaxis — do not stop abruptly" },
    ],
    amount: 800,
  },
  {
    chief: "Joint pain and morning stiffness in both knees",
    diagnosis: "Bilateral knee osteoarthritis — Grade 2",
    icd: ["M17.0"],
    soap: {
      subjective: "68F c/o bilateral knee pain, worse on stairs and after prolonged sitting. Morning stiffness ~20 min. Using paracetamol PRN. Previous knee replacement R side 2022.",
      objective: "Bilateral knee crepitus, mild effusion L knee. ROM: R 0-110°, L 0-100°. No instability. X-ray shows Grade 2 OA changes bilaterally.",
      assessment: "Bilateral knee OA, Grade 2. R knee status post TKR — doing well. L knee progressing.",
      plan: "Physiotherapy referral. Glucosamine 1500mg OD. Paracetamol 650mg SOS. Intra-articular hyaluronic acid injection L knee to consider if no improvement in 6 weeks.",
    },
    vitals: { bp: "138/86", pulse: 72, temp: 98.2, spo2: 97, weight: 74, height: 155 },
    meds: [
      { name: "Glucosamine 1500mg", dosage: "1 tablet", frequency: "Once daily", duration: "90 days", instructions: "With food" },
      { name: "Paracetamol 650mg", dosage: "1 tablet", frequency: "As needed (max 3/day)", duration: "As needed", instructions: "For pain relief" },
    ],
    amount: 1200,
  },
  {
    chief: "Skin rash and itching for 3 days",
    diagnosis: "Allergic contact dermatitis",
    icd: ["L23.9"],
    soap: {
      subjective: "22M presents with itchy red rash on both forearms x3 days. Started after wearing new watch. No fever, no mucosal involvement.",
      objective: "Erythematous papular rash on bilateral forearms, circumscribed to watch area on L wrist. No vesicles, no urticaria elsewhere.",
      assessment: "Allergic contact dermatitis, likely nickel allergy from new watch.",
      plan: "Avoid offending agent. Topical Betamethasone cream BD x7 days. Cetirizine 10mg OD x5 days. Review if spreading.",
    },
    vitals: { bp: "118/74", pulse: 72, temp: 98.6, spo2: 99, weight: 68, height: 175 },
    meds: [
      { name: "Betamethasone 0.1% Cream", dosage: "Apply thin layer", frequency: "Twice daily", duration: "7 days", instructions: "On affected areas only" },
      { name: "Cetirizine 10mg", dosage: "1 tablet", frequency: "Once daily at bedtime", duration: "5 days", instructions: "May cause drowsiness" },
    ],
    amount: 400,
  },
  {
    chief: "Abdominal pain and bloating after meals",
    diagnosis: "Functional dyspepsia",
    icd: ["K30"],
    soap: {
      subjective: "35F c/o upper abdominal discomfort and bloating after meals x2 weeks. No vomiting, no weight loss, no melena. Stress at work increased recently.",
      objective: "Abdomen soft, mild epigastric tenderness, no guarding. Bowel sounds normal. No hepatosplenomegaly.",
      assessment: "Functional dyspepsia. No alarm symptoms to suggest organic pathology.",
      plan: "PPI trial — Pantoprazole 40mg before breakfast x14 days. Dietary advice: small frequent meals, avoid spicy/oily food. Reassess if no improvement.",
    },
    vitals: { bp: "114/72", pulse: 78, temp: 98.6, spo2: 99, weight: 58, height: 162 },
    meds: [
      { name: "Pantoprazole 40mg", dosage: "1 tablet", frequency: "Once daily before breakfast", duration: "14 days", instructions: "Take 30 min before first meal" },
    ],
    amount: 500,
  },
  {
    chief: "Wheezing and breathlessness since last night",
    diagnosis: "Acute exacerbation of bronchial asthma",
    icd: ["J45.21"],
    soap: {
      subjective: "45M known asthmatic, c/o wheezing and SOB since last night. Triggered by dust exposure during house cleaning. Using Salbutamol inhaler — partial relief. No fever.",
      objective: "RR 22/min, bilateral rhonchi on auscultation, no creps. SpO2 94% on room air. Using accessory muscles mildly. PEFR 60% of predicted.",
      assessment: "Moderate acute exacerbation of bronchial asthma. Known trigger — dust/allergen exposure.",
      plan: "Nebulization with Salbutamol + Ipratropium x3 doses. Prednisolone 40mg x5 days. Step up maintenance: Budesonide/Formoterol 200/6 BD. Spacer technique education. Review in 48 hours.",
    },
    vitals: { bp: "128/82", pulse: 96, temp: 98.8, spo2: 94, weight: 80, height: 172 },
    meds: [
      { name: "Prednisolone 40mg", dosage: "1 tablet", frequency: "Once daily morning", duration: "5 days", instructions: "After breakfast, do not stop abruptly" },
      { name: "Budesonide/Formoterol 200/6 Inhaler", dosage: "2 puffs", frequency: "Twice daily", duration: "30 days", instructions: "Rinse mouth after use" },
      { name: "Salbutamol Inhaler 100mcg", dosage: "2 puffs", frequency: "As needed (max 8 puffs/day)", duration: "As needed", instructions: "Use spacer, rescue inhaler" },
    ],
    amount: 900,
  },
  {
    chief: "Follow-up — post CABG, BP and sugar monitoring",
    diagnosis: "Coronary artery disease — stable, post-CABG",
    icd: ["I25.10", "Z95.1"],
    soap: {
      subjective: "68M, post-CABG 2019. Routine 6-monthly cardiology follow-up. No chest pain, no SOB. Compliant with all medications. Walking 20 min daily.",
      objective: "BP 134/80, pulse 68 regular. JVP normal. S1S2 normal, no murmurs. Chest clear. Pedal edema absent. ECG: NSR, old Q waves in inferior leads.",
      assessment: "Stable CAD post-CABG. Hypertension — controlled. T2DM — review HbA1c result.",
      plan: "Continue current medications. Repeat 2D Echo + stress test if any new symptoms. HbA1c + lipid panel ordered. Next visit in 3 months.",
    },
    vitals: { bp: "134/80", pulse: 68, temp: 98.4, spo2: 98, weight: 72, height: 168 },
    meds: [
      { name: "Aspirin 75mg", dosage: "1 tablet", frequency: "Once daily", duration: "Ongoing", instructions: "After lunch" },
      { name: "Atorvastatin 40mg", dosage: "1 tablet", frequency: "Once daily at bedtime", duration: "Ongoing", instructions: "Continue indefinitely" },
      { name: "Metoprolol 25mg", dosage: "1 tablet", frequency: "Twice daily", duration: "Ongoing", instructions: "Do not skip doses" },
      { name: "Ramipril 5mg", dosage: "1 tablet", frequency: "Once daily", duration: "Ongoing", instructions: "Monitor BP regularly" },
    ],
    amount: 1500,
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🏥 Seeding CliniqAI demo data...\n");

  // Check if demo doctor already exists
  const existing = await prisma.user.findUnique({ where: { phone: "+919876543210" } });
  if (existing) {
    console.log("⚠️  Demo data already exists (doctor phone +919876543210 found). Skipping seed.");
    console.log("   To re-seed, delete the demo doctor first or reset the database.");
    return;
  }

  // ── 1. Doctor user ──────────────────────────────────────────────────────────

  const passwordHash = await bcrypt.hash("demo1234", 12);

  await prisma.user.create({
    data: {
      id: doctorUserId,
      phone: "+919876543210",
      email: "dr.priya@cliniqai.demo",
      passwordHash,
      role: "doctor",
      name: "Dr. Priya Sharma",
      doctor: {
        create: {
          id: doctorId,
          name: "Dr. Priya Sharma",
          specialties: ["General Medicine", "Internal Medicine"],
          licenseNumber: "MH-2015-12345",
          bio: "MBBS, MD (Internal Medicine) — 10 years experience. Special interest in diabetes management and preventive cardiology.",
        },
      },
    },
  });
  console.log("✓ Doctor: Dr. Priya Sharma (+919876543210 / dr.priya@cliniqai.demo)");

  // ── 2. Clinic ───────────────────────────────────────────────────────────────

  await prisma.clinic.create({
    data: {
      id: clinicId,
      name: "CliniqAI Demo Clinic",
      address: "301, Serenity Tower, Andheri West, Mumbai 400053",
      gstNumber: "27AABCU9603R1ZM",
      clinicDoctors: { create: { doctorId, role: "owner" } },
    },
  });
  console.log("✓ Clinic: CliniqAI Demo Clinic, Mumbai");

  // ── 3. Working hours (Mon-Sat 9am-6pm) ─────────────────────────────────────

  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
  for (const day of days) {
    await prisma.workingHours.create({
      data: { doctorId, dayOfWeek: day, startTime: "09:00", endTime: "18:00", slotDurationMins: 15 },
    });
  }
  console.log("✓ Working hours: Mon-Sat 9:00-18:00 (15 min slots)");

  // ── 4. Patients ─────────────────────────────────────────────────────────────

  for (let i = 0; i < patients.length; i++) {
    const p = patients[i];
    await prisma.patient.create({
      data: {
        id: patientIds[i].id,
        phone: p.phone,
        name: p.name,
        fhirPatientId: `demo-fhir-${i + 1}`,
        dateOfBirth: new Date(p.dob),
        gender: p.gender,
        bloodGroup: p.bloodGroup,
        address: "Mumbai, Maharashtra",
        createdByDoctorId: doctorId,
        medicalHistory: p.history,
      },
    });
  }
  console.log(`✓ Patients: ${patients.length} registered`);

  // ── 5. Appointments + Consultations + Prescriptions + Invoices ──────────────

  // Past completed consultations (8)
  for (let i = 0; i < consultationData.length; i++) {
    const c = consultationData[i];
    const aptId = uuid();
    const consId = uuid();
    const prescId = uuid();
    const invoiceId = uuid();
    const scheduledAt = daysAgo(30 - i * 3); // spread over last month

    await prisma.appointment.create({
      data: {
        id: aptId,
        patientId: patientIds[i].id,
        doctorId,
        scheduledAt,
        status: "completed",
        type: i % 3 === 0 ? "walk_in" : i % 3 === 1 ? "follow_up" : "scheduled",
        notes: c.chief,
      },
    });

    const endedAt = new Date(scheduledAt.getTime() + (15 + Math.floor(Math.random() * 20)) * 60000);

    await prisma.consultation.create({
      data: {
        id: consId,
        appointmentId: aptId,
        doctorId,
        patientId: patientIds[i].id,
        startedAt: scheduledAt,
        endedAt,
        chiefComplaint: c.chief,
        diagnosis: c.diagnosis,
        icdCodes: c.icd,
        soapNotes: c.soap,
        vitals: c.vitals,
        status: "completed",
      },
    });

    await prisma.prescription.create({
      data: {
        id: prescId,
        consultationId: consId,
        patientId: patientIds[i].id,
        doctorId,
        medications: c.meds,
        status: "sent",
        sentVia: "print",
        sentAt: endedAt,
      },
    });

    const gst = Math.round(c.amount * 0.05);
    await prisma.invoice.create({
      data: {
        id: invoiceId,
        consultationId: consId,
        patientId: patientIds[i].id,
        doctorId,
        amount: c.amount,
        gstAmount: gst,
        total: c.amount + gst,
        status: i < 6 ? "paid" : "pending",
        paidAt: i < 6 ? endedAt : null,
        paymentMethod: i < 6 ? (i % 2 === 0 ? "UPI" : "Cash") : null,
      },
    });
  }
  console.log("✓ Completed consultations: 8 (with prescriptions + invoices)");

  // Future scheduled appointments (6)
  for (let i = 0; i < 6; i++) {
    const patIdx = i + 2; // different patients
    await prisma.appointment.create({
      data: {
        patientId: patientIds[patIdx].id,
        doctorId,
        scheduledAt: daysFromNow(i + 1),
        status: "scheduled",
        type: "scheduled",
        notes: ["Follow-up visit", "BP check", "Lab review", "Routine checkup", "Medication review", "Post-op follow-up"][i],
      },
    });
  }
  console.log("✓ Upcoming appointments: 6 scheduled");

  // Today's appointments (4 — for live queue demo)
  const todayPatients = [0, 3, 5, 8];
  for (let i = 0; i < todayPatients.length; i++) {
    const patIdx = todayPatients[i];
    await prisma.appointment.create({
      data: {
        patientId: patientIds[patIdx].id,
        doctorId,
        scheduledAt: today(10 + i),
        status: i === 0 ? "in_progress" : i < 3 ? "confirmed" : "scheduled",
        type: i === 1 ? "walk_in" : "scheduled",
        notes: ["Morning consultation", "Walk-in urgent", "Afternoon slot", "Evening review"][i],
      },
    });
  }
  console.log("✓ Today's appointments: 4 (1 in-progress, 2 confirmed, 1 scheduled)");

  // ── 6. Queue entries for today ──────────────────────────────────────────────

  for (let i = 0; i < 3; i++) {
    await prisma.appointmentQueue.create({
      data: {
        clinicId,
        patientId: patientIds[todayPatients[i]].id,
        tokenNumber: i + 1,
        status: i === 0 ? "in_consultation" : "waiting",
      },
    });
  }
  console.log("✓ Queue: 3 patients (1 in consultation, 2 waiting)");

  // ── 7. Lab orders ───────────────────────────────────────────────────────────

  // Get consultation IDs for lab orders (from the completed ones)
  const completedConsultations = await prisma.consultation.findMany({
    where: { doctorId, status: "completed" },
    take: 3,
    orderBy: { startedAt: "desc" },
    select: { id: true, patientId: true },
  });

  if (completedConsultations.length >= 3) {
    const labTests = [
      { tests: ["HbA1c", "Fasting Blood Sugar", "Lipid Panel"], status: "completed" as const },
      { tests: ["Complete Blood Count", "ESR", "CRP"], status: "processing" as const },
      { tests: ["Thyroid Panel (T3, T4, TSH)"], status: "pending" as const },
    ];

    for (let i = 0; i < 3; i++) {
      await prisma.labOrder.create({
        data: {
          consultationId: completedConsultations[i].id,
          patientId: completedConsultations[i].patientId,
          tests: labTests[i].tests,
          status: labTests[i].status,
        },
      });
    }
    console.log("✓ Lab orders: 3 (1 completed, 1 processing, 1 pending)");
  }

  // ── 8. Pharmacy inventory ───────────────────────────────────────────────────

  const medicines = [
    { name: "Paracetamol 500mg", generic: "Acetaminophen", form: "Tablet", strength: "500mg", manufacturer: "Cipla", stock: 500, cost: 1.5, sell: 3.0 },
    { name: "Metformin 500mg", generic: "Metformin HCl", form: "Tablet", strength: "500mg", manufacturer: "USV", stock: 300, cost: 2.0, sell: 4.5 },
    { name: "Pantoprazole 40mg", generic: "Pantoprazole Sodium", form: "Tablet", strength: "40mg", manufacturer: "Sun Pharma", stock: 200, cost: 3.5, sell: 7.0 },
    { name: "Cetirizine 10mg", generic: "Cetirizine HCl", form: "Tablet", strength: "10mg", manufacturer: "Dr. Reddy's", stock: 400, cost: 1.0, sell: 2.5 },
    { name: "Atorvastatin 40mg", generic: "Atorvastatin Calcium", form: "Tablet", strength: "40mg", manufacturer: "Zydus", stock: 150, cost: 5.0, sell: 12.0 },
  ];

  for (const m of medicines) {
    const medId = uuid();
    await prisma.medicine.create({
      data: {
        id: medId,
        name: m.name,
        genericName: m.generic,
        form: m.form,
        strength: m.strength,
        manufacturer: m.manufacturer,
        inventory: {
          create: {
            clinicId,
            stockQuantity: m.stock,
            reorderLevel: 50,
            batchNumber: `BATCH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
            costPrice: m.cost,
            sellingPrice: m.sell,
            expiryDate: new Date(2027, 5, 30),
          },
        },
      },
    });
  }
  console.log("✓ Pharmacy: 5 medicines with inventory");

  // ── 9. Follow-ups ──────────────────────────────────────────────────────────

  if (completedConsultations.length >= 2) {
    await prisma.followup.create({
      data: {
        patientId: completedConsultations[0].patientId,
        consultationId: completedConsultations[0].id,
        doctorId,
        scheduledDate: daysFromNow(7),
        reason: "Review HbA1c lab results and adjust medication if needed",
        channel: "whatsapp",
        status: "pending",
      },
    });
    await prisma.followup.create({
      data: {
        patientId: completedConsultations[1].patientId,
        consultationId: completedConsultations[1].id,
        doctorId,
        scheduledDate: daysFromNow(14),
        reason: "Post-treatment follow-up — check symptom resolution",
        channel: "sms",
        status: "pending",
      },
    });
    console.log("✓ Follow-ups: 2 scheduled");
  }

  // ── 10. Patient tags ────────────────────────────────────────────────────────

  const tagData: [number, string][] = [
    [0, "diabetes"], [0, "regular"],
    [1, "hypertension"], [1, "regular"],
    [2, "asthma"],
    [3, "elderly"], [3, "post-surgery"],
    [6, "cardiac"], [6, "high-risk"], [6, "elderly"],
    [9, "migraine"],
    [11, "rheumatoid"],
  ];

  for (const [idx, tag] of tagData) {
    await prisma.patientTag.create({
      data: { patientId: patientIds[idx].id, tag },
    });
  }
  console.log("✓ Patient tags: 11 tags across 7 patients");

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🎉 Demo data seeded successfully!\n");
  console.log("📋 Demo Login Credentials:");
  console.log("   Phone:    +919876543210");
  console.log("   Email:    dr.priya@cliniqai.demo");
  console.log("   Password: demo1234");
  console.log("");
  console.log("   (In dev mode with ALLOW_DEV_OTP=true, OTP is auto-filled)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
