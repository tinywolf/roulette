export type SoundEvent = "draw" | "complete";

type BrowserWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const WIND_BUFFER_SECONDS = 2;
const COLLISION_BUFFER_SECONDS = 0.045;
const MAX_SOUND_BALL_COUNT = 45;
const MASTER_VOLUME_MULTIPLIER = 1.5;

/**
 * Web Audio로 단발성 결과음과 지속형 추첨기 혼합음을 생성한다.
 * 음향 수명과 불규칙성은 추첨 난수·결과 상태와 분리해 보조 연출로만 관리한다.
 */
export class SoundController {
  private context: AudioContext | null = null;

  private enabled = false;

  private mixing = false;

  private mixingGeneration = 0;

  private mixingBallCount = 0;

  private windSource: AudioBufferSourceNode | null = null;

  private windGain: GainNode | null = null;

  private windBuffer: AudioBuffer | null = null;

  private collisionBuffer: AudioBuffer | null = null;

  private collisionTimer: number | null = null;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    if (!enabled) {
      this.stopMixing();
    }
  }

  async play(event: SoundEvent): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const context = await this.getReadyContext();
      if (!context || !this.enabled) {
        return;
      }

      const now = context.currentTime;
      const tones =
        event === "complete"
          ? [
              { frequency: 523, offset: 0, duration: 0.12 },
              { frequency: 659, offset: 0.12, duration: 0.12 },
              { frequency: 784, offset: 0.24, duration: 0.2 },
            ]
          : [{ frequency: 660, offset: 0, duration: 0.16 }];

      for (const tone of tones) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = now + tone.offset;
        const end = start + tone.duration;

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(tone.frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(
          0.13 * MASTER_VOLUME_MULTIPLIER,
          start + 0.015,
        );
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(end + 0.02);
      }
    } catch {
      // 음향은 보조 기능이므로 실패해도 추첨 흐름을 유지한다.
    }
  }

  async startMixing(ballCount: number): Promise<void> {
    this.mixingBallCount = Math.max(
      1,
      Math.min(MAX_SOUND_BALL_COUNT, Math.round(ballCount)),
    );

    if (!this.enabled) {
      return;
    }

    if (this.mixing) {
      if (
        this.mixingBallCount <= 1 &&
        this.collisionTimer !== null &&
        typeof window !== "undefined"
      ) {
        window.clearTimeout(this.collisionTimer);
        this.collisionTimer = null;
      } else if (
        this.mixingBallCount > 1 &&
        this.collisionTimer === null &&
        this.context
      ) {
        this.scheduleCollision(this.context, this.mixingGeneration);
      }
      return;
    }

    const generation = ++this.mixingGeneration;

    try {
      const context = await this.getReadyContext();
      if (
        !context ||
        !this.enabled ||
        generation !== this.mixingGeneration
      ) {
        return;
      }

      const now = context.currentTime;
      const windSource = context.createBufferSource();
      const windFilter = context.createBiquadFilter();
      const windGain = context.createGain();

      this.windBuffer ??= this.createWindBuffer(context);
      this.collisionBuffer ??= this.createCollisionBuffer(context);
      windSource.buffer = this.windBuffer;
      windSource.loop = true;
      windFilter.type = "lowpass";
      windFilter.frequency.setValueAtTime(920, now);
      windFilter.Q.setValueAtTime(0.7, now);
      windGain.gain.setValueAtTime(0.0001, now);
      windGain.gain.exponentialRampToValueAtTime(
        0.042 * MASTER_VOLUME_MULTIPLIER,
        now + 0.18,
      );
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(context.destination);

      this.windSource = windSource;
      this.windGain = windGain;
      this.mixing = true;
      windSource.start(now);
      if (this.mixingBallCount > 1) {
        this.scheduleCollision(context, generation);
      }
    } catch {
      if (generation === this.mixingGeneration) {
        this.stopMixing();
      }
    }
  }

  stopMixing(): void {
    this.mixingGeneration += 1;
    this.mixing = false;

    if (this.collisionTimer !== null && typeof window !== "undefined") {
      window.clearTimeout(this.collisionTimer);
    }
    this.collisionTimer = null;

    const context = this.context;
    const windSource = this.windSource;
    const windGain = this.windGain;
    this.windSource = null;
    this.windGain = null;

    if (!context || !windSource || !windGain) {
      return;
    }

    try {
      const now = context.currentTime;
      windGain.gain.cancelScheduledValues(now);
      windGain.gain.linearRampToValueAtTime(0.0001, now + 0.12);
      windSource.stop(now + 0.14);
    } catch {
      // 이미 정지되었거나 context가 닫힌 경우 추가 정리가 필요하지 않다.
    }
  }

  dispose(): void {
    this.stopMixing();
    void this.context?.close().catch(() => undefined);
    this.context = null;
    this.windBuffer = null;
    this.collisionBuffer = null;
  }

  private async getReadyContext(): Promise<AudioContext | null> {
    if (!this.enabled || typeof window === "undefined") {
      return null;
    }

    const browserWindow = window as BrowserWindow;
    const AudioContextConstructor =
      browserWindow.AudioContext ?? browserWindow.webkitAudioContext;

    if (!AudioContextConstructor) {
      return null;
    }

    this.context ??= new AudioContextConstructor();

    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    return this.context;
  }

  private createWindBuffer(context: AudioContext): AudioBuffer {
    const frameCount = Math.max(
      1,
      Math.floor(context.sampleRate * WIND_BUFFER_SECONDS),
    );
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const channel = buffer.getChannelData(0);
    let smoothedNoise = 0;

    for (let index = 0; index < channel.length; index += 1) {
      const whiteNoise = Math.random() * 2 - 1;
      smoothedNoise = smoothedNoise * 0.985 + whiteNoise * 0.015;
      channel[index] = smoothedNoise * 3.2;
    }

    return buffer;
  }

  private createCollisionBuffer(context: AudioContext): AudioBuffer {
    const frameCount = Math.max(
      1,
      Math.floor(context.sampleRate * COLLISION_BUFFER_SECONDS),
    );
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const channel = buffer.getChannelData(0);

    for (let index = 0; index < channel.length; index += 1) {
      const progress = index / channel.length;
      const envelope = (1 - progress) ** 3;
      channel[index] = (Math.random() * 2 - 1) * envelope;
    }

    return buffer;
  }

  private scheduleCollision(
    context: AudioContext,
    generation: number,
  ): void {
    if (
      !this.mixing ||
      !this.enabled ||
      generation !== this.mixingGeneration ||
      this.mixingBallCount <= 1 ||
      typeof window === "undefined"
    ) {
      return;
    }

    const normalizedCount =
      (this.mixingBallCount - 1) / (MAX_SOUND_BALL_COUNT - 1);
    const baseInterval = 520 - normalizedCount * 390;
    const jitter = 0.65 + Math.random() * 0.7;
    const delay = Math.round(baseInterval * jitter);

    this.collisionTimer = window.setTimeout(() => {
      if (
        !this.mixing ||
        !this.enabled ||
        generation !== this.mixingGeneration
      ) {
        return;
      }

      this.collisionTimer = null;
      if (this.mixingBallCount <= 1) {
        return;
      }

      try {
        this.playCollision(context);
      } catch {
        // 개별 충돌음 생성 실패는 바람음과 다음 충돌음에 영향을 주지 않는다.
      }

      this.scheduleCollision(context, generation);
    }, delay);
  }

  private playCollision(context: AudioContext): void {
    if (!this.collisionBuffer) {
      return;
    }

    const now = context.currentTime;
    const noiseSource = context.createBufferSource();
    const resonance = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const duration = 0.035 + Math.random() * 0.018;

    noiseSource.buffer = this.collisionBuffer;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1_100 + Math.random() * 1_300, now);
    filter.Q.setValueAtTime(1.8 + Math.random() * 1.4, now);
    resonance.type = "triangle";
    resonance.frequency.setValueAtTime(190 + Math.random() * 150, now);
    gain.gain.setValueAtTime(
      (0.025 + Math.random() * 0.024) * MASTER_VOLUME_MULTIPLIER,
      now,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    noiseSource.connect(filter);
    filter.connect(gain);
    resonance.connect(gain);
    gain.connect(context.destination);
    const collisionNodes: AudioNode[] = [
      noiseSource,
      filter,
      resonance,
      gain,
    ];
    noiseSource.addEventListener(
      "ended",
      () => {
        // 짧은 충돌마다 생성한 그래프를 즉시 끊어 장시간 혼합 시 GC 부담을 줄인다.
        for (const node of collisionNodes) {
          try {
            node.disconnect();
          } catch {
            // context 종료 등으로 이미 정리된 노드는 다시 해제할 필요가 없다.
          }
        }
      },
      { once: true },
    );
    noiseSource.start(now);
    resonance.start(now);
    noiseSource.stop(now + duration);
    resonance.stop(now + duration);
  }
}
