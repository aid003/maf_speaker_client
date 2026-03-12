"use client";

import { useMemo, useState } from "react";
import type { VoiceDiagnostics } from "@/features/voice-session";

import type { UiState } from "@/shared/config";

type DebugModalProps = {
  diagnostics: VoiceDiagnostics;
  uiState: UiState;
  isRunning: boolean;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
};

export function DebugModal({ diagnostics, uiState, isRunning, onStart, onStop }: DebugModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"start" | "stop" | null>(null);

  const statusRows = useMemo(
    () => [
      { label: "Microphone API", value: diagnostics.hasMicrophoneApi ? "available" : "not available" },
      { label: "Permission", value: diagnostics.permission },
      { label: "WS status", value: diagnostics.wsStatus },
      { label: "UI state", value: uiState },
      { label: "Sample rate", value: diagnostics.sampleRate ? `${diagnostics.sampleRate} Hz` : "n/a" },
      { label: "Seq", value: String(diagnostics.seq) },
      { label: "Dropped chunks", value: String(diagnostics.droppedChunks) },
      { label: "RTT", value: diagnostics.rttMs !== null ? `${diagnostics.rttMs} ms` : "n/a" },
    ],
    [diagnostics, uiState],
  );

  const runAction = async (action: "start" | "stop") => {
    setPendingAction(action);
    try {
      if (action === "start") {
        await onStart();
      } else {
        await onStop();
      }
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="Open diagnostics"
        className="debugFab"
        onClick={() => setIsOpen(true)}
      />
      {isOpen ? (
        <div className="debugOverlay" role="presentation" onClick={() => setIsOpen(false)}>
          <section
            className="debugModal"
            role="dialog"
            aria-modal="true"
            aria-label="Diagnostics"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="debugModalHeader">
              <h2>Тех статус</h2>
              <button type="button" onClick={() => setIsOpen(false)}>
                Закрыть
              </button>
            </header>

            <div className="debugControls">
              <button
                type="button"
                disabled={isRunning || pendingAction !== null}
                onClick={() => void runAction("start")}
              >
                {pendingAction === "start" ? "Старт..." : "Старт сессии"}
              </button>
              <button
                type="button"
                disabled={!isRunning || pendingAction !== null}
                onClick={() => void runAction("stop")}
              >
                {pendingAction === "stop" ? "Стоп..." : "Стоп сессии"}
              </button>
            </div>

            <ul className="debugStats">
              {statusRows.map((row) => (
                <li key={row.label}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </li>
              ))}
            </ul>

            <h3>Последние события</h3>
            <ul className="debugEvents">
              {diagnostics.lastEvents.length === 0 ? (
                <li>пока нет событий</li>
              ) : (
                diagnostics.lastEvents.map((event) => <li key={event}>{event}</li>)
              )}
            </ul>
          </section>
        </div>
      ) : null}
    </>
  );
}
