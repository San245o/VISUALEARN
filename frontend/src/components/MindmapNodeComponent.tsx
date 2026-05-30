'use client';

import { Handle, Position } from '@xyflow/react';
import { Brain } from 'lucide-react';

const BRANCH_COLORS = [
  { bg: '#FEE2E2', border: '#EF4444', text: '#991B1B', accent: '#DC2626' },
  { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E', accent: '#D97706' },
  { bg: '#D1FAE5', border: '#10B981', text: '#065F46', accent: '#059669' },
  { bg: '#DBEAFE', border: '#3B82F6', text: '#1E3A8A', accent: '#2563EB' },
  { bg: '#EDE9FE', border: '#8B5CF6', text: '#5B21B6', accent: '#7C3AED' },
  { bg: '#FCE7F3', border: '#EC4899', text: '#9D174D', accent: '#DB2777' },
  { bg: '#FFEDD5', border: '#F97316', text: '#9A3412', accent: '#EA580C' },
  { bg: '#E0E7FF', border: '#6366F1', text: '#3730A3', accent: '#4F46E5' },
];

function MindmapNodeComponent({ data }: { data: any }) {
  const isRoot = data.isRoot;
  const isGenerated = data.isGenerated;

  // Green theme for generated, Red theme for ungenerated
  const greenTheme = { bg: '#F0FDF4', border: '#10B981', text: '#15803D', accent: '#16A34A' };
  const redTheme = { bg: '#FEF2F2', border: '#EF4444', text: '#B91C1C', accent: '#DC2626' };

  const color = isRoot ? null : (isGenerated ? greenTheme : redTheme);

  if (isRoot) {
    return (
      <div className="relative group">
        <Handle type="source" position={Position.Right} className="!bg-primary !w-2 !h-2 !border-0" />
        <div
          className="px-6 py-4 rounded-2xl shadow-lg border-2 cursor-pointer min-w-[200px] max-w-[320px] text-center"
          style={{
            background: 'linear-gradient(135deg, #4B5563 0%, #1F2937 100%)',
            borderColor: '#111827',
            color: 'white',
          }}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <Brain size={18} />
            <span className="font-bold text-base">{data.label}</span>
          </div>
          <p className="text-xs opacity-85 line-clamp-2">{data.description}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative group">
      <Handle type="target" position={Position.Left} className="!bg-transparent !w-2 !h-2 !border-0" />
      <Handle type="source" position={Position.Right} className="!bg-transparent !w-2 !h-2 !border-0" />
      <div
        className="px-5 py-3 rounded-xl shadow-md border-2 cursor-pointer min-w-[180px] max-w-[240px]"
        style={{
          background: color?.bg || '#F3F4F6',
          borderColor: color?.border || '#9CA3AF',
          color: color?.text || '#1F2937',
        }}
      >
        <div className="font-semibold text-sm mb-0.5 flex items-center gap-1.5">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: color?.accent || '#6B7280' }}
          />
          {data.label}
        </div>
        <p className="text-xs opacity-85 line-clamp-2">{data.description}</p>
      </div>
    </div>
  );
}

export const customNodeTypes = { mindmapNode: MindmapNodeComponent };
export { BRANCH_COLORS };
export type MindmapNode = {
  id: string;
  label: string;
  description: string;
  children: MindmapNode[];
};

export type MindmapData = {
  title: string;
  root: MindmapNode;
};
