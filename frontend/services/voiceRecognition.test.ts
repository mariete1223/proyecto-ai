import {
  VoiceRecognitionService,
  VoiceRecognitionState,
} from "./voiceRecognition";

describe("VoiceRecognitionService (Task 30)", () => {
  it("initializes in IDLE state", () => {
    const service = new VoiceRecognitionService();
    expect(service.getState()).toBe("IDLE");
  });

  it("handles state transitions during full capture flow", async () => {
    const states: VoiceRecognitionState[] = [];
    let transcriptResult = "";

    const service = new VoiceRecognitionService({
      onStateChange: (state) => states.push(state),
      onResult: (text) => {
        transcriptResult = text;
      },
    });

    await service.startListening();
    expect(states).toContain("LISTENING");

    service.stopListening(
      "nota fecha hoy contenido comprar leche etiquetas urgente",
    );

    expect(transcriptResult).toBe(
      "nota fecha hoy contenido comprar leche etiquetas urgente",
    );
    expect(service.getState()).toBe("IDLE");
  });

  it("handles cancellation gracefully", async () => {
    const states: VoiceRecognitionState[] = [];
    const service = new VoiceRecognitionService({
      onStateChange: (state) => states.push(state),
    });

    await service.startListening();
    expect(service.getState()).toBe("LISTENING");

    service.cancel();
    expect(service.getState()).toBe("IDLE");
  });

  describe("Web Speech API accumulation (Issue #57 regression)", () => {
    let mockInstance: any;

    class MockSpeechRecognition {
      continuous = false;
      interimResults = false;
      lang = "";
      onresult: any = null;
      onerror: any = null;
      onend: any = null;
      start = jest.fn();
      stop = jest.fn();

      constructor() {
        mockInstance = this;
      }
    }

    beforeEach(() => {
      mockInstance = null;
      (window as any).SpeechRecognition = MockSpeechRecognition;
    });

    afterEach(() => {
      delete (window as any).SpeechRecognition;
      delete (window as any).webkitSpeechRecognition;
    });

    it("does not repeat earlier sentences in multi-event continuous dictation", async () => {
      const results: string[] = [];
      const service = new VoiceRecognitionService({
        onResult: (text) => results.push(text),
      });

      await service.startListening();
      expect(mockInstance).not.toBeNull();
      expect(mockInstance.start).toHaveBeenCalled();

      // Event 1: First phrase finalized
      mockInstance.onresult({
        results: [
          { isFinal: true, 0: { transcript: "reunión con el equipo" } },
        ],
      });
      expect(results[results.length - 1]).toBe("reunión con el equipo");

      // Event 2: First phrase finalized + second phrase interim
      mockInstance.onresult({
        results: [
          { isFinal: true, 0: { transcript: "reunión con el equipo" } },
          { isFinal: false, 0: { transcript: "para revisar" } },
        ],
      });
      expect(results[results.length - 1]).toBe(
        "reunión con el equipo para revisar",
      );

      // Event 3: First phrase finalized + second phrase finalized
      mockInstance.onresult({
        results: [
          { isFinal: true, 0: { transcript: "reunión con el equipo" } },
          { isFinal: true, 0: { transcript: "para revisar el proyecto" } },
        ],
      });
      expect(results[results.length - 1]).toBe(
        "reunión con el equipo para revisar el proyecto",
      );

      // Event 4: Third phrase finalized (long dictation with pauses)
      mockInstance.onresult({
        results: [
          { isFinal: true, 0: { transcript: "reunión con el equipo" } },
          { isFinal: true, 0: { transcript: "para revisar el proyecto" } },
          { isFinal: true, 0: { transcript: "mañana a las diez" } },
        ],
      });
      // Crucial: Must NOT contain repetitions like "reunión con el equipo reunión con el equipo"
      expect(results[results.length - 1]).toBe(
        "reunión con el equipo para revisar el proyecto mañana a las diez",
      );

      // Stopping listening delivers clean final text
      let finalDelivered = "";
      service["options"].onResult = (text: string) => {
        finalDelivered = text;
      };
      service.stopListening();
      expect(finalDelivered).toBe(
        "reunión con el equipo para revisar el proyecto mañana a las diez",
      );
    });

    it("handles speech recognition error callback", async () => {
      let errorMessage = "";
      const service = new VoiceRecognitionService({
        onError: (err) => {
          errorMessage = err;
        },
      });

      await service.startListening();
      mockInstance.onerror({ error: "no-speech" });

      expect(errorMessage).toContain("no-speech");
    });
  });
});
