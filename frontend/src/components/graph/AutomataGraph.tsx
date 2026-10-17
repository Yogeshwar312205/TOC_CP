import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
  ReactFlowInstance,
} from '@xyflow/react';
import dagre from 'dagre';
import {
  ArrowRightLeft,
  ArrowDownUp,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sliders,
  X,
  Info,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { StateNode } from './StateNode';
import { TransitionEdge } from './TransitionEdge';
import type { NFA, DFA } from '../../types/automaton';

interface AutomataGraphProps {
  automaton: NFA | DFA;
  activeStates?: string[];
  activeTransitions?: { from: string; symbol: string; to: string }[];
  unreachableStates?: string[];
  title?: string;
  onNodeClick?: (stateName: string) => void;
}

const nodeTypes = { stateNode: StateNode };
const edgeTypes = { transitionEdge: TransitionEdge };

type LayoutDirection = 'LR' | 'TB';
type LayoutSpacing = 'compact' | 'normal' | 'spacious';

const SPACING_CONFIG: Record<LayoutSpacing, { nodesep: number; ranksep: number }> = {
  compact: { nodesep: 45, ranksep: 75 },
  normal: { nodesep: 75, ranksep: 110 },
  spacious: { nodesep: 110, ranksep: 160 },
};

const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection,
  spacing: LayoutSpacing
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const { nodesep, ranksep } = SPACING_CONFIG[spacing];
  dagreGraph.setGraph({ rankdir: direction, nodesep, ranksep });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 64, height: 64 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition ? nodeWithPosition.x - 32 : Math.random() * 300,
        y: nodeWithPosition ? nodeWithPosition.y - 32 : Math.random() * 300,
      },
    };
  });

  return { initialNodes: layoutedNodes, initialEdges: edges };
};

const EMPTY_STATES: string[] = [];
const EMPTY_TRANSITIONS: { from: string; symbol: string; to: string }[] = [];

