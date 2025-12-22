"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

export type CircuitCard = {
  id: number;
  title: string;
  body: string;
  variant?: "default" | "highlight";
};

type Point = { x: number; y: number };
type Anchor = { top: Point; bottom: Point };

type Connector = {
  id: string;
  fromIndex: number;
  toIndex: number;
  start: Point;
  end: Point;
  path: string;
};

type PulseEvent = {
  id: string;
  connectorId: string;
  createdAt: number;
};

const DESKTOP_OFFSETS = [-220, -140, -60, 0, 60, 140, 220];
const MOBILE_OFFSETS = [-24, 0, 24];
const LCG = (seed: number) => () => {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const computeOffsets = (count: number, compact: boolean) => {
  const offsetPool = compact ? MOBILE_OFFSETS : DESKTOP_OFFSETS;
  const random = LCG(19);
  let last = Number.NaN;
  let prev = Number.NaN;
  const offsets: number[] = [];

  for (let index = 0; index < count; index += 1) {
    let attempt = 0;
    let candidate = offsetPool[Math.floor(random() * offsetPool.length)];
    while ((candidate === last || candidate === prev) && attempt < 12) {
      candidate = offsetPool[Math.floor(random() * offsetPool.length)];
      attempt += 1;
    }
    offsets.push(candidate);
    prev = last;
    last = candidate;
  }

  return offsets;
};

const buildCurve = (start: Point, end: Point) => {
  const verticalGap = Math.max(60, end.y - start.y);
  const midY = start.y + verticalGap * 0.55;
  const deltaX = end.x - start.x;
  const bend = clamp(Math.abs(deltaX) * 0.18 + 18, 16, 68);
  const radius = Math.min(bend, Math.abs(deltaX) / 2);
  const sign = deltaX >= 0 ? 1 : -1;

  const preBendY = midY - radius;
  const postBendY = midY + radius;

  return [
    `M ${start.x} ${start.y}`,
    `L ${start.x} ${preBendY}`,
    `Q ${start.x} ${midY}, ${start.x + radius * sign} ${midY}`,
    `L ${end.x - radius * sign} ${midY}`,
    `Q ${end.x} ${midY}, ${end.x} ${postBendY}`,
    `L ${end.x} ${end.y}`,
  ].join(" ");
};

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  return reduced;
};

type CircuitTimelineProps = {
  cards: CircuitCard[];
};

