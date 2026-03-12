"use client";

import { AssistantFace, DebugModal } from "@/widgets/index";

import { useVoiceSession } from "@/features/index";

export default function Home() {
  const { uiState, diagnostics, isRunning, startSession, stopSession } = useVoiceSession();

  return (
    <main className="voicePage">
      <section className="voiceFaceWrap">
        <AssistantFace state={uiState} />
      </section>

      <DebugModal
        diagnostics={diagnostics}
        uiState={uiState}
        isRunning={isRunning}
        onStart={startSession}
        onStop={stopSession}
      />
    </main>
  );
}
