import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';

export interface StateNodeData {
  label: string;
  isStart?: boolean;
  isAccept?: boolean;
  isActive?: boolean;
  isUnreachable?: boolean;
  isDead?: boolean;
  substates?: string[];
  [key: string]: unknown;
}

export const StateNode = memo(({ data }: NodeProps) => {
  const nodeData = data as unknown as StateNodeData;
  const isStart = nodeData.isStart;
  const isAccept = nodeData.isAccept;
  const isActive = nodeData.isActive;
  const isUnreachable = nodeData.isUnreachable;
  const isDead = nodeData.isDead;
  const label = nodeData.label;

  let borderColor = 'border-cyan-500/50';
  let bgColor = 'bg-slate-900/90';
  let textColor = 'text-cyan-300';
  let glow = '';

  if (isActive) {
    borderColor = 'border-amber-400';
    bgColor = 'bg-amber-950/80';
    textColor = 'text-amber-200';
    glow = 'shadow-[0_0_25px_rgba(251,191,36,0.6)] animate-pulse';
  } else if (isUnreachable) {
    borderColor = 'border-rose-500/50';
    bgColor = 'bg-rose-950/40';
    textColor = 'text-rose-400 line-through';
  } else if (isAccept) {
    borderColor = 'border-emerald-500';
    textColor = 'text-emerald-300';
    glow = 'shadow-[0_0_15px_rgba(16,185,129,0.3)]';
  } else if (isStart) {
    borderColor = 'border-purple-500';
    textColor = 'text-purple-300';
    glow = 'shadow-[0_0_15px_rgba(168,85,247,0.3)]';
  } else if (isDead) {
    borderColor = 'border-slate-600';
    bgColor = 'bg-slate-950/90';
    textColor = 'text-slate-300';
  }

  return (
    <div className="relative group">
      {/* Start State Indicator Arrow */}
      {isStart && (
        <div className="absolute -left-7 top-1/2 -translate-y-1/2 flex items-center text-purple-400 font-bold text-lg select-none pointer-events-none">
          ➔
        </div>
      )}

      {/* Main Node Circle */}
      <div
        className={`w-14 h-14 rounded-full border-2 ${borderColor} ${bgColor} ${textColor} ${glow} backdrop-blur-md flex flex-col items-center justify-center font-mono font-bold text-sm transition-all duration-300 relative cursor-pointer hover:scale-105`}
        title={`State: ${label}${isStart ? ' (Start State)' : ''}${isAccept ? ' (Accept State)' : ''}${isDead ? ' (Dead / Trap State)' : ''}${isUnreachable ? ' (Unreachable)' : ''}`}
      >
        {/* Inner Circle for Accept States */}
        {isAccept && (
          <div className={`absolute inset-1 rounded-full border-2 ${isActive ? 'border-amber-400' : 'border-emerald-500/80'} pointer-events-none`} />
        )}

        <span className="z-10">{label}</span>

        {isDead && (!nodeData.substates || nodeData.substates.length === 0) && (
          <span className="text-[7px] text-slate-400 font-semibold uppercase tracking-wider z-10 px-1 rounded bg-slate-950/70 border border-slate-800">
            TRAP
          </span>
        )}

        {nodeData.substates && nodeData.substates.length > 0 && (
          <span className="text-[8px] text-slate-400 font-normal truncate max-w-[46px] z-10 px-1 rounded bg-slate-950/60">
            {`{${nodeData.substates.join(',')}}`}
          </span>
        )}
      </div>

      {/* Handles for React Flow connections (source & target on all 4 sides) */}
      <Handle type="target" position={Position.Top} id="top" className="w-1.5 h-1.5 opacity-0" />
      <Handle type="source" position={Position.Top} id="source-top" className="w-1.5 h-1.5 opacity-0" />
      <Handle type="target" position={Position.Bottom} id="bottom" className="w-1.5 h-1.5 opacity-0" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="w-1.5 h-1.5 opacity-0" />
      <Handle type="target" position={Position.Left} id="left" className="w-1.5 h-1.5 opacity-0" />
      <Handle type="source" position={Position.Left} id="source-left" className="w-1.5 h-1.5 opacity-0" />
      <Handle type="target" position={Position.Right} id="right" className="w-1.5 h-1.5 opacity-0" />
      <Handle type="source" position={Position.Right} id="source-right" className="w-1.5 h-1.5 opacity-0" />
    </div>
  );
});

StateNode.displayName = 'StateNode';
