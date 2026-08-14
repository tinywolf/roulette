type AudioContextFactory = () => AudioContext | null;

function createBrowserAudioContext(): AudioContext | null {
  const windowWithWebkit = window as typeof window & {
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextClass =
    globalThis.AudioContext ?? windowWithWebkit.webkitAudioContext;

  return AudioContextClass ? new AudioContextClass() : null;
}

function safelyDisconnect(node: AudioNode | null): void {
  if (!node) {
    return;
  }

  try {
    node.disconnect();
  } catch {
    // 이미 종료된 오디오 노드 정리는 멱등하게 처리한다.
  }
}

/** 돌림판 회전·당첨 효과음과 관련 노드의 수명주기를 기능 내부에서 관리한다. */
export class WheelSoundController {
  private enabled = false;
  private context: AudioContext | null = null;
  private spinOscillator: OscillatorNode | null = null;
  private spinGain: GainNode | null = null;
  private readonly winnerNodes = new Set<AudioNode>();

  constructor(
    private readonly createAudioContext: AudioContextFactory =
      createBrowserAudioContext,
  ) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    if (!enabled) {
      this.stopSpin();
      this.stopWinnerNodes();
    }
  }

  startSpin(durationMs: number): void {
    if (!this.enabled) {
      return;
    }

    try {
      const context = this.ensureContext();

      if (!context) {
        return;
      }

      this.stopSpin();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const endTime = context.currentTime + durationMs / 1_000;

      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(110, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(42, endTime);
      gain.gain.setValueAtTime(0.045, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.008, endTime);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(endTime);
      this.spinOscillator = oscillator;
      this.spinGain = gain;
    } catch {
      this.stopSpin();
    }
  }

  playWinner(): void {
    if (!this.enabled) {
      return;
    }

    try {
      const context = this.ensureContext();

      if (!context) {
        return;
      }

      this.stopSpin();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const endTime = context.currentTime + 0.24;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(660, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(990, endTime);
      gain.gain.setValueAtTime(0.09, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, endTime);
      oscillator.connect(gain);
      gain.connect(context.destination);
      this.winnerNodes.add(oscillator);
      this.winnerNodes.add(gain);
      oscillator.onended = () => {
        safelyDisconnect(oscillator);
        safelyDisconnect(gain);
        this.winnerNodes.delete(oscillator);
        this.winnerNodes.delete(gain);
      };
      oscillator.start();
      oscillator.stop(endTime);
    } catch {
      this.stopWinnerNodes();
    }
  }

  stopSpin(): void {
    if (this.spinOscillator) {
      try {
        this.spinOscillator.stop();
      } catch {
        // 예약 종료되었거나 이미 정지한 oscillator를 다시 멈춰도 무시한다.
      }
    }

    safelyDisconnect(this.spinOscillator);
    safelyDisconnect(this.spinGain);
    this.spinOscillator = null;
    this.spinGain = null;
  }

  dispose(): void {
    this.enabled = false;
    this.stopSpin();
    this.stopWinnerNodes();

    if (this.context) {
      void this.context.close().catch(() => undefined);
      this.context = null;
    }
  }

  private ensureContext(): AudioContext | null {
    this.context ??= this.createAudioContext();

    if (this.context?.state === "suspended") {
      void this.context.resume().catch(() => undefined);
    }

    return this.context;
  }

  private stopWinnerNodes(): void {
    for (const node of this.winnerNodes) {
      if ("stop" in node && typeof node.stop === "function") {
        try {
          node.stop();
        } catch {
          // 이미 종료된 당첨음 노드는 연결만 해제한다.
        }
      }

      safelyDisconnect(node);
    }

    this.winnerNodes.clear();
  }
}