export const AutomataGraph: React.FC<AutomataGraphProps> = ({
  automaton,
  activeStates = EMPTY_STATES,
  activeTransitions = EMPTY_TRANSITIONS,
  unreachableStates = EMPTY_STATES,
  title,
  onNodeClick,
}) => {
  const [direction, setDirection] = useState<LayoutDirection>('LR');
  const [spacing, setSpacing] = useState<LayoutSpacing>('normal');
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showLegend, setShowLegend] = useState<boolean>(true);
  const reactFlowInstanceRef = useRef<any>(null);

  // Compute structural layout nodes and grouped edges when automaton, direction, or spacing changes
  const { layoutedNodes, baseEdges } = useMemo(() => {
    if (!automaton || !automaton.states) {
      return { layoutedNodes: [], baseEdges: [] };
    }

    const stateMapping = (automaton as DFA).stateMapping || {};

    const rawNodes: Node[] = (automaton.states || []).map((st) => {
      const isStart = st === automaton.startState;
      const isAccept =
        (automaton.acceptStates && automaton.acceptStates.includes(st)) ||
        (automaton.finalStates && automaton.finalStates.includes(st));

      // A state is dead/trap if non-accepting, non-start, and all outgoing transitions loop to itself
      const outgoing = (automaton.transitions || []).filter((t) => t.from === st);
      const isDead =
        !isAccept &&
        !isStart &&
        outgoing.length > 0 &&
        outgoing.every((t) => {
          const dests = Array.isArray(t.to) ? t.to : [t.to];
          return dests.length === 1 && dests[0] === st;
        });

      return {
        id: st,
        type: 'stateNode',
        position: { x: 0, y: 0 },
        data: {
          label: st,
          isStart,
          isAccept,
          isDead,
          isActive: false,
          isUnreachable: false,
          substates: stateMapping[st],
        },
      };
    });

    // Group transitions by from -> to key
    const edgeGroupMap = new Map<string, { from: string; to: string; symbols: string[] }>();
    (automaton.transitions || []).forEach((tr) => {
      const dests = Array.isArray(tr.to) ? tr.to : [tr.to];
      dests.forEach((targetState) => {
        if (!targetState) return;
        const key = `${tr.from}->${targetState}`;
        if (!edgeGroupMap.has(key)) {
          edgeGroupMap.set(key, { from: tr.from, to: targetState, symbols: [] });
        }
        const group = edgeGroupMap.get(key)!;
        if (!group.symbols.includes(tr.symbol)) {
          group.symbols.push(tr.symbol);
        }
      });
    });

    const rawEdges: Edge[] = [];
    edgeGroupMap.forEach(({ from, to, symbols }) => {
      const isBidirectional = from !== to && edgeGroupMap.has(`${to}->${from}`);
      rawEdges.push({
        id: `e-${from}-${to}`,
        source: from,
        target: to,
        type: 'transitionEdge',
        data: {
          label: symbols.join(', '),
          symbols,
          isBidirectional,
          isActive: false,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#06b6d4',
          width: 16,
          height: 16,
        },
      });
    });

    const layout = getLayoutedElements(rawNodes, rawEdges, direction, spacing);
    const posMap = new Map(layout.initialNodes.map((n) => [n.id, n.position]));

    // Smart handle selection based on relative node positions
    const routedEdges = layout.initialEdges.map((edge) => {
      const srcPos = posMap.get(edge.source);
      const tgtPos = posMap.get(edge.target);
      const isSelf = edge.source === edge.target;

      let sourceHandle = 'source-right';
      let targetHandle = 'left';

      if (isSelf) {
        sourceHandle = 'source-top';
        targetHandle = 'top';
      } else if (direction === 'TB') {
        sourceHandle = 'source-bottom';
        targetHandle = 'top';
      } else if (srcPos && tgtPos && tgtPos.x <= srcPos.x) {
        // Back edge: route via bottom handles
        sourceHandle = 'source-bottom';
        targetHandle = 'bottom';
      }

      return {
        ...edge,
        sourceHandle,
        targetHandle,
      };
    });

    return { layoutedNodes: layout.initialNodes, baseEdges: routedEdges };
  }, [automaton, direction, spacing]);

  // Compute final styled nodes and edges incorporating dynamic active/unreachable highlights
  const { currentNodes, currentEdges } = useMemo(() => {
    const nodes = layoutedNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        isActive: activeStates.includes(node.id),
        isUnreachable: unreachableStates.includes(node.id),
      },
    }));

    const edges = baseEdges.map((edge) => {
      const symbols: string[] = (edge.data?.symbols as string[]) || [];
      const isEdgeActive = activeTransitions.some(
        (at) =>
          at.from === edge.source &&
          (Array.isArray(at.to) ? at.to.includes(edge.target) : at.to === edge.target) &&
          symbols.includes(at.symbol)
      );

      return {
        ...edge,
        animated: isEdgeActive,
        data: {
          ...edge.data,
          isActive: isEdgeActive,
        },
        markerEnd: {
          ...(edge.markerEnd as any),
          color: isEdgeActive ? '#f59e0b' : '#06b6d4',
        },
      };
    });

    return { currentNodes: nodes, currentEdges: edges };
  }, [layoutedNodes, baseEdges, activeStates, activeTransitions, unreachableStates]);

  const [nodes, setNodes, onNodesChange] = useNodesState(currentNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(currentEdges);

  // Synchronize React Flow internal state whenever computed nodes or edges change
  React.useEffect(() => {
    setNodes(currentNodes);
    setEdges(currentEdges);
    if (reactFlowInstanceRef.current) {
      setTimeout(() => {
        reactFlowInstanceRef.current?.fitView({ padding: 0.2, duration: 300 });
      }, 50);
    }
  }, [currentNodes, currentEdges, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedState(node.id);
      if (onNodeClick) {
        onNodeClick(node.id);
      }
    },
    [onNodeClick]
  );

  const handleFitView = () => {
    if (reactFlowInstanceRef.current) {
      reactFlowInstanceRef.current.fitView({ padding: 0.2, duration: 400 });
    }
  };

  const handleToggleDirection = () => {
    setDirection((prev) => (prev === 'LR' ? 'TB' : 'LR'));
  };

  const handleCycleSpacing = () => {
    setSpacing((prev) => {
      if (prev === 'compact') return 'normal';
      if (prev === 'normal') return 'spacious';
      return 'compact';
    });
  };

  // Transitions for selected state
  const totalTransitions = useMemo(() => {
    if (!automaton?.transitions) return 0;
    return automaton.transitions.reduce((acc, tr) => {
      const dests = Array.isArray(tr.to) ? tr.to : [tr.to];
      return acc + dests.filter(Boolean).length;
    }, 0);
  }, [automaton]);

  // Transitions for selected state
  const selectedNodeDetails = useMemo(() => {
    if (!selectedState || !automaton) return null;
    const isStart = automaton.startState === selectedState;
    const isAccept =
      (automaton.acceptStates && automaton.acceptStates.includes(selectedState)) ||
      (automaton.finalStates && automaton.finalStates.includes(selectedState));
    const substates = (automaton as DFA).stateMapping?.[selectedState];

    const outgoing = (automaton.transitions || []).filter((t) => t.from === selectedState);
    const incoming = (automaton.transitions || []).filter((t) => {
      const dests = Array.isArray(t.to) ? t.to : [t.to];
      return dests.includes(selectedState);
    });

    const isDead =
      !isAccept &&
      !isStart &&
      outgoing.length > 0 &&
      outgoing.every((t) => {
        const dests = Array.isArray(t.to) ? t.to : [t.to];
        return dests.length === 1 && dests[0] === selectedState;
      });

    return {
      name: selectedState,
      isStart,
      isAccept,
      isDead,
      substates,
      outgoing,
      incoming,
    };
  }, [selectedState, automaton]);

  return (
    <div
      className={`w-full h-full min-h-[420px] rounded-2xl border border-slate-800/80 bg-slate-950/70 backdrop-blur-md relative overflow-hidden flex flex-col ${
        isFullscreen ? 'fixed inset-4 z-50 shadow-2xl border-cyan-500/50' : ''
      }`}
    >
      {/* Top Header & Toolbar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        {/* Title Badge */}
        {title && (
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-900/95 border border-slate-700/80 text-xs font-mono font-bold text-cyan-300 shadow-lg pointer-events-auto flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>{title}</span>
            <span className="text-[10px] text-slate-400 font-normal">
              ({automaton?.states?.length || 0} states, {totalTransitions} transitions)
            </span>
          </div>
        )}

        {/* Action Toolbar */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/95 border border-slate-700/80 shadow-lg pointer-events-auto backdrop-blur-md">
          {/* Layout Direction Toggle */}
          <button
            onClick={handleToggleDirection}
            title={`Switch to ${direction === 'LR' ? 'Top-to-Bottom' : 'Left-to-Right'} Layout`}
            className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold text-slate-300 hover:text-cyan-300 hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            {direction === 'LR' ? (
              <>
                <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-400" />
                <span>LR</span>
              </>
            ) : (
              <>
                <ArrowDownUp className="w-3.5 h-3.5 text-sky-400" />
                <span>TB</span>
              </>
            )}
          </button>

          {/* Density / Spacing Toggle */}
          <button
            onClick={handleCycleSpacing}
            title={`Cycle Layout Spacing (Current: ${spacing})`}
            className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold text-slate-300 hover:text-cyan-300 hover:bg-slate-800 transition-colors flex items-center gap-1.5 capitalize"
          >
            <Sliders className="w-3.5 h-3.5 text-purple-400" />
            <span>{spacing}</span>
          </button>

          {/* Fit View Button */}
          <button
            onClick={handleFitView}
            title="Fit View & Center Automaton"
            className="p-1.5 rounded-lg text-slate-300 hover:text-cyan-300 hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Toggle Legend */}
          <button
            onClick={() => setShowLegend((p) => !p)}
            title="Toggle Visual Legend"
            className={`p-1.5 rounded-lg transition-colors ${
              showLegend ? 'text-cyan-300 bg-cyan-950/40' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen Expand Button */}
          <button
            onClick={() => setIsFullscreen((p) => !p)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand to Fullscreen'}
            className="p-1.5 rounded-lg text-slate-300 hover:text-cyan-300 hover:bg-slate-800 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-rose-400" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Selected Node Inspector Card */}
      {selectedNodeDetails && (
        <div className="absolute top-14 right-3 z-20 w-72 rounded-2xl bg-slate-900/95 border border-cyan-500/40 p-4 shadow-2xl backdrop-blur-md font-mono text-xs text-slate-200 space-y-3 pointer-events-auto">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-500 text-cyan-300 flex items-center justify-center font-bold">
                {selectedNodeDetails.name}
              </span>
              <div>
                <p className="font-bold text-slate-100">State {selectedNodeDetails.name}</p>
                <p className="text-[10px] text-slate-400">
                  {selectedNodeDetails.isStart && selectedNodeDetails.isAccept
                    ? 'Start & Accept State'
                    : selectedNodeDetails.isStart
                    ? 'Start State'
                    : selectedNodeDetails.isAccept
                    ? 'Accept State (Final)'
                    : selectedNodeDetails.isDead
                    ? 'Dead / Trap State'
                    : 'Standard State'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedState(null)}
              className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Substates (for Subset DFA) */}
          {selectedNodeDetails.substates && selectedNodeDetails.substates.length > 0 && (
            <div className="space-y-1 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">
                NFA Substates:
              </span>
              <p className="text-purple-300 font-bold">
                {`{${selectedNodeDetails.substates.join(', ')}}`}
              </p>
            </div>
          )}

          {/* Outgoing Transitions */}
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Outgoing Transitions ({selectedNodeDetails.outgoing.length}):
            </span>
            {selectedNodeDetails.outgoing.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic">No outgoing transitions (Dead state)</p>
            ) : (
              <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                {selectedNodeDetails.outgoing.map((t, idx) => {
                  const dests = Array.isArray(t.to) ? t.to.join(', ') : t.to;
                  return (
                    <div
                      key={idx}
                      className="flex justify-between items-center px-2 py-1 rounded bg-slate-800/60 border border-slate-700/60 text-[11px]"
                    >
                      <span>
                        on <span className="text-cyan-300 font-bold">'{t.symbol}'</span>
                      </span>
                      <span className="text-emerald-300">➔ {dests}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main React Flow Canvas */}
      <div className="flex-1 w-full h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={handleNodeClick}
          onInit={(instance) => {
            reactFlowInstanceRef.current = instance;
          }}
          fitView
          fitViewOptions={{ padding: 0.2 }}
        >
          <Background color="#1e293b" gap={24} size={1} />
          <Controls />
        </ReactFlow>
      </div>

      {/* Visual Legend Bar at Bottom */}
      {showLegend && (
        <div className="absolute bottom-3 left-3 z-10 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800/80 shadow-md backdrop-blur-md flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-300 pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-purple-400 font-bold">➔</span>
            <span>Start</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-emerald-500 relative flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full border border-emerald-400" />
            </span>
            <span>Accept</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-amber-500/80 border border-amber-400 animate-pulse" />
            <span className="text-amber-300">Active</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-amber-400 inline-block shadow-[0_0_6px_#f59e0b]" />
            <span className="text-amber-300">Traversed</span>
          </div>
        </div>
      )}
    </div>
  );
};
