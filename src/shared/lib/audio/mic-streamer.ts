type ChunkHandler = (chunk: Float32Array) => void;

const PROCESSOR_NAME = "mic-stream-processor";

const PROCESSOR_CODE = `
class MicStreamProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) {
      return true;
    }
    this.port.postMessage(input[0]);
    return true;
  }
}
registerProcessor("${PROCESSOR_NAME}", MicStreamProcessor);
`;

export class MicStreamer {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private silentGainNode: GainNode | null = null;
  private chunkHandler: ChunkHandler | null = null;
  private started = false;

  public sampleRate = 0;

  onChunk(cb: ChunkHandler): void {
    this.chunkHandler = cb;
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: true,
      },
    });

    this.audioContext = new AudioContext({ latencyHint: "interactive" });
    this.sampleRate = this.audioContext.sampleRate;
    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);

    const workletSupported =
      typeof AudioWorkletNode !== "undefined" &&
      typeof this.audioContext.audioWorklet?.addModule === "function";

    if (workletSupported) {
      const blob = new Blob([PROCESSOR_CODE], { type: "text/javascript" });
      const moduleUrl = URL.createObjectURL(blob);
      await this.audioContext.audioWorklet.addModule(moduleUrl);
      URL.revokeObjectURL(moduleUrl);

      this.workletNode = new AudioWorkletNode(this.audioContext, PROCESSOR_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 1,
      });

      this.workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (!this.chunkHandler) {
          return;
        }
        this.chunkHandler(new Float32Array(event.data));
      };

      this.sourceNode.connect(this.workletNode);
    } else {
      this.scriptNode = this.audioContext.createScriptProcessor(2048, 1, 1);
      this.silentGainNode = this.audioContext.createGain();
      this.silentGainNode.gain.value = 0;
      this.scriptNode.onaudioprocess = (event: AudioProcessingEvent) => {
        const channelData = event.inputBuffer.getChannelData(0);
        this.chunkHandler?.(new Float32Array(channelData));
      };
      this.sourceNode.connect(this.scriptNode);
      this.scriptNode.connect(this.silentGainNode);
      this.silentGainNode.connect(this.audioContext.destination);
    }

    this.started = true;
  }

  async stop(): Promise<void> {
    this.workletNode?.disconnect();
    this.scriptNode?.disconnect();
    this.silentGainNode?.disconnect();
    this.sourceNode?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    await this.audioContext?.close();

    this.workletNode = null;
    this.scriptNode = null;
    this.silentGainNode = null;
    this.sourceNode = null;
    this.stream = null;
    this.audioContext = null;
    this.started = false;
  }
}
