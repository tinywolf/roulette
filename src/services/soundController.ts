export type SoundEvent = "mix" | "draw" | "complete";

type BrowserWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

export class SoundController {
  private context: AudioContext | null = null;

  private enabled = false;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  async play(event: SoundEvent): Promise<void> {
    if (!this.enabled || typeof window === "undefined") {
      return;
    }

    try {
      const browserWindow = window as BrowserWindow;
      const AudioContextConstructor =
        browserWindow.AudioContext ?? browserWindow.webkitAudioContext;

      if (!AudioContextConstructor) {
        return;
      }

      this.context ??= new AudioContextConstructor();

      if (this.context.state === "suspended") {
        await this.context.resume();
      }

      const now = this.context.currentTime;
      const tones =
        event === "mix"
          ? [
              { frequency: 150, offset: 0, duration: 0.08 },
              { frequency: 210, offset: 0.06, duration: 0.08 },
            ]
          : event === "complete"
            ? [
                { frequency: 523, offset: 0, duration: 0.12 },
                { frequency: 659, offset: 0.12, duration: 0.12 },
                { frequency: 784, offset: 0.24, duration: 0.2 },
              ]
            : [{ frequency: 660, offset: 0, duration: 0.16 }];

      for (const tone of tones) {
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        const start = now + tone.offset;
        const end = start + tone.duration;

        oscillator.type = event === "mix" ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(tone.frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.13, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        oscillator.connect(gain);
        gain.connect(this.context.destination);
        oscillator.start(start);
        oscillator.stop(end + 0.02);
      }
    } catch {
      // 음향은 보조 기능이므로 실패해도 추첨 흐름을 유지한다.
    }
  }

  dispose(): void {
    void this.context?.close().catch(() => undefined);
    this.context = null;
  }
}
