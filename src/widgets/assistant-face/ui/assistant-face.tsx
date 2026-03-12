"use client";

import { useEffect, useRef } from "react";

import type { UiState } from "@/shared/config";

type AssistantFaceProps = {
  state: UiState;
};

const EYE_GAP = 180;

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function stateIntensity(state: UiState): number {
  switch (state) {
    case "armed":
      return 0.9;
    case "recording":
      return 1;
    case "processing":
      return 0.7;
    case "speaking":
      return 0.95;
    case "error":
      return 0.35;
    default:
      return 0.8;
  }
}

export function AssistantFace({ state }: AssistantFaceProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<UiState>(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const { clientWidth, clientHeight } = canvas;
      canvas.width = Math.floor(clientWidth * dpr);
      canvas.height = Math.floor(clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvas);

    const startTs = performance.now();
    let frameId = 0;

    const render = () => {
      const t = (performance.now() - startTs) / 1000;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#05070b";
      ctx.fillRect(0, 0, width, height);

      const intensity = stateIntensity(stateRef.current);
      const eyeWidth = Math.max(140, Math.min(width * 0.19, 210));
      const eyeHeight = eyeWidth * 1.55;
      const eyeRadius = eyeWidth * 0.36;
      const centerY = height * 0.52 + Math.sin(t * 0.75) * 5;
      const leftX = width / 2 - EYE_GAP - eyeWidth / 2;
      const rightX = width / 2 + EYE_GAP - eyeWidth / 2;

      const blinkPhaseBase = (t * 0.14 + Math.sin(t * 0.31) * 0.02) % 1;
      const blinkStrength = blinkPhaseBase > 0.88 ? (blinkPhaseBase - 0.88) / 0.12 : 0;
      const blink = 1 - Math.sin(blinkStrength * Math.PI);

      const speakingPulse = stateRef.current === "speaking" ? 0.25 + Math.sin(t * 8) * 0.12 : 0;
      const recordingFocus = stateRef.current === "recording" ? 1.15 : 1;

      const drawEye = (baseX: number, offsetSign: 1 | -1) => {
        const glow = 36 + intensity * 20;
        ctx.shadowColor = `rgba(58, 255, 172, ${0.4 + intensity * 0.35})`;
        ctx.shadowBlur = glow + speakingPulse * 30;

        const gradient = ctx.createLinearGradient(baseX, centerY - eyeHeight / 2, baseX + eyeWidth, centerY);
        gradient.addColorStop(0, `rgba(188, 255, 229, ${0.9 * intensity})`);
        gradient.addColorStop(0.4, `rgba(83, 246, 180, ${0.97 * intensity})`);
        gradient.addColorStop(1, `rgba(19, 217, 132, ${0.95 * intensity})`);
        ctx.fillStyle = gradient;
        roundedRectPath(ctx, baseX, centerY - eyeHeight / 2, eyeWidth, eyeHeight, eyeRadius);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
        roundedRectPath(ctx, baseX + 6, centerY - eyeHeight / 2 + 6, eyeWidth - 12, eyeHeight - 12, eyeRadius * 0.85);
        ctx.fill();

        const pupilW = eyeWidth * 0.34 * recordingFocus;
        const pupilH = eyeHeight * 0.46;
        const pupilY = centerY + eyeHeight * 0.2;
        const driftX = Math.sin(t * 1.6 + offsetSign) * 8;
        const pupilX = baseX + eyeWidth * 0.5 - pupilW / 2 + driftX;

        ctx.fillStyle = "#020204";
        roundedRectPath(ctx, pupilX, pupilY - pupilH, pupilW, pupilH, pupilW * 0.45);
        ctx.fill();

        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        roundedRectPath(ctx, pupilX + pupilW * 0.28, pupilY - pupilH * 0.82, pupilW * 0.22, pupilH * 0.24, pupilW * 0.11);
        ctx.fill();

        const lidHeight =
          eyeHeight * (stateRef.current === "processing" ? 0.58 : 0.46) * (0.55 + (1 - blink) * 0.45);
        const lidGradient = ctx.createLinearGradient(baseX, centerY - eyeHeight / 2, baseX, centerY - eyeHeight / 2 + lidHeight);
        lidGradient.addColorStop(0, "rgba(66, 255, 176, 0.97)");
        lidGradient.addColorStop(1, "rgba(52, 222, 148, 0.92)");
        ctx.fillStyle = lidGradient;
        roundedRectPath(ctx, baseX, centerY - eyeHeight / 2, eyeWidth, lidHeight, eyeRadius * 0.6);
        ctx.fill();
      };

      drawEye(leftX, -1);
      drawEye(rightX, 1);

      frameId = window.requestAnimationFrame(render);
    };

    frameId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="assistantFaceCanvas" />;
}
