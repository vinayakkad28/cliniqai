'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

interface VideoState {
  roomUrl: string | null;
  isConnected: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  duration: number;
  patientName: string;
  consultationId: string;
}

export default function VideoConsultationPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const router = useRouter();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [state, setState] = useState<VideoState>({
    roomUrl: null,
    isConnected: false,
    isMuted: false,
    isVideoOff: false,
    isScreenSharing: false,
    duration: 0,
    patientName: '',
    consultationId: id as string,
  });

  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    initializeCall();
    return () => cleanup();
  }, [id]);

  useEffect(() => {
    if (state.isConnected) {
      timerRef.current = setInterval(() => {
        setState((prev) => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.isConnected]);

  async function initializeCall() {
    try {
      // Get consultation details
      const consultation = await api.consultations.get(token!, id as string);
      setState((prev) => ({ ...prev, patientName: consultation.patient?.first_name + ' ' + consultation.patient?.last_name }));

      // Create/get video room
      const room = await api.telemedicine.createRoom(token!, id as string);
      setState((prev) => ({ ...prev, roomUrl: room.url }));

      // Get local media
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Initialize WebRTC
      await setupPeerConnection(stream);
    } catch (err: any) {
      console.error('Video init error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Camera/microphone permission denied. Please allow access and refresh.');
      } else {
        setError(err.message || 'Failed to initialize video call');
      }
    }
  }

  async function setupPeerConnection(stream: MediaStream) {
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };

    const pc = new RTCPeerConnection(config);
    peerConnectionRef.current = pc;

    // Add local tracks
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    // Handle remote stream
    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setState((prev) => ({ ...prev, isConnected: true }));
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        setState((prev) => ({ ...prev, isConnected: false }));
      }
    };
  }

  function cleanup() {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    peerConnectionRef.current?.close();
    if (timerRef.current) clearInterval(timerRef.current);
  }

  const toggleMute = useCallback(() => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setState((prev) => ({ ...prev, isMuted: !audioTrack.enabled }));
    }
  }, []);

  const toggleVideo = useCallback(() => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setState((prev) => ({ ...prev, isVideoOff: !videoTrack.enabled }));
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (state.isScreenSharing) {
      // Stop screen share, restore camera
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTrack = stream.getVideoTracks()[0];
      const sender = peerConnectionRef.current?.getSenders().find((s) => s.track?.kind === 'video');
      sender?.replaceTrack(videoTrack);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setState((prev) => ({ ...prev, isScreenSharing: false }));
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = stream.getVideoTracks()[0];
        const sender = peerConnectionRef.current?.getSenders().find((s) => s.track?.kind === 'video');
        sender?.replaceTrack(screenTrack);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        screenTrack.onended = () => toggleScreenShare();
        setState((prev) => ({ ...prev, isScreenSharing: true }));
      } catch {
        // User cancelled screen share
      }
    }
  }, [state.isScreenSharing]);

  async function endCall() {
    cleanup();
    // Save any notes
    if (notes.trim()) {
      try {
        await api.consultations.updateNotes(token!, id as string, notes);
      } catch {
        // Notes save failed silently
      }
    }
    router.push(`/dashboard/consultations/${id}`);
  }

  function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
            </svg>
          </div>
          <p className="text-white text-lg mb-2">Unable to start video call</p>
          <p className="text-gray-400 mb-6">{error}</p>
          <button onClick={() => router.back()} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Top Bar */}
      <div className="bg-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${state.isConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
          <span className="text-white font-medium">{state.patientName || 'Waiting for patient...'}</span>
          {state.isConnected && (
            <span className="text-gray-400 text-sm">{formatDuration(state.duration)}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNotes(!showNotes)}
            className={`px-3 py-1.5 rounded-lg text-sm ${showNotes ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          >
            Notes
          </button>
        </div>
      </div>

      {/* Video Area */}
      <div className="flex-1 flex">
        <div className={`flex-1 relative ${showNotes ? 'w-2/3' : 'w-full'}`}>
          {/* Remote Video (large) */}
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover bg-gray-800" />

          {!state.isConnected && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="text-center">
                <div className="animate-pulse mb-4">
                  <svg className="w-16 h-16 text-gray-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-gray-400">Waiting for patient to join...</p>
                <p className="text-gray-500 text-sm mt-2">Share the consultation link with your patient</p>
              </div>
            </div>
          )}

          {/* Local Video (picture-in-picture) */}
          <div className="absolute bottom-24 right-6 w-48 h-36 bg-gray-700 rounded-xl overflow-hidden shadow-lg border-2 border-gray-600">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {state.isVideoOff && (
              <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center">
                  <span className="text-lg text-white">You</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notes Panel */}
        {showNotes && (
          <div className="w-1/3 bg-gray-800 border-l border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-white font-medium">Consultation Notes</h3>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="flex-1 p-4 bg-transparent text-gray-200 text-sm resize-none outline-none placeholder-gray-500"
              placeholder="Type your notes here... (auto-saved when call ends)"
            />
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="bg-gray-800 px-6 py-4 flex items-center justify-center gap-4">
        <button
          onClick={toggleMute}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
            state.isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
          }`}
          title={state.isMuted ? 'Unmute' : 'Mute'}
        >
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {state.isMuted ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            )}
          </svg>
        </button>

        <button
          onClick={toggleVideo}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
            state.isVideoOff ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
          }`}
          title={state.isVideoOff ? 'Turn on camera' : 'Turn off camera'}
        >
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {state.isVideoOff ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            )}
          </svg>
        </button>

        <button
          onClick={toggleScreenShare}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
            state.isScreenSharing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
          }`}
          title={state.isScreenSharing ? 'Stop sharing' : 'Share screen'}
        >
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </button>

        <div className="w-px h-8 bg-gray-600 mx-2" />

        <button
          onClick={endCall}
          className="px-6 h-12 bg-red-600 hover:bg-red-700 rounded-full flex items-center gap-2 text-white font-medium transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
          </svg>
          End Call
        </button>
      </div>
    </div>
  );
}