export default function CircuitTimeline({ cards }: CircuitTimelineProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [anchors, setAnchors] = useState<Array<Anchor | null>>([]);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoverActiveIndex, setHoverActiveIndex] = useState<number | null>(null);
  const [pulseEvents, setPulseEvents] = useState<PulseEvent[]>([]);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isCompact, setIsCompact] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth < 780 : false,
  );

  const offsets = useMemo(() => computeOffsets(cards.length, isCompact), [cards.length, isCompact]);

  const connectors = useMemo<Connector[]>(() => {
    const segments: Connector[] = [];
    for (let index = 0; index < anchors.length - 1; index += 1) {
      const from = anchors[index];
      const to = anchors[index + 1];
      if (!from || !to) continue;
      const start = from.bottom;
      const end = to.top;
      segments.push({
        id: `${index}-${index + 1}`,
        fromIndex: index,
        toIndex: index + 1,
        start,
        end,
        path: buildCurve(start, end),
      });
    }
    return segments;
  }, [anchors]);

  const updateAnchors = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const nextAnchors: Array<Anchor | null> = cardRefs.current.map((card) => {
      if (!card) return null;
      const rect = card.getBoundingClientRect();
      const xCenter = rect.left - containerRect.left + rect.width / 2;
      return {
        top: { x: xCenter, y: rect.top - containerRect.top },
        bottom: { x: xCenter, y: rect.bottom - containerRect.top },
      };
    });
    setAnchors(nextAnchors);
    setContainerSize({ width: containerRect.width, height: container.scrollHeight || containerRect.height });
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver(() => updateAnchors());
    cardRefs.current.forEach((card) => card && observer.observe(card));
    if (containerRef.current) observer.observe(containerRef.current);
    updateAnchors();

    const handleResize = () => {
      setIsCompact(window.innerWidth < 780);
      updateAnchors();
    };

    window.addEventListener("resize", handleResize);
    window.setTimeout(updateAnchors, 120);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [cards.length, updateAnchors]);

  useEffect(() => {
    let rafId: number | null = null;
    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        const targetLine = window.innerHeight * 0.2;
        let closestIndex = 0;
        let closestDistance = Number.POSITIVE_INFINITY;
        cardRefs.current.forEach((card, index) => {
          if (!card) return;
          const rect = card.getBoundingClientRect();
          const distance = Math.abs(rect.top - targetLine);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = index;
          }
        });
        setActiveIndex(closestIndex);
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    handleScroll();

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [cards.length]);

  useEffect(() => {
    if (prefersReducedMotion || connectors.length === 0) return;
    let cancelled = false;
    let timeoutId: number;
    let current = 0;
    const tick = () => {
      timeoutId = window.setTimeout(() => {
        setPulseEvents((events) => {
          const now = performance.now();
          const pruned = events.filter((event) => now - event.createdAt < 1600);
          const connector = connectors[current];
          current = (current + 1) % connectors.length;
          if (!connector) return pruned;
          return [...pruned, { id: `${connector.id}-${now}`, connectorId: connector.id, createdAt: now }];
        });
        if (!cancelled) tick();
      }, 1400);
    };
    tick();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [connectors, prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const cleanup = window.setInterval(() => {
      const now = performance.now();
      setPulseEvents((events) => events.filter((event) => now - event.createdAt < 1600));
    }, 900);
    return () => window.clearInterval(cleanup);
  }, [prefersReducedMotion]);

  const displayActiveIndex = hoverActiveIndex ?? activeIndex;

  const handleHover = (index: number | null) => {
    setHoverActiveIndex(index);
  };

  return (
    <div className="circuit-wrap" ref={containerRef} data-reduced-motion={prefersReducedMotion ? "true" : "false"}>
      <svg
        className="circuit-svg"
        width={containerSize.width || "100%"}
        height={containerSize.height || "100%"}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="circuitGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--circuit)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--circuitGlow)" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="circuitSoft" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--circuitDim)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="var(--circuit)" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="circuitFlowGradient" x1="0%" y1="0%" x2="100%" y2="0%" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0aa8ff" stopOpacity="0.95" />
            <stop offset="20%" stopColor="#5a5dff" stopOpacity="0.95" />
            <stop offset="40%" stopColor="#0aa8ff" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#5f4dff" stopOpacity="0.95" />
            <stop offset="80%" stopColor="#1f8dff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#0aa8ff" stopOpacity="0.95" />
          </linearGradient>
          <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {connectors.map((connector, index) => {
      const isPast = index < displayActiveIndex - 1;
      const isNext = connector.toIndex === displayActiveIndex;
      const strokeWidth = isCompact ? 1.2 : 1.6;
      const flowDelay = `${index * 0.6}s`;

      return (
        <g
          key={connector.id}
          className={`circuit-path-group${isPast ? " past" : ""}${isNext ? " next" : ""}`}
        >
              <path className="circuit-path trench" d={connector.path} strokeWidth={strokeWidth + 3.2} />
              <path className="circuit-path shadow" d={connector.path} strokeWidth={strokeWidth + 0.6} />
              <path className="circuit-path base" d={connector.path} strokeWidth={strokeWidth} />
              {!prefersReducedMotion && (
                <path
                  className="circuit-path flow"
                  d={connector.path}
                  strokeWidth={strokeWidth}
                  pathLength={1280}
                  strokeDasharray="500 780"
                  strokeDashoffset="0"
                  stroke="url(#circuitFlowGradient)"
                  style={{ ["--flow-delay" as keyof CSSProperties]: flowDelay }}
                />
              )}
              {!prefersReducedMotion &&
                pulseEvents
                  .filter((event) => event.connectorId === connector.id)
                  .map((event) => (
                    <circle key={event.id} className="circuit-pulse" r={isCompact ? 4 : 5}>
                      <animateMotion
                        dur="1.2s"
                        begin="0s"
                        fill="freeze"
                        rotate="auto"
                        path={connector.path}
                        keyTimes="0;1"
                        calcMode="linear"
                      />
                      <animate attributeName="opacity" values="1;1;0" dur="1.2s" begin="0s" fill="freeze" />
                      <animate attributeName="r" values={`${isCompact ? 4 : 5};${isCompact ? 5 : 6};${isCompact ? 4 : 5}`} dur="1.2s" begin="0s" fill="freeze" />
                    </circle>
                  ))}
            </g>
          );
        })}
      </svg>

      <div className="circuit-cards">
        {cards.map((card, index) => {
          const isActive = index === displayActiveIndex;
          const isPast = index < displayActiveIndex;
          const isHighlighted = card.variant === "highlight";
          const bodyLines = card.body.split("\n");
          return (
            <article
              key={card.id}
              ref={(element) => {
                cardRefs.current[index] = element as HTMLDivElement | null;
              }}
              className={`circuit-card${isHighlighted ? " highlight" : ""}${isActive ? " is-active" : ""}${
                isPast ? " is-past" : ""
              }`}
              style={{ ["--card-offset" as keyof CSSProperties]: `${offsets[index]}px` }}
              onMouseEnter={() => handleHover(index)}
              onMouseLeave={() => handleHover(null)}
            >
              <div className="circuit-card-head">
                <span className="circuit-step">{card.id}</span>
                <div className="circuit-titles">
                  <p className="eyebrow">Etapa {card.id}</p>
                  <h3>{card.title}</h3>
                </div>
              </div>
              <div className="circuit-card-body">
                {bodyLines.map((line, lineIndex) => (
                  <p key={`${card.id}-${lineIndex}`} className="muted small">
                    {line}
                  </p>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
