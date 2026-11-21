import { useEffect, useRef } from 'react';

type Candle = {
  x: number;
  progress: number;
  life: number;
  speed: number;
  wave: number;
  phase: number;
  width: number;
  bodyHeight: number;
  wickHeight: number;
  depth: number;
  color: string;
};

type Particle = {
  x: number;
  progress: number;
  life: number;
  speed: number;
  wave: number;
  phase: number;
  radius: number;
  depth: number;
  color: string;
};

const BLUE = '#007BA7';
const PINK = '#FF2D95';
const CANDLE_COUNT = 42;
const PARTICLE_COUNT = 96;

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function makeCandle(width: number, initial = false): Candle {
  const depth = Math.random();
  return {
    x: randomBetween(width * 0.08, width * 0.92),
    progress: initial ? Math.random() * 0.62 : 0,
    life: randomBetween(4.8, 7.4),
    speed: randomBetween(0.84, 1.16),
    wave: randomBetween(5, 24) * (0.45 + depth),
    phase: randomBetween(0, Math.PI * 2),
    width: 2 + depth * 7,
    bodyHeight: 8 + depth * 22,
    wickHeight: 8 + depth * 24,
    depth,
    color: Math.random() > 0.5 ? BLUE : PINK,
  };
}

function makeParticle(width: number, initial = false): Particle {
  const depth = Math.random();
  return {
    x: randomBetween(width * 0.05, width * 0.95),
    progress: initial ? Math.random() * 0.68 : 0,
    life: randomBetween(2.6, 4.6),
    speed: randomBetween(0.8, 1.25),
    wave: randomBetween(8, 42) * (0.4 + depth),
    phase: randomBetween(0, Math.PI * 2),
    radius: 0.7 + depth * 1.9,
    depth,
    color: Math.random() > 0.55 ? BLUE : PINK,
  };
}

function withAlpha(hex: string, alpha: number) {
  const value = hex.slice(1);
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function MarketSignalCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { alpha: true });
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    let frameId = 0;
    let previousTime = 0;
    let candles: Candle[] = [];
    let particles: Particle[] = [];
    const motionScale = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.45 : 1;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context!.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      candles = Array.from({ length: CANDLE_COUNT }, () => makeCandle(width, true));
      particles = Array.from({ length: PARTICLE_COUNT }, () => makeParticle(width, true));
      previousTime = 0;
    }

    function draw(timestamp: number) {
      const deltaSeconds = previousTime ? Math.min((timestamp - previousTime) / 1000, 0.034) * motionScale : 0;
      previousTime = timestamp;
      context!.clearRect(0, 0, width, height);
      context!.shadowBlur = 0;
      context!.shadowColor = 'transparent';

      for (let index = candles.length - 1; index >= 0; index -= 1) {
        const candle = candles[index];
        if (!candle) continue;
        candle.progress += (deltaSeconds * candle.speed) / candle.life;
        if (candle.progress >= 0.82) {
          candles[index] = makeCandle(width);
          continue;
        }

        const progress = candle.progress;
        const fade = Math.min(1, Math.max(0, (0.82 - progress) / 0.24));
        const y = height * (1 - progress * 0.76);
        const sway = Math.sin(progress * 8 + candle.phase) * candle.wave;
        const x = candle.x + sway;
        const depthOpacity = 0.26 + candle.depth * 0.58;
        const alpha = fade * depthOpacity;

        context!.save();
        context!.globalAlpha = alpha;
        context!.strokeStyle = withAlpha(candle.color, 0.82);
        context!.lineWidth = Math.max(1, candle.depth * 1.5);
        context!.beginPath();
        context!.moveTo(x, y - candle.wickHeight / 2);
        context!.lineTo(x, y + candle.wickHeight / 2);
        context!.stroke();

        context!.fillStyle = withAlpha(candle.color, candle.color === BLUE ? 0.42 : 0.6);
        context!.fillRect(x - candle.width / 2, y - candle.bodyHeight / 2, candle.width, candle.bodyHeight);
        context!.restore();
      }

      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        if (!particle) continue;
        particle.progress += (deltaSeconds * particle.speed) / particle.life;
        if (particle.progress >= 0.82) {
          particles[index] = makeParticle(width);
          continue;
        }

        const fade = Math.min(1, Math.max(0, (0.82 - particle.progress) / 0.28));
        const y = height * (1 - particle.progress * 0.78);
        const x = particle.x + Math.sin(particle.progress * 10 + particle.phase) * particle.wave;
        context!.save();
        context!.globalAlpha = fade * (0.28 + particle.depth * 0.68);
        context!.strokeStyle = withAlpha(particle.color, 0.72);
        context!.lineWidth = Math.max(0.6, particle.radius * 0.65);
        context!.beginPath();
        context!.moveTo(x, y + particle.radius * 2.5);
        context!.lineTo(x, y);
        context!.stroke();
        context!.beginPath();
        context!.fillStyle = withAlpha(particle.color, 0.8);
        context!.shadowColor = withAlpha(particle.color, 0.7);
        context!.shadowBlur = 2 + particle.depth * 5;
        context!.arc(x, y, particle.radius, 0, Math.PI * 2);
        context!.fill();
        context!.restore();
      }

      frameId = window.requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });
    frameId = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 size-full" />;
}
