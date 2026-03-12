export class AudioPlayer {
  private audioElement: HTMLAudioElement | null = null;

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

  stop(): void {
    if (!this.audioElement) {
      return;
    }
    this.audioElement.pause();
    this.audioElement.currentTime = 0;
    this.audioElement = null;
  }
}
