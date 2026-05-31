import { useEffect, useRef } from 'react';
import { AudioManager } from '../../audio/AudioManager';

const BAR_COUNT = 64;
const BAR_WIDTH = 5;
const BAR_GAP = 3;

export function MenuWaveform() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    let mounted = true;

    async function setup() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const audio = AudioManager.getInstance();
      const analyser = await audio.connectMusicAnalyser();
      if (!mounted) return;

      const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
      const totalWidth = BAR_COUNT * (BAR_WIDTH + BAR_GAP);

      function resize() {
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      resize();
      window.addEventListener('resize', resize);

      function draw() {
        if (!canvas || !ctx || !mounted) return;
        const rect = canvas.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        const time = performance.now() / 1000;

        let hasAudioData = false;
        if (analyser && dataArray) {
          analyser.getByteFrequencyData(dataArray);
          // check if any data is non-zero
          for (let i = 0; i < dataArray.length; i++) {
            if (dataArray[i] > 2) {
              hasAudioData = true;
              break;
            }
          }
        }

        ctx.clearRect(0, 0, w, h);

        const cx = w / 2;
        const step = totalWidth / BAR_COUNT;
        const halfBars = Math.floor(BAR_COUNT / 2);

        for (let i = 0; i < halfBars; i++) {
          let norm: number;

          if (hasAudioData && dataArray) {
            const dataIndex = Math.floor((i / halfBars) * (dataArray.length / 2));
            const value = dataArray[dataIndex] ?? 0;
            norm = value / 255;
          } else {
            // gentle idle pulse — multiple sine waves for organic feel
            const t = time * 1.5;
            const dist = i / halfBars;
            norm =
              Math.sin(t + dist * 4) * 0.25 +
              Math.sin(t * 0.7 + dist * 7 + 1) * 0.2 +
              Math.sin(t * 0.4 + dist * 2 + 3) * 0.15 +
              0.25; // baseline
            norm = Math.max(0, Math.min(1, norm));
          }

          const barH = norm * h * 0.85 + 3;
          const xLeft = cx - (i + 1) * step;
          const xRight = cx + i * step;
          const y = (h - barH) / 2;

          const alpha = 0.14 + norm * 0.42;
          const glowAlpha = 0.1 + norm * 0.3;

          ctx.shadowBlur = 10 + norm * 18;
          ctx.shadowColor = `rgba(70, 233, 255, ${glowAlpha})`;

          ctx.fillStyle = `rgba(70, 233, 255, ${alpha})`;
          ctx.beginPath();
          ctx.roundRect(xLeft, y, BAR_WIDTH, barH, BAR_WIDTH / 2);
          ctx.fill();

          ctx.beginPath();
          ctx.roundRect(xRight, y, BAR_WIDTH, barH, BAR_WIDTH / 2);
          ctx.fill();
        }

        ctx.shadowBlur = 0;
        rafRef.current = requestAnimationFrame(draw);
      }

      rafRef.current = requestAnimationFrame(draw);

      return () => {
        mounted = false;
        cancelAnimationFrame(rafRef.current);
        window.removeEventListener('resize', resize);
        try {
          analyser?.disconnect();
        } catch {
          // ignore
        }
      };
    }

    void setup();

    return () => {
      mounted = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="menu-waveform"
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: '-40% -15%',
        width: '130%',
        height: '180%',
        pointerEvents: 'none',
        zIndex: -1,
      }}
    />
  );
}
