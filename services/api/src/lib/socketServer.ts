import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { createLogger } from "./logger.js";

const log = createLogger("socket");
const JWT_SECRET = process.env["JWT_SECRET"] ?? "dev-secret";

let io: Server | null = null;

export function initSocketServer(httpServer: HttpServer): Server {
  const allowedOrigins = (process.env["ALLOWED_ORIGINS"] ?? "http://localhost:3000").split(",");

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // JWT authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET) as { sub: string; doctor_id?: string };
      socket.data.userId = payload.sub;
      socket.data.doctorId = payload.doctor_id;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const { userId, doctorId } = socket.data as { userId: string; doctorId?: string };
    log.info({ userId, doctorId }, "socket_connected");

    // Join personal room
    if (doctorId) {
      socket.join(`doctor:${doctorId}`);
    }

    socket.on("disconnect", () => {
      log.debug({ userId }, "socket_disconnected");
    });
  });

  log.info("Socket.io server initialized");
  return io;
}

export function getSocketServer(): Server | null {
  return io;
}

/** Emit event to a specific doctor's room */
export function emitToDoctor(doctorId: string, event: string, data: unknown): void {
  io?.to(`doctor:${doctorId}`).emit(event, data);
}
