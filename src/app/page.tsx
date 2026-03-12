"use client";

import { useState } from "react";
import { AssistantFace, DebugModal } from "@/widgets/index";

import { useVoiceSession } from "@/features/index";

export default function Home() {
  const { uiState, diagnostics, isRunning, startSession, stopSession } = useVoiceSession();
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
    setStarting(true);
    try {
      await startSession();
    } finally {
      setStarting(false);
    }
  };

  return (
    <main className="voicePage">
      <section className="voiceFaceWrap">
        <AssistantFace state={uiState} />
      </section>

      {!isRunning && (
        <section className="voiceStartWrap">
          <button
            type="button"
            className="voiceStartBtn"
            disabled={starting}
            onClick={() => void handleStart()}
          >
            {starting ? "Старт…" : "Старт"}
          </button>
        </section>
      )}

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
