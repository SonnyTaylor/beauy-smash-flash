import { useEffect, useRef } from 'react';
import { AudioManager } from '../../audio/AudioManager';

const BAR_COUNT = 48;
const BAR_WIDTH = 4;
const BAR_GAP = 2;

export function MenuWaveform() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const audio = AudioManager.getInstance();
    const analyser = audio.connectMusicAnalyser();
    if (!analyser) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const totalWidth = BAR_COUNT * (BAR_WIDTH + BAR_GAP);

    function resize() {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx!.scale(dpr, dpr);
    }

    resize();
    window.addEventListener('resize', resize);

    function draw() {
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      analyser!.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const step = totalWidth / BAR_COUNT;

      for (let i = 0; i < BAR_COUNT; i++) {
        const dataIndex = Math.floor((i / BAR_COUNT) * (dataArray.length / 2));
        const value = dataArray[dataIndex] ?? 0;
        const norm = value / 255;
        const barH = norm * h * 0.9;

        const x = cx - totalWidth / 2 + i * step;
        const y = (h - barH) / 2;

        const alpha = 0.06 + norm * 0.18;
        ctx.fillStyle = `rgba(70, 233, 255, ${alpha})`;
        ctx.beginPath();
        ctx.roundRect(x, y, BAR_WIDTH, barH, BAR_WIDTH / 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      try {
        analyser.disconnect();
      } catch {
        // ignore
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="menu-waveform"
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: -1,
      }}
    />
  );
}
