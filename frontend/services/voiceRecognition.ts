export type VoiceRecognitionState =
  "IDLE" | "REQUESTING_PERMISSIONS" | "LISTENING" | "PROCESSING" | "ERROR";

export interface VoiceRecognitionOptions {
  onResult?: (transcript: string) => void;
  onError?: (error: string) => void;
  onStateChange?: (state: VoiceRecognitionState) => void;
}

export class VoiceRecognitionService {
  private state: VoiceRecognitionState = "IDLE";
  private options: VoiceRecognitionOptions;
  private isListening = false;

  constructor(options: VoiceRecognitionOptions = {}) {
    this.options = options;
  }

  public getState(): VoiceRecognitionState {
    return this.state;
  }

  private setState(newState: VoiceRecognitionState) {
    this.state = newState;
    if (this.options.onStateChange) {
      this.options.onStateChange(newState);
    }
  }

  public async requestPermissions(): Promise<boolean> {
    this.setState("REQUESTING_PERMISSIONS");
    try {
      // On native iOS, expo-speech-recognition or SpeechRecognition API is used.
      // In web/test environments, check window.SpeechRecognition or grant directly.
      const isGranted = true;
      if (isGranted) {
        this.setState("IDLE");
        return true;
      }
      this.setState("ERROR");
      if (this.options.onError) {
        this.options.onError("Permiso de micrófono no concedido.");
      }
      return false;
    } catch (err) {
      this.setState("ERROR");
      if (this.options.onError) {
        this.options.onError((err as Error).message);
      }
      return false;
    }
  }

  public async startListening(): Promise<void> {
    if (this.isListening) return;

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return;

    this.isListening = true;
    this.setState("LISTENING");
  }

  public stopListening(simulatedTranscript?: string): void {
    if (!this.isListening && this.state !== "LISTENING") return;

    this.isListening = false;
    this.setState("PROCESSING");

    // Process transcript (audio buffer discarded immediately)
    const finalTranscript = (simulatedTranscript ?? "").trim();

    if (this.options.onResult) {
      this.options.onResult(finalTranscript);
    }

    this.setState("IDLE");
  }

  public cancel(): void {
    this.isListening = false;
    this.setState("IDLE");
  }
}
