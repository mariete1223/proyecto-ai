export type VoiceRecognitionState =
  "IDLE" | "REQUESTING_PERMISSIONS" | "LISTENING" | "PROCESSING" | "ERROR";

export interface VoiceRecognitionOptions {
  onResult?: (transcript: string) => void;
  onError?: (error: string) => void;
  onStateChange?: (state: VoiceRecognitionState) => void;
}

interface SpeechRecognitionResultItem {
  transcript: string;
}

interface SpeechRecognitionResult {
  [key: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionResults {
  [key: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResults;
}

interface SpeechRecognitionErrorEvent {
  error?: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

export class VoiceRecognitionService {
  private state: VoiceRecognitionState = "IDLE";
  private options: VoiceRecognitionOptions;
  private isListening = false;
  private recognitionInstance: SpeechRecognitionInstance | null = null;

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

    // Initialize Web Speech API if supported in browser
    if (
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    ) {
      try {
        const SpeechClass =
          (
            window as unknown as {
              SpeechRecognition?: SpeechRecognitionConstructor;
              webkitSpeechRecognition?: SpeechRecognitionConstructor;
            }
          ).SpeechRecognition ||
          (
            window as unknown as {
              SpeechRecognition?: SpeechRecognitionConstructor;
              webkitSpeechRecognition?: SpeechRecognitionConstructor;
            }
          ).webkitSpeechRecognition;

        if (SpeechClass) {
          const instance = new SpeechClass();
          instance.continuous = true;
          instance.interimResults = true;
          instance.lang = "es-ES";

          instance.onresult = (event: SpeechRecognitionEvent) => {
            let text = "";
            for (let i = 0; i < event.results.length; i++) {
              text += event.results[i][0].transcript;
            }
            if (this.options.onResult) {
              this.options.onResult(text);
            }
          };

          instance.onerror = (errEvent: SpeechRecognitionErrorEvent) => {
            if (this.options.onError) {
              this.options.onError(
                `Aviso del micrófono: ${errEvent.error || "audio no disponible"}`,
              );
            }
          };

          instance.start();
          this.recognitionInstance = instance;
        }
      } catch (e) {
        console.warn("Web Speech API no pudo iniciarse:", e);
      }
    }
  }

  public stopListening(simulatedTranscript?: string): void {
    if (!this.isListening && this.state !== "LISTENING") return;

    this.isListening = false;
    this.setState("PROCESSING");

    if (this.recognitionInstance) {
      try {
        this.recognitionInstance.stop();
      } catch {
        // ignore
      }
      this.recognitionInstance = null;
    }

    const finalTranscript = (simulatedTranscript ?? "").trim();

    if (this.options.onResult && finalTranscript) {
      this.options.onResult(finalTranscript);
    }

    this.setState("IDLE");
  }

  public cancel(): void {
    if (this.recognitionInstance) {
      try {
        this.recognitionInstance.stop();
      } catch {
        // ignore
      }
      this.recognitionInstance = null;
    }
    this.isListening = false;
    this.setState("IDLE");
  }
}
