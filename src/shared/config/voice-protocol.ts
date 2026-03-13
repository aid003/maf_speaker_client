export const AUDIO_SAMPLE_RATE = 48_000;
export const AUDIO_CHANNELS = 1;
export const AUDIO_FORMAT = "f32le";
export const AUDIO_CHUNK_HEADER_BYTES = 8;

export type UiState =
  | "idle"
  | "armed"
  | "recording"
  | "processing"
  | "speaking"
  | "error";

export type WsStatus = "idle" | "connecting" | "connected" | "reconnecting" | "closed";

export type ClientSessionStartEvent = {
  type: "session.start";
  device_id: string;
  audio_format: typeof AUDIO_FORMAT;
  sample_rate: typeof AUDIO_SAMPLE_RATE;
  channels: typeof AUDIO_CHANNELS;
};

export type ClientPlaybackFinishedEvent = {
  type: "playback.finished";
};

export type ClientDebugPingEvent = {
  type: "debug.ping";
  sent_at: number;
};

export type ClientJsonEvent =
  | ClientSessionStartEvent
  | ClientPlaybackFinishedEvent
  | ClientDebugPingEvent;

export type ServerWakeDetectedEvent = { type: "wake.detected" };
export type ServerSpeechStartedEvent = { type: "speech.started" };
export type ServerSpeechEndedEvent = { type: "speech.ended" };
export type ServerAssistantProcessingEvent = { type: "assistant.processing" };
export type ServerAssistantTranscriptEvent = {
  type: "assistant.transcript";
  text: string;
};
export type ServerAssistantPartialTranscriptEvent = {
  type: "assistant.partial_transcript";
  content: string;
  final?: boolean;
};
export type ServerAssistantTextEvent = {
  type: "assistant.text";
  text: string;
};
export type ServerAssistantPartialTextEvent = {
  type: "assistant.partial_text";
  content: string;
  final?: boolean;
};
export type ServerAssistantAudioEvent = {
  type: "assistant.audio";
  format: "wav" | "mp3" | "pcm" | string;
  mime_type?: string;
};
export type ServerAssistantAudioEndEvent = {
  type: "assistant.audio.end";
};
export type ServerErrorEvent = {
  type: "error";
  message: string;
};
export type ServerDebugPongEvent = {
  type: "debug.pong";
  sent_at: number;
  echoed_at: number;
};

export type ServerJsonEvent =
  | ServerWakeDetectedEvent
  | ServerSpeechStartedEvent
  | ServerSpeechEndedEvent
  | ServerAssistantProcessingEvent
  | ServerAssistantTranscriptEvent
  | ServerAssistantPartialTranscriptEvent
  | ServerAssistantTextEvent
  | ServerAssistantPartialTextEvent
  | ServerAssistantAudioEvent
  | ServerAssistantAudioEndEvent
  | ServerErrorEvent
  | ServerDebugPongEvent;

export const serverEventToUiState: Partial<Record<ServerJsonEvent["type"], UiState>> = {
  "wake.detected": "armed",
  "speech.started": "recording",
  "speech.ended": "processing",
  "assistant.processing": "processing",
};

export function buildAudioChunkFrame(seq: number, chunk: Float32Array): ArrayBuffer {
  const payloadBytes = chunk.byteLength;
  const totalBytes = AUDIO_CHUNK_HEADER_BYTES + payloadBytes;
  const frame = new ArrayBuffer(totalBytes);
  const view = new DataView(frame);
  view.setUint32(0, seq, true);
  view.setUint16(4, chunk.length, true);
  view.setUint16(6, 0, true);

  const body = new Float32Array(frame, AUDIO_CHUNK_HEADER_BYTES, chunk.length);
  body.set(chunk);
  return frame;
}

export function parseAudioChunkFrameMeta(frame: ArrayBuffer): {
  seq: number;
  sampleCount: number;
} {
  const view = new DataView(frame);
  return {
    seq: view.getUint32(0, true),
    sampleCount: view.getUint16(4, true),
  };
}
