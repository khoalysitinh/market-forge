import { useEffect, useRef } from 'react';

interface Candle {
  xPct: number;
  open: number;
  close: number;
  high: number;
  low: number;
  width: number;
  isUp: boolean;
  phase: number;
  speed: number;
  // Morphing state
  currX: number;
  currY: number;
  targetX: number;
  targetY: number;
  morphAngle: number;
}

interface Particle {
  x: number;
  y: number;
  radius: number;
  color: string;
  vx: number;
  vy: number;
  alpha: number;
  baseAlpha: number;
  pulseSpeed: number;
  targetX: number;
  targetY: number;
}

interface WavePoint {
  x: number;
  y: number;
}

export function Trading3DBackground({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = container.clientWidth);
    let height = (canvas.height = container.clientHeight);

    // Mouse parallax
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      targetMouseX = x * 35;
      targetMouseY = y * 35;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Resize handling with DPR
    const handleResize = () => {
      if (!container || !canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = container.clientWidth;
      height = container.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Preload logo image and sample outline points
    const logoImg = new Image();
    logoImg.src = '/images/market-forge-emblem.png';
    let logoPoints: { x: number; y: number }[] = [];
    let isLogoLoaded = false;

    logoImg.onload = () => {
      isLogoLoaded = true;
      // Sample points offscreen
      const offCanvas = document.createElement('canvas');
      const offSize = 160;
      offCanvas.width = offSize;
      offCanvas.height = offSize;
      const offCtx = offCanvas.getContext('2d');
      if (offCtx) {
        offCtx.drawImage(logoImg, 0, 0, offSize, offSize);
        const imgData = offCtx.getImageData(0, 0, offSize, offSize).data;
        const pts: { x: number; y: number }[] = [];
        const step = 4;
        for (let y = 0; y < offSize; y += step) {
          for (let x = 0; x < offSize; x += step) {
            const idx = (y * offSize + x) * 4;
            const alpha = imgData[idx + 3] ?? 0;
            if (alpha > 90) {
              pts.push({
                x: (x / offSize) - 0.5,
                y: (y / offSize) - 0.5,
              });
            }
          }
        }
        logoPoints = pts;
      }
    };

    // Helper: calculate wave height with DRAMATIC HIGH & LOW SWINGS (biên độ cao thấp rõ rệt)
    const getWaveY = (x: number, waveTime: number, offset = 0) => {
      const normX = x / width;
      // Biến động giá cực mạnh: có đỉnh cao vút, đáy sâu, rồi sóng tăng mạnh
      const macroCycle =
        Math.sin(normX * Math.PI * 2.8 + offset) * height * 0.24 +
        Math.cos(normX * Math.PI * 1.5 - offset * 0.5) * height * 0.14;

      const baseTrend =
        height * 0.65 -
        macroCycle -
        Math.pow(Math.max(0, normX - 0.3) / 0.7, 2.4) * height * 0.38;

      const fastWaves =
        Math.sin(normX * 9 + waveTime * 1.6) * 14 +
        Math.sin(normX * 18 - waveTime * 1.1) * 7;

      return baseTrend + fastWaves;
    };

    // Helper to generate a candle with high variance in height
    const createCandle = (xPct: number, prevIsUp = false): Candle => {
      const isUp = Math.random() > 0.48 ? !prevIsUp : Math.random() > 0.5;
      // Chiều cao nến biến động mạnh: từ nến ngắn 12px đến nến dài 65px (Marubozu)
      const isBigCandle = Math.random() > 0.65;
      const heightVar = isBigCandle ? (35 + Math.random() * 32) : (12 + Math.random() * 18);

      return {
        xPct,
        open: 0,
        close: heightVar * (isUp ? -1 : 1),
        high: heightVar * (1.2 + Math.random() * 0.7),
        low: -heightVar * (0.4 + Math.random() * 0.5),
        width: Math.max(6, Math.min(12, width * 0.0075)),
        isUp,
        phase: Math.random() * Math.PI * 2,
        speed: 1.2 + Math.random() * 0.8,
        currX: xPct * width,
        currY: height * 0.5,
        targetX: 0,
        targetY: 0,
        morphAngle: (Math.random() - 0.5) * Math.PI * 4,
      };
    };

    // 1. Initialize Candlesticks
    const candleCount = 52;
    const minXPct = 0.28;
    const maxXPct = 1.02;
    const stepPct = (maxXPct - minXPct) / candleCount;

    const candles: Candle[] = [];
    let lastUp = false;
    for (let i = 0; i < candleCount; i++) {
      const xPct = minXPct + i * stepPct;
      const c = createCandle(xPct, lastUp);
      lastUp = c.isUp;
      candles.push(c);
    }

    // 2. Volume bars at bottom
    const volumeBars: { xPct: number; height: number; isUp: boolean; phase: number }[] = [];
    for (let i = 0; i < 40; i++) {
      const xPct = 0.36 + (i / 40) * 0.64;
      volumeBars.push({
        xPct,
        height: 10 + Math.random() * 32 + (i % 3 === 0 ? 18 : 0),
        isUp: Math.random() > 0.45,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // 3. Floating particles (will also assemble into logo aura)
    const particles: Particle[] = [];
    for (let i = 0; i < 90; i++) {
      const isCyan = Math.random() > 0.35;
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 2.2 + 1,
        color: isCyan ? '#a7ebf2' : '#ffffff',
        vx: -0.4 - Math.random() * 0.4,
        vy: -0.2 - Math.random() * 0.3,
        alpha: Math.random() * 0.6 + 0.2,
        baseAlpha: Math.random() * 0.5 + 0.3,
        pulseSpeed: Math.random() * 0.03 + 0.01,
        targetX: 0,
        targetY: 0,
      });
    }

    // State machine for Morph cycle:
    // 0: RUNNING (0s - 4.5s)
    // 1: MORPHING TO LOGO (4.5s - 7.0s)
    // 2: LOGO HOLD & GLOW (7.0s - 11.5s)
    // 3: DISPERSING BACK (11.5s - 13.0s)
    const CYCLE_DURATION = 13.0;
    let cycleTime = 0;
    let time = 0;
    const streamSpeed = 0.00038;

    // Cubic easing
    const easeInOutCubic = (t: number) => {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };

    // Render Loop
    const render = () => {
      time += 0.02;
      cycleTime = (cycleTime + 0.016) % CYCLE_DURATION;

      // Parallax interpolation
      currentMouseX += (targetMouseX - currentMouseX) * 0.05;
      currentMouseY += (targetMouseY - currentMouseY) * 0.05;

      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(currentMouseX, currentMouseY);

      // Logo center & size on the right side
      const logoCenterX = width * 0.72;
      const logoCenterY = height * 0.48;
      const logoSize = Math.min(width * 0.42, height * 0.62, 380);

      // Determine phase
      let morphT = 0; // 0: fully running chart, 1: fully assembled logo
      let logoAlpha = 0;

      if (cycleTime < 4.5) {
        // Phase 0: Normal running candlesticks with high-low drama
        morphT = 0;
        logoAlpha = 0;
      } else if (cycleTime < 7.0) {
        // Phase 1: Morphing into logo
        const p = (cycleTime - 4.5) / 2.5;
        morphT = easeInOutCubic(p);
        logoAlpha = morphT * 0.95;
      } else if (cycleTime < 11.5) {
        // Phase 2: Logo Hold with majestic neon glow
        morphT = 1;
        logoAlpha = 0.95;
      } else {
        // Phase 3: Dispersing back into candlestick flow
        const p = (cycleTime - 11.5) / 1.5;
        morphT = 1 - easeInOutCubic(p);
        logoAlpha = morphT * 0.95;
      }

      // --- LAYER 0: Ambient Backlight Glow ---
      const glowIntensity = 0.18 + morphT * 0.15;
      const cyanGlow = ctx.createRadialGradient(
        logoCenterX,
        logoCenterY,
        20,
        logoCenterX,
        logoCenterY,
        width * 0.45
      );
      cyanGlow.addColorStop(0, `rgba(167, 235, 242, ${glowIntensity})`);
      cyanGlow.addColorStop(0.5, `rgba(56, 189, 248, ${glowIntensity * 0.6})`);
      cyanGlow.addColorStop(1, 'rgba(1, 28, 64, 0)');
      ctx.fillStyle = cyanGlow;
      ctx.fillRect(0, 0, width, height);

      // --- LAYER 1: Subtle Cyber Grid ---
      ctx.strokeStyle = `rgba(167, 235, 242, ${0.06 * (1 - morphT * 0.5)})`;
      ctx.lineWidth = 1;

      const gridSpacingY = 70;
      for (let y = gridSpacingY; y < height; y += gridSpacingY) {
        ctx.beginPath();
        ctx.moveTo(width * 0.25, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const gridSpacingX = 85;
      for (let x = width * 0.3; x < width; x += gridSpacingX) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // --- LAYER 2: Volume Bars (fade down slightly when morphing to logo) ---
      const volBaseY = height * 0.88;
      const volAlpha = Math.max(0.15, 1 - morphT);
      volumeBars.forEach((vb) => {
        vb.xPct -= streamSpeed * 0.85;
        if (vb.xPct < 0.32) {
          vb.xPct = 1.0;
          vb.isUp = Math.random() > 0.45;
          vb.height = 10 + Math.random() * 32;
        }

        const x = vb.xPct * width;
        const breath = Math.sin(time * 2 + vb.phase) * 3;
        const barH = Math.max(4, vb.height + breath);

        ctx.save();
        ctx.globalAlpha = volAlpha;
        if (vb.isUp) {
          ctx.fillStyle = '#011c40';
          ctx.strokeStyle = 'rgba(167, 235, 242, 0.6)';
          ctx.lineWidth = 1;
          ctx.fillRect(x - 2, volBaseY - barH, 4, barH);
          ctx.strokeRect(x - 2, volBaseY - barH, 4, barH);
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x - 2, volBaseY - barH, 4, barH);
        }
        ctx.restore();
      });

      // --- LAYER 3: Flowing Wave Ribbons ---
      const drawNeonWave = (
        waveOffset: number,
        colorHex: string,
        blurVal: number,
        lineWidth: number,
        alpha: number
      ) => {
        ctx.save();
        ctx.shadowColor = colorHex;
        ctx.shadowBlur = blurVal;
        ctx.strokeStyle = colorHex;
        ctx.lineWidth = lineWidth;
        ctx.globalAlpha = alpha * Math.max(0.2, 1 - morphT * 0.7);

        ctx.beginPath();
        const startX = width * 0.22;
        const points: WavePoint[] = [];

        for (let x = startX; x <= width + 20; x += 14) {
          const y = getWaveY(x, time, waveOffset);
          points.push({ x, y });
        }

        if (points.length > 1) {
          const firstPoint = points[0];
          const lastPoint = points[points.length - 1];
          if (firstPoint && lastPoint) {
            ctx.moveTo(firstPoint.x, firstPoint.y);
            for (let i = 1; i < points.length - 1; i++) {
              const pCurr = points[i];
              const pNext = points[i + 1];
              if (pCurr && pNext) {
                const xc = (pCurr.x + pNext.x) / 2;
                const yc = (pCurr.y + pNext.y) / 2;
                ctx.quadraticCurveTo(pCurr.x, pCurr.y, xc, yc);
              }
            }
            ctx.lineTo(lastPoint.x, lastPoint.y);
            ctx.stroke();
          }
        }

        ctx.restore();
      };

      drawNeonWave(0.35, 'rgba(56, 189, 248, 0.5)', 18, 2, 0.6);
      drawNeonWave(0.0, '#a7ebf2', 26, 3.2, 0.95);
      drawNeonWave(0.0, '#ffffff', 8, 1.2, 0.85);

      // --- LAYER 4: ACTIVE CANDLESTICKS & MORPHING TO LOGO ---
      let highestX = 0;
      let leadingCandle: Candle | null = null;

      candles.forEach((c, idx) => {
        // Continuous horizontal scroll
        c.xPct -= streamSpeed;
        if (c.xPct < minXPct) {
          c.xPct = maxXPct;
          const fresh = createCandle(maxXPct, Math.random() > 0.5);
          c.isUp = fresh.isUp;
          c.close = fresh.close;
          c.high = fresh.high;
          c.low = fresh.low;
        }

        if (c.xPct > highestX) {
          highestX = c.xPct;
          leadingCandle = c;
        }

        // Standard Chart Position
        const chartX = c.xPct * width;
        const baseY = getWaveY(chartX, time, 0.0);
        const breath = Math.sin(time * c.speed + c.phase) * 3;
        const chartY = baseY + breath;

        // Target Logo Position
        let targetX = chartX;
        let targetY = chartY;
        if (logoPoints.length > 0) {
          const pt = logoPoints[(idx * 17) % logoPoints.length];
          if (pt) {
            targetX = logoCenterX + pt.x * logoSize;
            targetY = logoCenterY + pt.y * logoSize;
          }
        }

        // Swirling vortex trajectory during morph
        const swirlAngle = c.morphAngle * Math.sin(morphT * Math.PI);
        const swirlRadius = Math.sin(morphT * Math.PI) * 45;
        const swirlOffsetX = Math.cos(swirlAngle) * swirlRadius;
        const swirlOffsetY = Math.sin(swirlAngle) * swirlRadius;

        // Current interpolated position
        const currentX = chartX + (targetX - chartX) * morphT + swirlOffsetX;
        const currentY = chartY + (targetY - chartY) * morphT + swirlOffsetY;

        // Scale & Rotation
        const candleScale = 1 - morphT * 0.45;
        const bodyH = Math.max(8, Math.abs(c.close)) * candleScale;
        const bodyW = c.width * candleScale;
        const bodyTop = currentY - bodyH / 2;

        ctx.save();

        if (c.isUp) {
          // ==========================================
          // NẾN TĂNG: MÀU #011C40 VIỀN CYAN SẮC NÉT
          // ==========================================
          ctx.shadowColor = 'rgba(167, 235, 242, 0.7)';
          ctx.shadowBlur = 10;

          // Wick
          ctx.strokeStyle = '#a7ebf2';
          ctx.lineWidth = 1.6 * candleScale;
          ctx.beginPath();
          ctx.moveTo(currentX, currentY - c.high * candleScale);
          ctx.lineTo(currentX, currentY + Math.abs(c.low) * candleScale);
          ctx.stroke();

          // Body: #011C40
          ctx.fillStyle = '#011c40';
          ctx.fillRect(currentX - bodyW / 2, bodyTop, bodyW, bodyH);

          // Outline: #a7ebf2
          ctx.strokeStyle = '#a7ebf2';
          ctx.lineWidth = 1.8;
          ctx.strokeRect(currentX - bodyW / 2, bodyTop, bodyW, bodyH);

          // Center shine
          ctx.fillStyle = 'rgba(167, 235, 242, 0.5)';
          ctx.fillRect(currentX - 0.75, bodyTop + 2, 1.5, Math.max(1, bodyH - 4));
        } else {
          // ==========================================
          // NẾN GIẢM: MÀU TRẮNG PHÁT QUANG RỰC RỠ
          // ==========================================
          ctx.shadowColor = 'rgba(255, 255, 255, 0.85)';
          ctx.shadowBlur = 15;

          // Wick
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.6 * candleScale;
          ctx.beginPath();
          ctx.moveTo(currentX, currentY - c.high * candleScale);
          ctx.lineTo(currentX, currentY + Math.abs(c.low) * candleScale);
          ctx.stroke();

          // Body: #ffffff
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(currentX - bodyW / 2, bodyTop, bodyW, bodyH);
        }

        ctx.restore();
      });

      // --- LIVE LEADING TICKER (only active during running chart phase) ---
      if (leadingCandle && morphT < 0.2) {
        const lead: Candle = leadingCandle;
        const leadX = lead.xPct * width;
        const leadBaseY = getWaveY(leadX, time, 0.0);
        const liveTick = Math.sin(time * 6) * 5;
        const liveY = leadBaseY + liveTick;

        ctx.save();
        ctx.strokeStyle = lead.isUp ? '#a7ebf2' : '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(leadX, liveY);
        ctx.lineTo(width, liveY);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.shadowColor = lead.isUp ? '#a7ebf2' : '#ffffff';
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(leadX, liveY, 3.5, 0, Math.PI * 2);
        ctx.fill();

        const ringR = 6 + Math.abs(Math.sin(time * 4)) * 5;
        ctx.strokeStyle = lead.isUp ? 'rgba(167, 235, 242, 0.6)' : 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(leadX, liveY, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // --- LAYER 5: LOGO REVEAL & 3D FLOATING BREATH ---
      if (isLogoLoaded && logoAlpha > 0.02) {
        ctx.save();
        // Floating 3D breath when assembled
        const floatY = Math.sin(time * 2) * 8;
        const floatScale = 1 + Math.sin(time * 1.5) * 0.02;

        const drawW = logoSize * floatScale;
        const drawH = logoSize * floatScale;
        const drawX = logoCenterX - drawW / 2;
        const drawY = logoCenterY - drawH / 2 + floatY;

        ctx.globalAlpha = logoAlpha;
        ctx.shadowColor = 'rgba(167, 235, 242, 0.9)';
        ctx.shadowBlur = 35;

        // Draw glowing logo emblem
        ctx.drawImage(logoImg, drawX, drawY, drawW, drawH);

        // Highlight ring around the assembled logo
        const pulseRingR = (logoSize / 2) * 1.08 + Math.sin(time * 3) * 6;
        ctx.strokeStyle = 'rgba(167, 235, 242, 0.4)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(logoCenterX, logoCenterY + floatY, pulseRingR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      }

      // --- LAYER 6: Ambient Glowing Particles / Orbiters ---
      particles.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha += Math.sin(time * 3 + p.x) * p.pulseSpeed;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        let renderX = p.x;
        let renderY = p.y;

        // When morphing, particles orbit around the logo
        if (morphT > 0.05) {
          const orbitAngle = time * 1.2 + idx * 0.4;
          const orbitR = (logoSize * 0.55) + Math.sin(time * 3 + idx) * 30;
          const targetOrbX = logoCenterX + Math.cos(orbitAngle) * orbitR;
          const targetOrbY = logoCenterY + Math.sin(orbitAngle) * orbitR;
          renderX = p.x + (targetOrbX - p.x) * morphT;
          renderY = p.y + (targetOrbY - p.y) * morphT;
        }

        ctx.save();
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0.1, Math.min(0.85, p.alpha));
        ctx.beginPath();
        ctx.arc(renderX, renderY, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      ctx.restore(); // Restore 3D tilt

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div ref={containerRef} className={`absolute inset-0 -z-20 overflow-hidden bg-[#011c40] ${className}`}>
      {/* 1. Underlying subtle original image texture */}
      <img
        src="/images/bannerhero.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full object-cover object-[64%_center] opacity-20 mix-blend-screen"
      />

      {/* 2. Live 60FPS High-Variance Candlesticks, Morphing into Logo & 3D Interactive Parallax */}
      <canvas ref={canvasRef} className="absolute inset-0 size-full pointer-events-none" />

      {/* 3. Deep Vignette edges to naturally integrate into dark blue app shell */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#011c40] via-[#011c40]/70 to-transparent sm:w-2/3"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#011c40] via-transparent to-[#011c40]/40"
      />
    </div>
  );
}
