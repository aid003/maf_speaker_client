"use client";

import { useEffect, useRef } from "react";

import type { UiState } from "@/shared/config";

type AssistantFaceProps = {
  state: UiState;
};

type MicroEvent = "blink" | "doubleBlink" | "winkLeft" | "winkRight" | "microSaccade";

type EyePose = {
  driftX: number;
  driftY: number;
  pupilScale: number;
  smileLid: number;
  baseLid: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}

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

function upperLidRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  closeAmount: number,
): void {
  const lidHeight = clamp(height * closeAmount + 6, 6, height + 2);
  roundedRectPath(ctx, x, y, width, lidHeight, radius * 0.9);
}

function stateIntensity(state: UiState): number {
  switch (state) {
    case "armed":
      return 0.9;
    case "recording":
      return 1.22;
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

function blinkPulse(progress: number): number {
  if (progress <= 0 || progress >= 1) {
    return 0;
  }
  const arc = Math.sin(progress * Math.PI);
  return arc * arc;
}

function pickEvent(state: UiState): MicroEvent {
  const roll = Math.random();
  if (state === "speaking") {
    if (roll < 0.28) return "blink";
    if (roll < 0.46) return "doubleBlink";
    if (roll < 0.64) return "winkLeft";
    if (roll < 0.8) return "winkRight";
    return "microSaccade";
  }
  if (state === "recording" || state === "armed") {
    if (roll < 0.55) return "blink";
    if (roll < 0.67) return "doubleBlink";
    if (roll < 0.77) return "winkLeft";
    if (roll < 0.87) return "winkRight";
    return "microSaccade";
  }
  if (state === "processing") {
    if (roll < 0.2) return "blink";
    if (roll < 0.42) return "doubleBlink";
    if (roll < 0.62) return "winkLeft";
    if (roll < 0.8) return "winkRight";
    return "microSaccade";
  }
  if (state === "error") {
    return roll < 0.88 ? "blink" : "microSaccade";
  }

  if (roll < 0.46) return "blink";
  if (roll < 0.68) return "doubleBlink";
  if (roll < 0.82) return "winkLeft";
  if (roll < 0.95) return "winkRight";
  return "microSaccade";
}

function eventIntervalSeconds(state: UiState): number {
  if (state === "speaking") return 1.4 + Math.random() * 1.7;
  if (state === "recording" || state === "armed") return 1.8 + Math.random() * 2.4;
  if (state === "processing") return 0.65 + Math.random() * 0.8;
  if (state === "error") return 2.4 + Math.random() * 2.6;
  return 1.7 + Math.random() * 2.2;
}

function poseForState(state: UiState, t: number, offsetSign: 1 | -1): EyePose {
  if (state === "recording" || state === "armed") {
    return {
      driftX: Math.sin(t * 0.9 + offsetSign) * 0.35,
      driftY: -0.7,
      pupilScale: state === "recording" ? 1.34 : 1.16,
      smileLid: 0.02,
      baseLid: 0.1,
    };
  }

  if (state === "speaking") {
    return {
      driftX: Math.sin(t * 1.9 + offsetSign * 0.2) * 5.2 + Math.cos(t * 0.7) * 1.4,
      driftY: Math.cos(t * 2.25 + offsetSign * 0.25) * 2.8 - 1.8,
      pupilScale: 1.05,
      smileLid: 0.12,
      baseLid: 0.18,
    };
  }

  if (state === "processing") {
    return {
      driftX: Math.sin(t * 2.8 + offsetSign * 0.8) * 7 + Math.cos(t * 1.4) * 2.2,
      driftY: Math.cos(t * 2.35 + offsetSign * 0.4) * 4.1 + Math.sin(t * 1.6) * 1.3,
      pupilScale: 1.08,
      smileLid: 0.06,
      baseLid: 0.28,
    };
  }

  if (state === "error") {
    return {
      driftX: 0,
      driftY: 1.9,
      pupilScale: 0.92,
      smileLid: 0,
      baseLid: 0.42,
    };
  }

  return {
    driftX: Math.sin(t * 1.45 + offsetSign) * 3.8,
    driftY: Math.cos(t * 1.05 + offsetSign * 0.7) * 1.9 - 0.4,
    pupilScale: 1,
    smileLid: 0.04,
    baseLid: 0.2,
  };
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
    let nextEventAt = 0;
    let eventType: Exclude<MicroEvent, "microSaccade"> | null = null;
    let eventStart = 0;
    let eventDuration = 0;
    let eventGap = 0;
    let microTargetX = 0;
    let microTargetY = 0;
    let microX = 0;
    let microY = 0;

    const smooth = {
      leftX: 0,
      leftY: 0,
      rightX: 0,
      rightY: 0,
      leftScale: 1,
      rightScale: 1,
      leftLid: 0.2,
      rightLid: 0.2,
    };

    const resetEventTimer = (t: number) => {
      nextEventAt = t + eventIntervalSeconds(stateRef.current);
    };

    const render = () => {
      const t = (performance.now() - startTs) / 1000;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#05070b";
      ctx.fillRect(0, 0, width, height);

      const intensity = stateIntensity(stateRef.current);
      // Адаптивный базовый размер: укладываемся и по ширине (2 глаза + зазор), и по высоте (высота глаза)
      const baseSize = Math.min(width / 0.84, height / 0.47);
      const eyeWidth = baseSize * 0.32;
      const eyeHeight = eyeWidth * 1.48;
      const eyeRx = eyeWidth / 2;
      const eyeRy = eyeHeight / 2;
      const eyeCorner = eyeWidth * 0.22;
      const centerY = height * 0.52 + Math.sin(t * 0.75) * 5;
      const eyeGap = baseSize * 0.2;
      const leftCx = width / 2 - eyeGap;
      const rightCx = width / 2 + eyeGap;

      const blinkPhaseBase = (t * 0.19 + Math.sin(t * 0.41) * 0.03) % 1;
      const blinkStrength = blinkPhaseBase > 0.93 ? (blinkPhaseBase - 0.93) / 0.07 : 0;
      const baseBlink = blinkPulse(blinkStrength);

      const speakingPulse = stateRef.current === "speaking" ? 0.25 + Math.sin(t * 8) * 0.12 : 0;
      const processingPulse = stateRef.current === "processing" ? 0.35 + Math.sin(t * 8.8) * 0.24 : 0;
      if (!nextEventAt) {
        resetEventTimer(t);
      }

      if (t >= nextEventAt && !eventType) {
        const chosen = pickEvent(stateRef.current);
        if (chosen === "microSaccade") {
          microTargetX += (Math.random() * 2 - 1) * 2.7;
          microTargetY += (Math.random() * 2 - 1) * 1.8;
          resetEventTimer(t);
        } else {
          eventType = chosen;
          eventStart = t;
          eventDuration = chosen.includes("wink") ? 0.19 : 0.17;
          eventGap = 0.075;
        }
      }

      let eventLeft = 0;
      let eventRight = 0;
      if (eventType) {
        const elapsed = t - eventStart;
        const inFirst = elapsed <= eventDuration;
        const inSecond =
          eventType === "doubleBlink" && elapsed > eventDuration + eventGap && elapsed <= eventDuration * 2 + eventGap;
        if (inFirst) {
          const firstPulse = blinkPulse(elapsed / eventDuration);
          if (eventType === "winkLeft") {
            eventLeft = firstPulse;
          } else if (eventType === "winkRight") {
            eventRight = firstPulse;
          } else {
            eventLeft = firstPulse;
            eventRight = firstPulse;
          }
        } else if (inSecond) {
          const secondProgress = (elapsed - eventDuration - eventGap) / eventDuration;
          const secondPulse = blinkPulse(secondProgress);
          eventLeft = secondPulse;
          eventRight = secondPulse;
        } else if (elapsed > eventDuration * (eventType === "doubleBlink" ? 2 : 1) + eventGap + 0.04) {
          eventType = null;
          resetEventTimer(t);
        }
      }

      microTargetX *= 0.88;
      microTargetY *= 0.88;
      microX = lerp(microX, microTargetX, 0.2);
      microY = lerp(microY, microTargetY, 0.2);

      const drawEye = (centerX: number, offsetSign: 1 | -1, winkBoost: number) => {
        const pose = poseForState(stateRef.current, t, offsetSign);
        const alpha = 0.14;
        if (offsetSign === -1) {
          smooth.leftX = lerp(smooth.leftX, pose.driftX + microX, alpha);
          smooth.leftY = lerp(smooth.leftY, pose.driftY + microY, alpha);
          smooth.leftScale = lerp(smooth.leftScale, pose.pupilScale, alpha);
          smooth.leftLid = lerp(smooth.leftLid, pose.baseLid + pose.smileLid, alpha * 0.8);
        } else {
          smooth.rightX = lerp(smooth.rightX, pose.driftX + microX, alpha);
          smooth.rightY = lerp(smooth.rightY, pose.driftY + microY, alpha);
          smooth.rightScale = lerp(smooth.rightScale, pose.pupilScale, alpha);
          smooth.rightLid = lerp(smooth.rightLid, pose.baseLid + pose.smileLid, alpha * 0.8);
        }

        const driftX = offsetSign === -1 ? smooth.leftX : smooth.rightX;
        const driftY = offsetSign === -1 ? smooth.leftY : smooth.rightY;
        const pupilScale = offsetSign === -1 ? smooth.leftScale : smooth.rightScale;
        const baseLid = offsetSign === -1 ? smooth.leftLid : smooth.rightLid;
        const recordingBoost = stateRef.current === "recording" ? 20 : 0;
        const glow = 36 + intensity * 20 + recordingBoost;
        ctx.shadowColor = `rgba(58, 255, 172, ${0.4 + intensity * 0.35})`;
        ctx.shadowBlur = glow + speakingPulse * 30 + processingPulse * 28;

        const gradient = ctx.createLinearGradient(centerX - eyeRx, centerY - eyeRy, centerX + eyeRx, centerY + eyeRy);
        gradient.addColorStop(0, `rgba(188, 255, 229, ${0.95 * intensity})`);
        gradient.addColorStop(0.4, `rgba(83, 246, 180, ${1.02 * intensity})`);
        gradient.addColorStop(1, `rgba(19, 217, 132, ${0.98 * intensity})`);
        ctx.fillStyle = gradient;
        roundedRectPath(ctx, centerX - eyeRx, centerY - eyeRy, eyeWidth, eyeHeight, eyeCorner);
        ctx.fill();

        ctx.shadowBlur = 0;
        const innerGradient = ctx.createLinearGradient(centerX, centerY - eyeRy, centerX, centerY + eyeRy);
        innerGradient.addColorStop(0, "rgba(255, 255, 255, 0.24)");
        innerGradient.addColorStop(1, "rgba(255, 255, 255, 0.06)");
        ctx.fillStyle = innerGradient;
        roundedRectPath(ctx, centerX - eyeRx + 7, centerY - eyeRy + 8, eyeWidth - 14, eyeHeight - 16, eyeCorner * 0.9);
        ctx.fill();

        const pupilWidth = eyeWidth * 0.36 * pupilScale;
        const pupilHeight = eyeHeight * 0.48;
        const pupilX = centerX - pupilWidth / 2 + driftX;
        const pupilY = centerY - pupilHeight / 2 + eyeRy * 0.2 + driftY;
        const pupilCorner = pupilWidth * 0.34;

        ctx.fillStyle = "#020204";
        roundedRectPath(ctx, pupilX, pupilY, pupilWidth, pupilHeight, pupilCorner);
        ctx.fill();

        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        roundedRectPath(
          ctx,
          pupilX + pupilWidth * 0.34,
          pupilY + pupilHeight * 0.12,
          pupilWidth * 0.24,
          pupilHeight * 0.18,
          pupilWidth * 0.1,
        );
        ctx.fill();

        const closeAmount = clamp(baseLid + baseBlink * 0.82 + winkBoost * 0.98, 0.06, 0.98);
        const lidGradient = ctx.createLinearGradient(centerX, centerY - eyeRy, centerX, centerY + eyeRy);
        lidGradient.addColorStop(0, "rgba(66, 255, 176, 0.97)");
        lidGradient.addColorStop(1, "rgba(46, 205, 136, 0.9)");

        ctx.save();
        roundedRectPath(ctx, centerX - eyeRx, centerY - eyeRy, eyeWidth, eyeHeight, eyeCorner);
        ctx.clip();
        ctx.fillStyle = lidGradient;
        upperLidRectPath(ctx, centerX - eyeRx, centerY - eyeRy, eyeWidth, eyeHeight, eyeCorner, closeAmount);
        ctx.fill();

        if (stateRef.current === "processing") {
          const scanY = centerY - eyeRy + ((Math.sin(t * 3.2 + offsetSign) + 1) * 0.5) * eyeHeight;
          const scanHeight = eyeHeight * 0.1;
          ctx.fillStyle = `rgba(175, 255, 222, ${0.12 + processingPulse * 0.12})`;
          roundedRectPath(ctx, centerX - eyeRx + 2, scanY, eyeWidth - 4, scanHeight, eyeCorner * 0.5);
          ctx.fill();
        }
        ctx.restore();
      };

      drawEye(leftCx, -1, Math.max(eventLeft, eventType === "winkRight" ? baseBlink * 0.04 : 0));
      drawEye(rightCx, 1, Math.max(eventRight, eventType === "winkLeft" ? baseBlink * 0.04 : 0));

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
