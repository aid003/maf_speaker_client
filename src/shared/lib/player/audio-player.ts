export type AudioStreamHandler = {
  onAudioStart(meta: { format: string; mimeType: string }): void;
  onAudioChunk(chunk: ArrayBuffer): void;
  onAudioEnd(): void;
};

export class AudioPlayer implements AudioStreamHandler {
  private audioElement: HTMLAudioElement | null = null;
  private mediaSource: MediaSource | null = null;
  private sourceBuffer: SourceBuffer | null = null;
  private streamObjectUrl: string | null = null;
  private chunkQueue: ArrayBuffer[] = [];
  private streamEnded = false;
  private streamResolve: (() => void) | null = null;
  private streamReject: ((err: Error) => void) | null = null;
  private streamPromise: Promise<void> | null = null;
  private streamEndTriggered = false;

  async play(payload: ArrayBuffer, mimeType = "audio/wav"): Promise<void> {
    this.stop();
    const blob = new Blob([payload], { type: mimeType });
    const objectUrl = URL.createObjectURL(blob);
    const audio = new Audio(objectUrl);
    this.audioElement = audio;

    await audio.play();

    await new Promise<void>((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(objectUrl);
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Audio playback failed"));
      };
    });
  }

  onAudioStart(meta: { format: string; mimeType: string }): void {
    this.stopStream();
    this.streamEnded = false;
    this.streamEndTriggered = false;
    this.chunkQueue = [];
    this.streamResolve = null;
    this.streamReject = null;
    this.streamPromise = new Promise<void>((resolve, reject) => {
      this.streamResolve = resolve;
      this.streamReject = reject;
    });
    const mime = meta.mimeType || `audio/${meta.format}`;
    const ms = new MediaSource();
    this.mediaSource = ms;
    const url = URL.createObjectURL(ms);
    this.streamObjectUrl = url;
    const audio = new Audio();
    this.audioElement = audio;

    ms.addEventListener(
      "sourceopen",
      () => {
        try {
          const sb = ms.addSourceBuffer(mime);
          this.sourceBuffer = sb;
          sb.addEventListener("updateend", () => this.onSourceBufferUpdateEnd());
          this.flushChunkQueue();
        } catch {
          this.finishStreamPlayback(new Error("SourceBuffer failed"));
        }
      },
      { once: true },
    );

    ms.addEventListener("sourceended", () => {}, { once: true });
    audio.src = url;
  }

  onAudioChunk(chunk: ArrayBuffer): void {
    this.chunkQueue.push(chunk);
    this.flushChunkQueue();
  }

  onAudioEnd(): void {
    this.streamEnded = true;
    this.flushChunkQueue();
  }

  private flushChunkQueue(): void {
    if (!this.sourceBuffer || this.chunkQueue.length === 0 || this.sourceBuffer.updating) {
      if (
        this.streamEnded &&
        !this.streamEndTriggered &&
        this.chunkQueue.length === 0 &&
        (!this.sourceBuffer || !this.sourceBuffer.updating)
      ) {
        this.tryEndStreamAndPlay();
      }
      return;
    }
    const data = this.chunkQueue.shift()!;
    try {
      this.sourceBuffer.appendBuffer(data);
    } catch {
      this.chunkQueue.unshift(data);
      this.finishStreamPlayback(new Error("appendBuffer failed"));
    }
  }

  private onSourceBufferUpdateEnd(): void {
    this.flushChunkQueue();
    if (this.streamEnded && this.chunkQueue.length === 0 && this.sourceBuffer && !this.sourceBuffer.updating) {
      this.tryEndStreamAndPlay();
    }
  }

  private tryEndStreamAndPlay(): void {
    if (this.streamEndTriggered) return;
    const ms = this.mediaSource;
    const audio = this.audioElement;
    if (!ms || ms.readyState !== "open") {
      if (this.streamEnded && this.chunkQueue.length === 0) {
        this.streamEndTriggered = true;
        this.finishStreamPlayback(null);
      }
      return;
    }
    if (!audio) return;
    this.streamEndTriggered = true;
    try {
      ms.endOfStream();
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise
          .then(() => {
            audio.onended = () => this.finishStreamPlayback(null);
            audio.onerror = () => this.finishStreamPlayback(new Error("Audio playback failed"));
          })
          .catch((err) => this.finishStreamPlayback(err instanceof Error ? err : new Error(String(err))));
      } else {
        audio.onended = () => this.finishStreamPlayback(null);
        audio.onerror = () => this.finishStreamPlayback(new Error("Audio playback failed"));
      }
    } catch {
      this.finishStreamPlayback(new Error("endOfStream failed"));
    }
  }

  private finishStreamPlayback(err: Error | null): void {
    if (this.streamObjectUrl) {
      URL.revokeObjectURL(this.streamObjectUrl);
      this.streamObjectUrl = null;
    }
    this.mediaSource = null;
    this.sourceBuffer = null;
    this.audioElement = null;
    this.chunkQueue = [];
    this.streamEnded = false;
    if (err) {
      this.streamReject?.(err);
    } else {
      this.streamResolve?.();
    }
    this.streamResolve = null;
    this.streamReject = null;
    this.streamPromise = null;
  }

  private stopStream(): void {
    if (this.streamObjectUrl) {
      URL.revokeObjectURL(this.streamObjectUrl);
      this.streamObjectUrl = null;
    }
    this.mediaSource = null;
    this.sourceBuffer = null;
    this.chunkQueue = [];
    this.streamEnded = false;
    this.streamEndTriggered = false;
    this.streamReject?.(new Error("Playback stopped"));
    this.streamResolve = null;
    this.streamReject = null;
    this.streamPromise = null;
  }

  waitForStreamEnd(): Promise<void> {
    return this.streamPromise ?? Promise.resolve();
  }

  stop(): void {
    this.stopStream();
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      this.audioElement = null;
    }
  }
}
