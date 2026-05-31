import { useEffect, useRef, useState } from 'react';
import { AudioManager } from '../../audio/AudioManager';

const BAR_COUNT = 64;
const BAR_WIDTH = 5;
const BAR_GAP = 3;

export function MenuWaveform() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function setup() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const audio = AudioManager.getInstance();
      const analyser = await audio.getMusicAnalyser();
      if (!mounted || !analyser) return;
      const analyserNode = analyser;

      setReady(true);

      const freqData = new Uint8Array(analyserNode.frequencyBinCount);
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

        analyserNode.getByteFrequencyData(freqData);

        let freqMax = 0;
        for (let i = 0; i < freqData.length; i++) {
          if (freqData[i] > freqMax) freqMax = freqData[i];
        }

        ctx.clearRect(0, 0, w, h);

        const cx = w / 2;
        const step = totalWidth / BAR_COUNT;
        const halfBars = Math.floor(BAR_COUNT / 2);

        for (let i = 0; i < halfBars; i++) {
          // Sample frequency bins
          const binStart = Math.floor((i / halfBars) * (freqData.length * 0.7));
          const binEnd = Math.floor(((i + 1) / halfBars) * (freqData.length * 0.7));
          let peak = 0;
          for (let b = binStart; b < binEnd; b++) {
            const val = (freqData[b] ?? 0) / 255;
            if (val > peak) peak = val;
          }

          // Idle pulse when no audio, otherwise real data
          const hasAudio = freqMax > 1;
          let norm: number;
          if (hasAudio) {
            norm = peak;
          } else {
            const t = performance.now() / 1000 * 1.2;
            const dist = i / halfBars;
            norm =
              Math.sin(t + dist * 4) * 0.18 +
              Math.sin(t * 0.7 + dist * 7 + 1) * 0.14 +
              Math.sin(t * 0.4 + dist * 2 + 3) * 0.1 +
              0.18;
            norm = Math.max(0, Math.min(1, norm));
          }

          const barH = norm * h * 0.55 + 3;
          const xLeft = cx - (i + 1) * step;
          const xRight = cx + i * step;
          const y = (h - barH) / 2;

          const alpha = 0.12 + norm * 0.35;
          const glowAlpha = 0.08 + norm * 0.2;

          ctx.shadowBlur = 8 + norm * 12;
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
        window.removeEventListener('resize', resize);
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
        opacity: ready ? 1 : 0,
        transition: 'opacity 600ms ease',
      }}
    />
  );
}
