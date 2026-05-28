import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { PLAYABLE_CHARACTERS } from '../../content/characters';
import { rgbCss } from '../character';
import { clamp } from '../math';
import {
  createFloatingHeadPositions,
  resolveHeadCollisions,
  stepFloatingHead,
  type FloatingHeadPosition,
} from './floatingHeadPhysics';

export function FloatingHeads() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ index: number; pointerId: number; lastX: number; lastY: number; lastTime: number } | null>(
    null,
  );
  const positionsRef = useRef<FloatingHeadPosition[]>([]);
  const initialPositions = useMemo(
    () => createFloatingHeadPositions(PLAYABLE_CHARACTERS.length),
    [],
  );
  const [positions, setPositions] = useState(initialPositions);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  useEffect(() => {
    positionsRef.current = initialPositions;
    let frame = 0;
    let lastTime = performance.now();

    function tick(now: number) {
      const bounds = containerRef.current?.getBoundingClientRect();
      const dt = Math.min((now - lastTime) / 1000, 0.04);
      lastTime = now;

      if (bounds) {
        const cardBounds = document.querySelector('.menu-zone')?.getBoundingClientRect() ?? null;
        positionsRef.current = positionsRef.current.map((position, index) =>
          dragRef.current?.index === index ? position : stepFloatingHead(position, bounds, cardBounds, dt),
        );
        positionsRef.current = resolveHeadCollisions(
          positionsRef.current,
          bounds,
          dragRef.current?.index ?? null,
        );
        setPositions([...positionsRef.current]);
      }

      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [initialPositions]);

  function moveHead(index: number, clientX: number, clientY: number) {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const x = clamp(((clientX - bounds.left) / bounds.width) * 100, 7, 93);
    const y = clamp(((clientY - bounds.top) / bounds.height) * 100, 9, 91);
    const drag = dragRef.current;
    const now = performance.now();
    const elapsed = drag ? Math.max((now - drag.lastTime) / 1000, 0.016) : 0.016;
    const nextPosition = positionsRef.current[index] ?? positions[index] ?? initialPositions[index];
    const vx = drag ? (((clientX - drag.lastX) / bounds.width) * 100) / elapsed : nextPosition.vx;
    const vy = drag ? (((clientY - drag.lastY) / bounds.height) * 100) / elapsed : nextPosition.vy;

    positionsRef.current = positionsRef.current.map((position, positionIndex) =>
      positionIndex === index
        ? {
            ...position,
            x,
            y,
            vx: clamp(vx, -34, 34),
            vy: clamp(vy, -34, 34),
          }
        : position,
    );
    setPositions([...positionsRef.current]);

    if (drag) {
      drag.lastX = clientX;
      drag.lastY = clientY;
      drag.lastTime = now;
    }
  }

  return (
    <div ref={containerRef} className="floating-heads" aria-label="Floating character heads">
      {PLAYABLE_CHARACTERS.map((character, index) => {
        const position = positions[index] ?? initialPositions[index];
        return (
          <div
            key={character.id}
            className={`floating-head ${draggingIndex === index ? 'dragging' : ''}`}
            style={
              {
                '--accent': rgbCss(character.color),
                '--delay': `${position.delay}s`,
                '--drift': `${position.drift}px`,
                left: `${position.x}%`,
                top: `${position.y}%`,
                width: `${position.size}px`,
                height: `${position.size}px`,
              } as CSSProperties & Record<string, string>
            }
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              dragRef.current = {
                index,
                pointerId: event.pointerId,
                lastX: event.clientX,
                lastY: event.clientY,
                lastTime: performance.now(),
              };
              setDraggingIndex(index);
              moveHead(index, event.clientX, event.clientY);
            }}
            onPointerMove={(event) => {
              if (dragRef.current?.index !== index || dragRef.current.pointerId !== event.pointerId) return;
              moveHead(index, event.clientX, event.clientY);
            }}
            onPointerUp={(event) => {
              if (dragRef.current?.pointerId === event.pointerId) {
                dragRef.current = null;
                setDraggingIndex(null);
              }
            }}
            onPointerCancel={(event) => {
              if (dragRef.current?.pointerId === event.pointerId) {
                dragRef.current = null;
                setDraggingIndex(null);
              }
            }}
          >
            <span className="floating-head-body">
              <span className="float-ring" />
              <span className="float-ring offset" />
              <span className="float-avatar">
                <img
                  src={`/assets/${character.sprite}`}
                  alt=""
                  draggable={false}
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
                <span>{character.initials}</span>
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
