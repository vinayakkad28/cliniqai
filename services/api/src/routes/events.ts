import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

// Connected clients map
const clients = new Map<string, Response>();

// SSE auth: EventSource can't set headers, so accept token from query string
function sseAuth(req: Request, res: Response, next: NextFunction): void {
  const queryToken = req.query.token as string | undefined;
  if (queryToken && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${queryToken}`;
  }
  authenticate(req, res, next);
}

// SSE endpoint for real-time updates
router.get('/stream', sseAuth, (req: Request, res: Response) => {
  const doctorId = req.user!.doctor_id;
  const clinicId = req.user!.clinic_id;
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
