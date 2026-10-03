import React, { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
} from '@xyflow/react';
import dagre from 'dagre';
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

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'LR', nodesep: 80, ranksep: 120 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 70, height: 70 });
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
        x: nodeWithPosition ? nodeWithPosition.x - 35 : Math.random() * 300,
        y: nodeWithPosition ? nodeWithPosition.y - 35 : Math.random() * 300,
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
  // Compute structural layout nodes and grouped edges when automaton structure changes
  const { layoutedNodes, baseEdges } = useMemo(() => {
    const rawNodes: Node[] = (automaton?.states || []).map((st) => ({
      id: st,
      type: 'stateNode',
      position: { x: 0, y: 0 },
      data: {
        label: st,
        isStart: st === automaton.startState,
        isAccept:
          (automaton.acceptStates && automaton.acceptStates.includes(st)) ||
          (automaton.finalStates && automaton.finalStates.includes(st)),
        isActive: false,
        isUnreachable: false,
      },
    }));

    // Group transitions by from -> to key
    const edgeGroupMap = new Map<string, { from: string; to: string; symbols: string[] }>();
    (automaton?.transitions || []).forEach((tr) => {
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

    const layout = getLayoutedElements(rawNodes, rawEdges);
    return { layoutedNodes: layout.initialNodes, baseEdges: layout.initialEdges };
  }, [automaton]);

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
  }, [currentNodes, currentEdges, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (onNodeClick) {
        onNodeClick(node.id);
      }
    },
    [onNodeClick]
  );

  return (
    <div className="w-full h-full min-h-[420px] rounded-2xl border border-slate-800/80 bg-slate-950/60 backdrop-blur-md relative overflow-hidden flex flex-col">
      {title && (
        <div className="absolute top-4 left-4 z-10 px-3.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono font-bold text-cyan-300 shadow-md">
          {title}
        </div>
      )}

      <div className="flex-1 w-full h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.2 }}
        >
          <Background color="#1e293b" gap={24} size={1} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
};
