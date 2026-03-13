const AUDIO_SAMPLE_RATE = 48_000;
const AUDIO_CHANNELS = 1;
const AUDIO_FORMAT = "f32le";
const AUDIO_CHUNK_HEADER_BYTES = 8;

type ClientJsonEvent =
  | { type: "session.start"; device_id: string; audio_format: string; sample_rate: number; channels: number }
  | { type: "playback.finished" }
  | { type: "debug.ping"; sent_at: number };

type ServerJsonEvent =
  | { type: "wake.detected" }
  | { type: "speech.started" }
  | { type: "speech.ended" }
  | { type: "assistant.processing" }
  | { type: "assistant.transcript"; text: string }
  | { type: "assistant.partial_transcript"; content: string; final?: boolean }
  | { type: "assistant.text"; text: string }
  | { type: "assistant.partial_text"; content: string; final?: boolean }
  | { type: "assistant.audio"; format: string; mime_type?: string }
  | { type: "assistant.audio.end" }
  | { type: "error"; message: string }
  | { type: "debug.pong"; sent_at: number; echoed_at: number };

type WsStatus = "idle" | "connecting" | "connected" | "reconnecting" | "closed";

type EventHandler = (event: ServerJsonEvent) => void;
type AudioHandler = (payload: ArrayBuffer, mimeType?: string) => void;
type StatusHandler = (status: WsStatus) => void;

type AudioStreamHandler = {
  onAudioStart(meta: { format: string; mimeType: string }): void;
  onAudioChunk(chunk: ArrayBuffer): void;
  onAudioEnd(): void;
};

const RECONNECT_DELAY_MS = 1_500;
const LEGACY_SINGLE_BLOB_MS = 150;

function toJsonEvent(data: string): ServerJsonEvent | null {
  try {
    return JSON.parse(data) as ServerJsonEvent;
  } catch {
    return null;
  }
}

function buildAudioChunkFrame(seq: number, chunk: Float32Array): ArrayBuffer {
  const payloadBytes = chunk.byteLength;
  const frame = new ArrayBuffer(AUDIO_CHUNK_HEADER_BYTES + payloadBytes);
  const view = new DataView(frame);
  view.setUint32(0, seq, true);
  view.setUint16(4, chunk.length, true);
  view.setUint16(6, 0, true);
  new Float32Array(frame, AUDIO_CHUNK_HEADER_BYTES, chunk.length).set(chunk);
  return frame;
}

export class VoiceSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectTimer: number | null = null;
  private shouldReconnect = true;
  private deviceId = "robot-01";
  private eventHandler: EventHandler | null = null;
  private audioHandler: AudioHandler | null = null;
  private audioStreamHandler: AudioStreamHandler | null = null;
  private statusHandler: StatusHandler | null = null;
  private pendingAudioMimeType: string | undefined;
  private legacyBlobTimer: number | null = null;
  private streamChunkCount = 0;
  private status: WsStatus = "idle";

  constructor(url: string) {
    this.url = url;
  }

  onEvent(cb: EventHandler): void {
    this.eventHandler = cb;
  }

  onAudio(cb: AudioHandler): void {
    this.audioHandler = cb;
  }

  onAudioStream(handler: AudioStreamHandler | null): void {
    this.audioStreamHandler = handler;
  }

  onStatus(cb: StatusHandler): void {
    this.statusHandler = cb;
  }

  connect(deviceId: string): void {
    this.deviceId = deviceId;
    this.shouldReconnect = true;
    this.openSocket(false);
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.clearLegacyBlobTimer();
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.setStatus("closed");
  }

  sendJson(event: ClientJsonEvent): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    this.ws.send(JSON.stringify(event));
    return true;
  }

  sendAudioChunk(seq: number, chunk: Float32Array): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    this.ws.send(buildAudioChunkFrame(seq, chunk));
    return true;
  }

  private openSocket(isReconnect: boolean): void {
    if (!this.url) {
      this.setStatus("closed");
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    this.setStatus(isReconnect ? "reconnecting" : "connecting");
    this.ws = new WebSocket(this.url);
    this.ws.binaryType = "arraybuffer";

    this.ws.onopen = () => {
      this.setStatus("connected");
      this.sendJson({
        type: "session.start",
        device_id: this.deviceId,
        audio_format: AUDIO_FORMAT,
        sample_rate: AUDIO_SAMPLE_RATE,
        channels: AUDIO_CHANNELS,
      });
    };

    this.ws.onmessage = (message) => {
      if (typeof message.data === "string") {
        const event = toJsonEvent(message.data);
        if (!event) {
          return;
        }
        if (event.type === "assistant.audio") {
          this.pendingAudioMimeType = event.mime_type;
          this.streamChunkCount = 0;
          this.clearLegacyBlobTimer();
          if (this.audioStreamHandler) {
            this.audioStreamHandler.onAudioStart({
              format: event.format,
              mimeType: event.mime_type ?? `audio/${event.format}`,
            });
          }
        }
        if (event.type === "assistant.audio.end") {
          this.clearLegacyBlobTimer();
          this.pendingAudioMimeType = undefined;
          this.audioStreamHandler?.onAudioEnd();
        }
        this.eventHandler?.(event);
        return;
      }

      if (message.data instanceof ArrayBuffer) {
        if (this.audioStreamHandler) {
          this.streamChunkCount += 1;
          this.audioStreamHandler.onAudioChunk(message.data);
          this.scheduleLegacyBlobEnd();
        } else {
          this.audioHandler?.(message.data, this.pendingAudioMimeType);
          this.pendingAudioMimeType = undefined;
        }
      }
    };

    this.ws.onerror = () => {
      this.setStatus("closed");
    };

    this.ws.onclose = () => {
      this.setStatus("closed");
      this.ws = null;
      if (!this.shouldReconnect) {
        return;
      }
      this.reconnectTimer = window.setTimeout(() => {
        this.openSocket(true);
      }, RECONNECT_DELAY_MS);
    };
  }

  private setStatus(status: WsStatus): void {
    this.status = status;
    this.statusHandler?.(this.status);
  }

  private clearLegacyBlobTimer(): void {
    if (this.legacyBlobTimer !== null) {
      window.clearTimeout(this.legacyBlobTimer);
      this.legacyBlobTimer = null;
    }
  }

  private scheduleLegacyBlobEnd(): void {
    this.clearLegacyBlobTimer();
    if (this.streamChunkCount !== 1) return;
    const handler = this.audioStreamHandler;
    this.legacyBlobTimer = window.setTimeout(() => {
      this.legacyBlobTimer = null;
      handler?.onAudioEnd();
    }, LEGACY_SINGLE_BLOB_MS);
  }
}
