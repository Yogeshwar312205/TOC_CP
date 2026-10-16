import React, { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  EdgeProps,
} from '@xyflow/react';

export const TransitionEdge = memo(({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps) => {
  const symbol = (data?.label as string) || '';
  const isActive = Boolean(data?.isActive);
  const isBidirectional = Boolean(data?.isBidirectional);

  // Self loop case handling
  const isSelfLoop = source === target || (sourceX === targetX && sourceY === targetY);

  if (isSelfLoop) {
    // Smooth cubic loop above the node circle (starts and returns cleanly to top of node)
    const loopRadius = 24;
    const path = `M ${sourceX - 8} ${sourceY} C ${sourceX - 28} ${sourceY - 48}, ${sourceX + 28} ${sourceY - 48}, ${sourceX + 8} ${sourceY}`;
    const labelX = sourceX;
    const labelY = sourceY - 48;

    return (
      <>
        <path
          id={id}
          className={`react-flow__edge-path ${
            isActive ? 'stroke-amber-400 stroke-[3px] animate-pulse' : 'stroke-cyan-500/80 stroke-[1.8px]'
          }`}
          style={{
            filter: isActive ? 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.8))' : 'none',
          }}
          d={path}
          markerEnd={markerEnd}
          fill="none"
        />
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold border backdrop-blur-md shadow-md ${
              isActive
                ? 'bg-amber-950/95 text-amber-300 border-amber-400 shadow-amber-500/50 ring-2 ring-amber-400/30'
                : 'bg-slate-900/90 text-cyan-300 border-cyan-500/40'
            }`}
          >
            {symbol}
          </div>
        </EdgeLabelRenderer>
      </>
    );
  }

  // Curved path for bidirectional edges (A -> B and B -> A)
  if (isBidirectional) {
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    const mx = (sourceX + targetX) / 2;
    const my = (sourceY + targetY) / 2;
    const offset = 36;

    const cx = mx + nx * offset;
    const cy = my + ny * offset;

    const edgePath = `M ${sourceX} ${sourceY} Q ${cx} ${cy} ${targetX} ${targetY}`;
    const labelX = 0.25 * sourceX + 0.5 * cx + 0.25 * targetX;
    const labelY = 0.25 * sourceY + 0.5 * cy + 0.25 * targetY;

    return (
      <>
        <path
          id={id}
          className={`react-flow__edge-path ${
            isActive ? 'stroke-amber-400 stroke-[3px] animate-pulse' : 'stroke-cyan-500/80 stroke-[1.8px]'
          }`}
          style={{
            filter: isActive ? 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.8))' : 'none',
          }}
          d={edgePath}
          markerEnd={markerEnd}
          fill="none"
        />
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border backdrop-blur-md shadow-md ${
              isActive
                ? 'bg-amber-950/95 text-amber-300 border-amber-400 shadow-amber-500/50 ring-2 ring-amber-400/30'
                : 'bg-slate-900/90 text-cyan-300 border-cyan-500/40'
            }`}
          >
            {symbol}
          </div>
        </EdgeLabelRenderer>
      </>
    );
  }

  // Standard bezier path for single-direction edges
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: isActive ? '#f59e0b' : 'rgba(6, 182, 212, 0.75)',
          strokeWidth: isActive ? 3 : 1.8,
          filter: isActive ? 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.8))' : 'none',
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border backdrop-blur-md shadow-md ${
            isActive
              ? 'bg-amber-950/95 text-amber-300 border-amber-400 shadow-amber-500/50 ring-2 ring-amber-400/30'
              : 'bg-slate-900/90 text-cyan-300 border-cyan-500/40'
          }`}
        >
          {symbol}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

TransitionEdge.displayName = 'TransitionEdge';
