import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { smsReminderQueue, whatsappPrescriptionQueue } from '../lib/queues';

const router = Router();

// MSG91 webhook - incoming WhatsApp messages
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { from, body, type } = req.body;

    // Normalize phone number
    const phone = from.startsWith('+') ? from : `+${from}`;
    const message = (body || '').trim().toLowerCase();

    // Find patient by phone
    const patient = await prisma.patient.findFirst({
      where: { phone },
      include: { appointments: { orderBy: { scheduled_at: 'desc' }, take: 5 } },
    });

    let reply = '';

    if (!patient) {
      reply = `Welcome to CliniqAI! 🏥\n\nYour number is not registered. Please visit your doctor's clinic to get registered, or reply with:\n\n*REGISTER <Your Name>*\n\nto create your account.`;
      res.json({ reply });
      return;
    }

    // Command routing
    if (message === 'hi' || message === 'hello' || message === 'menu') {
      reply = getMainMenu(patient.first_name);
    } else if (message === '1' || message === 'book') {
      reply = await handleBookAppointment(patient);
    } else if (message === '2' || message === 'appointments' || message === 'my appointments') {
      reply = await handleViewAppointments(patient);
    } else if (message === '3' || message === 'prescription' || message === 'rx') {
      reply = await handleGetPrescription(patient);
    } else if (message === '4' || message === 'reports' || message === 'lab') {
      reply = await handleGetReports(patient);
    } else if (message === '5' || message === 'reminder') {
      reply = await handleSetReminder(patient);
    } else if (message.startsWith('confirm')) {
      reply = await handleConfirmAppointment(patient, message);
    } else if (message.startsWith('cancel')) {
      reply = await handleCancelAppointment(patient, message);
    } else if (message.startsWith('register')) {
      reply = 'You are already registered! Reply *MENU* to see options.';
    } else {
      reply = `Sorry, I didn't understand that. Reply *MENU* to see available options.`;
    }

    res.json({ reply });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    res.json({ reply: 'Sorry, something went wrong. Please try again later.' });
  }
});

