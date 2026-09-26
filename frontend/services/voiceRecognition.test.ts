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
});
