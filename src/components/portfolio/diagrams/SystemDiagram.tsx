"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import type { ProjectAccent, ProjectDiagram } from "@/lib/portfolio/content";
import { useReducedMotion } from "@/hooks/portfolio/use-reduced-motion";
import { usePortfolioMotion } from "@/components/portfolio/PortfolioMotionContext";
import styles from "./SystemDiagram.module.css";

type Props = {
  diagram: ProjectDiagram;
  accent: ProjectAccent;
  className?: string;
};

const NODE_W = 148;
const NODE_H = 52;

function nodeCenter(node: ProjectDiagram["nodes"][number]) {
  return { x: node.x + NODE_W / 2, y: node.y + NODE_H / 2 };
}

function edgePath(
  from: ProjectDiagram["nodes"][number],
  to: ProjectDiagram["nodes"][number],
) {
  const a = nodeCenter(from);
  const b = nodeCenter(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy) || 1;
  const startInset = NODE_W * 0.42;
  const endInset = NODE_W * 0.42;
  const x1 = a.x + (dx / distance) * startInset;
  const y1 = a.y + (dy / distance) * startInset;
  const x2 = b.x - (dx / distance) * endInset;
  const y2 = b.y - (dy / distance) * endInset;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const curve = Math.min(48, distance * 0.18);
  const nx = (-dy / distance) * curve;
  const ny = (dx / distance) * curve;
  return `M ${x1} ${y1} Q ${mx + nx} ${my + ny} ${x2} ${y2}`;
}

export default function SystemDiagram({ diagram, accent, className }: Props) {
  const prefersReduced = useReducedMotion();
  const { motionEnabled } = usePortfolioMotion();
  const motionReduce = prefersReduced || !motionEnabled;
  const rootRef = useRef<HTMLElement>(null);
  const [drawn, setDrawn] = useState(motionReduce);
  const reactId = useId().replace(/:/g, "");
  const markerId = `diagram-arrow-${reactId}`;

  useEffect(() => {
    if (motionReduce) {
      setDrawn(true);
      return;
    }
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setDrawn(true);
          observer.disconnect();
        }
      },
      { threshold: [0.12, 0.28], rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [motionReduce]);

  const width = diagram.width ?? 920;
  const height = diagram.height ?? 420;
  const nodeById = new Map(diagram.nodes.map((node) => [node.id, node]));

  return (
    <figure
      ref={rootRef}
      className={`${styles.root} ${className ?? ""}`}
      data-accent={accent}
      data-drawn={drawn ? "true" : "false"}
      data-motion={motionReduce ? "reduce" : "ok"}
    >
      <header className={styles.header}>
        <p className={styles.kicker}>System</p>
        <h3 className={styles.title}>{diagram.title}</h3>
        {diagram.caption ? <p className={styles.caption}>{diagram.caption}</p> : null}
      </header>

      <svg
        className={styles.canvas}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={diagram.title}
      >
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className={styles.arrow} />
          </marker>
        </defs>

        <g className={styles.edges} aria-hidden="true">
          {diagram.edges.map((edge, edgeIndex) => {
            const from = nodeById.get(edge.from);
            const to = nodeById.get(edge.to);
            if (!from || !to) return null;
            const d = edgePath(from, to);
            return (
              <g
                key={`${edge.from}-${edge.to}-${edge.label ?? ""}`}
                className={styles.edge}
                style={{ "--draw-delay": `${edgeIndex * 90}ms` } as CSSProperties}
              >
                <path
                  d={d}
                  className={styles.edgeTrack}
                  data-emphasis={edge.emphasis ? "true" : "false"}
                />
                <path
                  d={d}
                  className={styles.edgeFlow}
                  markerEnd={`url(#${markerId})`}
                  data-emphasis={edge.emphasis ? "true" : "false"}
                />
                {edge.label ? (
                  <text
                    x={(from.x + to.x) / 2 + NODE_W / 2}
                    y={(from.y + to.y) / 2 + NODE_H / 2 - 10}
                    className={styles.edgeLabel}
                  >
                    {edge.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>

        <g className={styles.nodes}>
          {diagram.nodes.map((node, nodeIndex) => (
            <g
              key={node.id}
              className={styles.node}
              data-kind={node.kind ?? "stage"}
              transform={`translate(${node.x} ${node.y})`}
              style={{ "--node-delay": `${120 + nodeIndex * 70}ms` } as CSSProperties}
            >
              <rect
                className={styles.nodeShell}
                width={NODE_W}
                height={NODE_H}
                rx={node.kind === "gate" ? 8 : node.kind === "store" ? 18 : 14}
                ry={node.kind === "gate" ? 8 : node.kind === "store" ? 18 : 14}
              />
              <text className={styles.nodeLabel} x={NODE_W / 2} y={node.detail ? 22 : 30}>
                {node.label}
              </text>
              {node.detail ? (
                <text className={styles.nodeDetail} x={NODE_W / 2} y={38}>
                  {node.detail}
                </text>
              ) : null}
            </g>
          ))}
        </g>
      </svg>
    </figure>
  );
}
