import { useState, useEffect, useCallback, useRef } from "react";

interface Character {
  char: string;
  x: number;
  y: number;
  speed: number;
  size: number;
}

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ΨΩΔΣΦΠλμ∞∂∫≈≠±";
const CHAR_COUNT = 120;

const RainingLetters = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const charsRef = useRef<Character[]>([]);
  const activeRef = useRef<Set<number>>(new Set());

  const initChars = useCallback(() => {
    const chars: Character[] = [];
    for (let i = 0; i < CHAR_COUNT; i++) {
      chars.push({
        char: CHARS[Math.floor(Math.random() * CHARS.length)],
        x: Math.random(),
        y: Math.random(),
        speed: 0.0003 + Math.random() * 0.0008,
        size: 12 + Math.floor(Math.random() * 10),
      });
    }
    charsRef.current = chars;
  }, []);

  useEffect(() => {
    initChars();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let flickerTimer = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      flickerTimer++;
      if (flickerTimer % 5 === 0) {
        const newActive = new Set<number>();
        const count = 4 + Math.floor(Math.random() * 6);
        for (let i = 0; i < count; i++) {
          newActive.add(Math.floor(Math.random() * CHAR_COUNT));
        }
        activeRef.current = newActive;
      }

      const chars = charsRef.current;
      for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        c.y += c.speed;
        if (c.y > 1.05) {
          c.y = -0.05;
          c.x = Math.random();
          c.char = CHARS[Math.floor(Math.random() * CHARS.length)];
        }

        const isActive = activeRef.current.has(i);
        const alpha = isActive ? 0.3 : 0.1;

        ctx.font = `${c.size}px "JetBrains Mono", monospace`;
        ctx.fillStyle = `rgba(107, 114, 128, ${alpha})`;
        ctx.fillText(c.char, c.x * rect.width, c.y * rect.height);
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [initChars]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none select-none z-0"
    />
  );
};

export default RainingLetters;
