import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

// Connected clients map
const clients = new Map<string, Response>();

// SSE endpoint for real-time updates
router.get('/stream', authenticate, (req: Request, res: Response) => {
  const doctorId = (req as any).auth.doctor_id;
  const clinicId = (req as any).auth.clinic_id;
  const clientId = `${doctorId}-${Date.now()}`;

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  });

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId, doctorId })}\n\n`);

  // Store client
  clients.set(clientId, res);

  // Heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    res.write(`:heartbeat\n\n`);
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(clientId);
  });
});

// Utility: send event to specific doctor
export function sendToDoctor(doctorId: string, event: string, data: any) {
  clients.forEach((res, clientId) => {
    if (clientId.startsWith(doctorId)) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  });
}

// Utility: send event to all clients in a clinic
export function sendToClinic(clinicId: string, event: string, data: any) {
  clients.forEach((res) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  });
}

// Utility: broadcast to all connected clients
export function broadcast(event: string, data: any) {
  clients.forEach((res) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  });
}

export default router;
