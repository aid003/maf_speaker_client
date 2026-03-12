"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  type ServerJsonEvent,
  type UiState,
  type WsStatus,
  serverEventToUiState,
} from "@/shared/config/index";
import { MicStreamer } from "@/shared/lib/audio/index";
import { AudioPlayer } from "@/shared/lib/player/index";
import { VoiceSocket } from "@/shared/lib/ws/index";

type PermissionStateLike = PermissionState | "unknown";

export type VoiceDiagnostics = {
  hasMicrophoneApi: boolean;
  permission: PermissionStateLike;
  wsStatus: WsStatus;
  sampleRate: number;
  seq: number;
  droppedChunks: number;
  rttMs: number | null;
  lastEvents: string[];
};

export type UseVoiceSessionResult = {
  uiState: UiState;
  transcript: string;
  assistantText: string;
  isRunning: boolean;
  startSession: () => Promise<void>;
  stopSession: () => Promise<void>;
  diagnostics: VoiceDiagnostics;
};

const MAX_EVENTS_LOG = 12;
const PING_INTERVAL_MS = 10_000;

function nowLabel(): string {
  return new Date().toLocaleTimeString("ru-RU", { hour12: false });
}

function pushEvent(events: string[], label: string): string[] {
  const next = [`${nowLabel()} ${label}`, ...events];
  return next.slice(0, MAX_EVENTS_LOG);
}

export function useVoiceSession(): UseVoiceSessionResult {
  const [uiState, setUiState] = useState<UiState>("idle");
  const [transcript, setTranscript] = useState("");
  const [assistantText, setAssistantText] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [hasMicrophoneApi, setHasMicrophoneApi] = useState(false);
  const [permission, setPermission] = useState<PermissionStateLike>("unknown");
  const [wsStatus, setWsStatus] = useState<WsStatus>("idle");
  const [sampleRate, setSampleRate] = useState(0);
  const [seq, setSeq] = useState(0);
  const [droppedChunks, setDroppedChunks] = useState(0);
  const [rttMs, setRttMs] = useState<number | null>(null);
  const [lastEvents, setLastEvents] = useState<string[]>([]);

  const socketRef = useRef<VoiceSocket | null>(null);
  const micRef = useRef<MicStreamer | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const seqRef = useRef(0);
  const pingTimerRef = useRef<number | null>(null);
  const isRunningRef = useRef(false);

  const addEvent = useCallback((label: string) => {
    setLastEvents((events) => pushEvent(events, label));
  }, []);

  const readMicPermission = useCallback(async () => {
    setHasMicrophoneApi(
      typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia,
    );
    if (!navigator.permissions?.query) {
      setPermission("unknown");
      return;
    }
    try {
      const status = await navigator.permissions.query({
        name: "microphone" as PermissionName,
      });
      setPermission(status.state);
      status.onchange = () => setPermission(status.state);
    } catch {
      setPermission("unknown");
    }
  }, []);

  const stopSession = useCallback(async () => {
    if (pingTimerRef.current) {
      window.clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
    socketRef.current?.disconnect();
    socketRef.current = null;
    await micRef.current?.stop();
    micRef.current = null;
    playerRef.current?.stop();
    playerRef.current = null;
    setWsStatus("closed");
    setIsRunning(false);
    isRunningRef.current = false;
    setUiState("idle");
    addEvent("session.stopped");
  }, [addEvent]);

  const startSession = useCallback(async () => {
    if (isRunning) {
      return;
    }

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "";
    if (!wsUrl) {
      setUiState("error");
      addEvent("error: NEXT_PUBLIC_WS_URL is empty");
      return;
    }

    await readMicPermission();
    seqRef.current = 0;
    setSeq(0);
    setDroppedChunks(0);
    setTranscript("");
    setAssistantText("");
    setUiState("idle");

    const mic = new MicStreamer();
    const socket = new VoiceSocket(wsUrl);
    const player = new AudioPlayer();
    micRef.current = mic;
    socketRef.current = socket;
    playerRef.current = player;

    socket.onStatus((nextStatus) => {
      setWsStatus(nextStatus);
      addEvent(`ws.${nextStatus}`);
      if (nextStatus === "closed" && isRunningRef.current) {
        setUiState("error");
      }
    });

    socket.onEvent((event: ServerJsonEvent) => {
      addEvent(`server.${event.type}`);

      const mappedState = serverEventToUiState[event.type];
      if (mappedState) {
        setUiState(mappedState);
      }

      if (event.type === "assistant.transcript") {
        setTranscript(event.text);
      }

      if (event.type === "assistant.text") {
        setAssistantText(event.text);
      }

      if (event.type === "error") {
        setUiState("error");
      }

      if (event.type === "debug.pong") {
        setRttMs(Math.max(0, event.echoed_at - event.sent_at));
      }
    });

    socket.onAudio(async (payload, mimeType) => {
      try {
        setUiState("speaking");
        await player.play(payload, mimeType);
        socket.sendJson({ type: "playback.finished" });
        setUiState("idle");
        addEvent("client.playback.finished");
      } catch {
        setUiState("error");
        addEvent("error: playback failed");
      }
    });

    mic.onChunk((chunk) => {
      const nextSeq = seqRef.current;
      seqRef.current += 1;
      setSeq(nextSeq);
      const sent = socket.sendAudioChunk(nextSeq, chunk);
      if (!sent) {
        setDroppedChunks((value) => value + 1);
      }
    });

    try {
      await mic.start();
      setSampleRate(mic.sampleRate);
      addEvent(`mic.started.${mic.sampleRate}Hz`);
    } catch {
      setUiState("error");
      addEvent("error: microphone unavailable");
      return;
    }

    socket.connect("robot-01");
    setIsRunning(true);
    isRunningRef.current = true;
    addEvent("session.started");

    pingTimerRef.current = window.setInterval(() => {
      const sentAt = Date.now();
      socket.sendJson({ type: "debug.ping", sent_at: sentAt });
    }, PING_INTERVAL_MS);
  }, [addEvent, isRunning, readMicPermission]);

  useEffect(() => {
    return () => {
      void stopSession();
    };
  }, [stopSession]);

  const diagnostics = useMemo<VoiceDiagnostics>(
    () => ({
      hasMicrophoneApi,
      permission,
      wsStatus,
      sampleRate,
      seq,
      droppedChunks,
      rttMs,
      lastEvents,
    }),
    [droppedChunks, hasMicrophoneApi, lastEvents, permission, rttMs, sampleRate, seq, wsStatus],
  );

  return {
    uiState,
    transcript,
    assistantText,
    isRunning,
    startSession,
    stopSession,
    diagnostics,
  };
}