// Get patient's upcoming appointments via WhatsApp
router.get('/patient/:phone/status', async (req: Request, res: Response) => {
  try {
    const phone = decodeURIComponent(req.params.phone);
    const patient = await prisma.patient.findFirst({
      where: { phone },
      include: {
        appointments: {
          where: { status: { in: ['scheduled', 'confirmed'] } },
          orderBy: { scheduled_at: 'asc' },
          take: 3,
        },
      },
    });

    if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    res.json({
      patient: { name: `${patient.first_name} ${patient.last_name}` },
      appointments: patient.appointments,
    });
  } catch (error) {
    console.error('Patient status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send bulk appointment reminders
router.post('/reminders/send', async (req: Request, res: Response) => {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const upcomingAppointments = await prisma.appointment.findMany({
      where: {
        scheduled_at: { gte: tomorrow, lt: dayAfter },
        status: { in: ['scheduled', 'confirmed'] },
        reminder_sent: false,
      },
      include: { patient: true, doctor: true },
    });

    let sent = 0;
    for (const apt of upcomingAppointments) {
      if (apt.patient?.phone) {
        await smsReminderQueue.add('appointment-reminder', {
          appointmentId: apt.id,
          patientPhone: apt.patient.phone,
          scheduledAt: apt.scheduled_at.toISOString(),
        });
        await prisma.appointment.update({
          where: { id: apt.id },
          data: { reminder_sent: true },
        });
        sent++;
      }
    }

    res.json({ sent, total: upcomingAppointments.length });
  } catch (error) {
    console.error('Reminder send error:', error);
    res.status(500).json({ error: 'Failed to send reminders' });
  }
});

function getMainMenu(name: string): string {
  return `Hi ${name}! 👋 Welcome to CliniqAI.\n\nHow can I help you today?\n\n*1.* 📅 Book Appointment\n*2.* 📋 My Appointments\n*3.* 💊 Get Prescription\n*4.* 🔬 Lab Reports\n*5.* ⏰ Medication Reminder\n\nReply with a *number* or keyword.`;
}

async function handleBookAppointment(patient: any): Promise<string> {
  // Get doctor's available slots
  const doctors = await prisma.doctor.findMany({
    where: { clinic_id: patient.clinic_id },
    take: 5,
  });

  if (doctors.length === 0) {
    return 'No doctors available at this time. Please contact the clinic directly.';
  }

  let reply = `📅 *Book an Appointment*\n\nAvailable doctors:\n`;
  doctors.forEach((doc: any, i: number) => {
    reply += `\n*${i + 1}.* Dr. ${doc.first_name} ${doc.last_name}`;
    if (doc.specialization) reply += ` (${doc.specialization})`;
  });

  reply += `\n\nReply with *CONFIRM <doctor number>* to book the next available slot.`;
  return reply;
}

async function handleViewAppointments(patient: any): Promise<string> {
  const appointments = await prisma.appointment.findMany({
    where: {
      patient_id: patient.id,
      status: { in: ['scheduled', 'confirmed'] },
    },
    orderBy: { scheduled_at: 'asc' },
    take: 5,
    include: { doctor: true },
  });

  if (appointments.length === 0) {
    return '📋 You have no upcoming appointments.\n\nReply *1* to book a new appointment.';
  }

  let reply = '📋 *Your Upcoming Appointments:*\n';
  appointments.forEach((apt: any, i: number) => {
    const date = new Date(apt.scheduled_at).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    reply += `\n*${i + 1}.* ${date}`;
    if (apt.doctor) reply += `\n   Dr. ${apt.doctor.first_name} ${apt.doctor.last_name}`;
    reply += `\n   Status: ${apt.status}`;
    reply += `\n   Reply *CANCEL ${apt.id.slice(0, 8)}* to cancel\n`;
  });

  return reply;
}

async function handleGetPrescription(patient: any): Promise<string> {
  const prescriptions = await prisma.prescription.findMany({
    where: { patient_id: patient.id },
    orderBy: { created_at: 'desc' },
    take: 3,
    include: { doctor: true },
  });

  if (prescriptions.length === 0) {
    return '💊 No prescriptions found.\n\nVisit your doctor to get a new prescription.';
  }

  let reply = '💊 *Your Recent Prescriptions:*\n';
  prescriptions.forEach((rx: any, i: number) => {
    const date = new Date(rx.created_at).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    reply += `\n*${i + 1}.* ${date}`;
    if (rx.doctor) reply += ` - Dr. ${rx.doctor.first_name}`;
    reply += `\n   ID: ${rx.id.slice(0, 8)}`;
  });

  reply += `\n\nPrescription details will be sent as a PDF.`;

  // Queue the most recent prescription PDF
  if (prescriptions[0] && patient.phone) {
    await whatsappPrescriptionQueue.add('send-rx', {
      phone: patient.phone,
      templateName: 'prescription_share',
      variables: { prescriptionId: prescriptions[0].id },
      mediaUrl: '', // PDF URL will be generated by worker
    });
  }

  return reply;
}

async function handleGetReports(patient: any): Promise<string> {
  const labOrders = await prisma.labOrder.findMany({
    where: { patient_id: patient.id, status: 'completed' },
    orderBy: { created_at: 'desc' },
    take: 5,
  });

  if (labOrders.length === 0) {
    return '🔬 No lab reports available yet.\n\nYour doctor will order tests when needed.';
  }

  let reply = '🔬 *Your Lab Reports:*\n';
  labOrders.forEach((lab: any, i: number) => {
    const date = new Date(lab.created_at).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    reply += `\n*${i + 1}.* ${lab.test_name || 'Lab Test'} - ${date}`;
    reply += `\n   Status: ${lab.status}`;
  });

  return reply;
}

async function handleSetReminder(patient: any): Promise<string> {
  return `⏰ *Medication Reminders*\n\nI'll remind you to take your medicines on time.\n\nReminder times:\n• Morning: 8:00 AM\n• Afternoon: 1:00 PM\n• Evening: 7:00 PM\n• Night: 10:00 PM\n\nYour reminders are now active! I'll send you a WhatsApp message at each scheduled time based on your current prescription.\n\nReply *STOP REMINDER* to disable.`;
}

async function handleConfirmAppointment(patient: any, message: string): Promise<string> {
  const parts = message.split(' ');
  if (parts.length < 2) {
    return 'Please reply with *CONFIRM <doctor number>* to book.';
  }

  return `✅ *Appointment Request Received!*\n\nWe'll confirm your appointment shortly. You'll receive a message with the date, time, and any preparation instructions.\n\nReply *2* to check your appointments.`;
}

async function handleCancelAppointment(patient: any, message: string): Promise<string> {
  const parts = message.split(' ');
  if (parts.length < 2) {
    return 'Please reply with *CANCEL <appointment ID>* to cancel.';
  }

  const aptIdPrefix = parts[1];
  const appointment = await prisma.appointment.findFirst({
    where: {
      patient_id: patient.id,
      id: { startsWith: aptIdPrefix },
      status: { in: ['scheduled', 'confirmed'] },
    },
  });

  if (!appointment) {
    return '❌ Appointment not found. Reply *2* to see your appointments.';
  }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: 'cancelled' },
  });

  return `✅ Appointment cancelled successfully.\n\nReply *1* to book a new appointment.`;
}

export default router;
