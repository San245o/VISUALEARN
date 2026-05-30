import dagre from 'dagre';
import { type Node, type Edge } from '@xyflow/react';
import { BRANCH_COLORS, type MindmapNode } from '@/components/MindmapNodeComponent';

export function getLayoutedElements(nodes: Node[], edges: Edge[], direction = 'TB') {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 40, ranksep: 160 });

  nodes.forEach((node) => {
    const isRoot = node.data?.isRoot;
    const w = isRoot ? 320 : 220;
    const h = isRoot ? 100 : 80;
    g.setNode(node.id, { width: w, height: h });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const n = g.node(node.id);
    const isRoot = node.data?.isRoot;
    const w = isRoot ? 320 : 220;
    const h = isRoot ? 100 : 80;
    return {
      ...node,
      position: { x: n.x - w / 2, y: n.y - h / 2 },
    };
  });

  return { nodes: layoutedNodes, edges };
}

export function treeToFlow(root: MindmapNode, generatedNodeIds?: Set<string>): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let branchIndex = 0;

  function traverse(node: MindmapNode, parentId: string | null, depth: number, colorIdx: number) {
    const color = BRANCH_COLORS[colorIdx % BRANCH_COLORS.length];
    const isGenerated = generatedNodeIds ? generatedNodeIds.has(node.id) : false;

    nodes.push({
      id: node.id,
      type: 'mindmapNode',
      position: { x: 0, y: 0 },
      data: {
        label: node.label,
        description: node.description,
        isRoot: depth === 0,
        color,
        isGenerated,
        nodeData: node,
      },
    });

    if (parentId) {
      edges.push({
        id: `${parentId}-${node.id}`,
        source: parentId,
        target: node.id,
        type: 'smoothstep',
        style: {
          stroke: isGenerated ? '#10B981' : color.border,
          strokeWidth: depth === 1 ? 3 : 2,
        },
        animated: depth === 1,
      });
    }

    node.children?.forEach((child, idx) => {
      const childColor = depth === 0 ? branchIndex++ : colorIdx;
      traverse(child, node.id, depth + 1, depth === 0 ? childColor : colorIdx);
    });
  }

  traverse(root, null, 0, 0);
  return getLayoutedElements(nodes, edges, 'LR');
}
