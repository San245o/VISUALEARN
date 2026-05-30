'use client';

import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Brain, MessageSquare, X } from 'lucide-react';
import { customNodeTypes } from './MindmapNodeComponent';

interface MindmapCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: any;
  onEdgesChange: any;
  onNodeClick: (event: any, node: Node) => void;
  title: string;
  showHistory: boolean;
  setShowHistory: (val: boolean) => void;
  showChatbox: boolean;
  setShowChatbox: (val: boolean) => void;
  onCloseMindMap: () => void;
}

export default function MindmapCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
  title,
  showHistory,
  setShowHistory,
  showChatbox,
  setShowChatbox,
  onCloseMindMap,
}: MindmapCanvasProps) {
  return (
    <div className="w-full h-full flex flex-col bg-[#fdfbf7]">
      {/* Mindmap Title Bar */}
      <div className="h-[60px] min-h-[60px] px-6 border-b border-zinc-200 flex items-center justify-between bg-[#fdfbf7]/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Brain size={18} className="text-primary" />
            <h2 className="font-bold text-sm text-zinc-900 tracking-tight truncate max-w-[300px]">
              {title}
            </h2>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {!showChatbox && (
            <button
              onClick={() => setShowChatbox(true)}
              className="p-1.5 rounded-lg text-zinc-600 flex items-center gap-1.5 text-xs font-semibold cursor-pointer border border-transparent"
              title="Show Chatbox"
            >
              <MessageSquare size={16} />
              <span>Chatbox</span>
            </button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <button
          onClick={onCloseMindMap}
          className="absolute top-4 right-4 z-30 rounded-full border border-zinc-200/80 bg-white/90 p-2 text-zinc-600 shadow-sm backdrop-blur-sm"
          title="Close Mind Map"
        >
          <X size={18} />
        </button>
        <div className="absolute bottom-4 left-14 z-20 pointer-events-none">
          <span className="text-[11px] text-zinc-500 font-medium bg-white/90 backdrop-blur-sm border border-zinc-200/80 px-2.5 py-1.5 rounded-lg shadow-sm">
            Click nodes to generate animations
          </span>
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={customNodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
          className="bg-[#fdfbf7]"
        >
          <Controls showInteractive={false} />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e4e0da" />
        </ReactFlow>
      </div>
    </div>
  );
}
