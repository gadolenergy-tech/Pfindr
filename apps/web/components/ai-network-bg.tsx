"use client";

import { motion } from "framer-motion";

const NODES = [
  { cx: "15%", cy: "25%", r: 3, delay: 0 },
  { cx: "42%", cy: "18%", r: 2, delay: 0.5 },
  { cx: "68%", cy: "30%", r: 4, delay: 1 },
  { cx: "85%", cy: "20%", r: 2, delay: 1.5 },
  { cx: "25%", cy: "60%", r: 3, delay: 0.8 },
  { cx: "55%", cy: "55%", r: 2, delay: 0.3 },
  { cx: "78%", cy: "65%", r: 3, delay: 1.2 },
  { cx: "10%", cy: "75%", r: 2, delay: 2 },
  { cx: "48%", cy: "80%", r: 3, delay: 0.6 },
  { cx: "90%", cy: "50%", r: 2, delay: 1.8 },
];

const LINES = [
  { x1: "15%", y1: "25%", x2: "42%", y2: "18%", delay: 0.2 },
  { x1: "42%", y1: "18%", x2: "68%", y2: "30%", delay: 0.6 },
  { x1: "68%", y1: "30%", x2: "85%", y2: "20%", delay: 1.0 },
  { x1: "68%", y1: "30%", x2: "78%", y2: "65%", delay: 1.3 },
  { x1: "25%", y1: "60%", x2: "55%", y2: "55%", delay: 0.5 },
  { x1: "55%", y1: "55%", x2: "78%", y2: "65%", delay: 0.9 },
  { x1: "10%", y1: "75%", x2: "25%", y2: "60%", delay: 1.6 },
  { x1: "48%", y1: "80%", x2: "55%", y2: "55%", delay: 1.1 },
  { x1: "78%", y1: "65%", x2: "90%", y2: "50%", delay: 1.4 },
  { x1: "15%", y1: "25%", x2: "25%", y2: "60%", delay: 0.7 },
];

export function AINetworkBg() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 1 }}
      preserveAspectRatio="xMidYMid slice"
    >
      {/* Connection lines */}
      {LINES.map((line, i) => (
        <motion.line
          key={i}
          x1={line.x1} y1={line.y1}
          x2={line.x2} y2={line.y2}
          stroke="rgba(96,165,250,0.12)"
          strokeWidth={1}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.5, delay: line.delay, ease: "easeOut" }}
        />
      ))}

      {/* Nodes */}
      {NODES.map((node, i) => (
        <motion.circle
          key={i}
          cx={node.cx} cy={node.cy} r={node.r}
          fill="#3b82f6"
          fillOpacity={0.4}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 2.5, delay: node.delay, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: `${node.cx} ${node.cy}` }}
        />
      ))}

      {/* Node outer rings */}
      {NODES.filter((_, i) => i % 3 === 0).map((node, i) => (
        <motion.circle
          key={`ring-${i}`}
          cx={node.cx} cy={node.cy} r={node.r + 4}
          fill="none"
          stroke="rgba(96,165,250,0.2)"
          strokeWidth={1}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: [1, 1.8, 1], opacity: [0.2, 0, 0.2] }}
          transition={{ duration: 3, delay: node.delay + 0.5, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: `${node.cx} ${node.cy}` }}
        />
      ))}
    </svg>
  );
}