"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

const API_URL = process.env["NEXT_PUBLIC_API_URL"]?.replace("/api", "") ?? "http://localhost:3001";

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;

  if (!socket) {
    const token = localStorage.getItem("cliniqai_access_token");
    if (!token) return null;

    socket = io(API_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socket.on("connect", () => {
      console.log("[socket] connected");
    });

    socket.on("disconnect", (reason) => {
      console.log("[socket] disconnected:", reason);
    });
  }

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/** Hook to subscribe to a socket event with auto-cleanup */
export function useSocketEvent<T>(event: string, handler: (data: T) => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const s = getSocket();
    if (!s) return;

    const listener = (data: T) => handlerRef.current(data);
    s.on(event, listener);

    return () => {
      s.off(event, listener);
    };
  }, [event]);
}
