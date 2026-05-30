'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

import Link from 'next/link';
import {
  Play,
  Loader2,
  Send,
  Sparkles,
  ChevronDown,
  Check,
  Code,
  Copy,
  Video,
  Bot,
  User,
  AlertCircle,
  History,
  X,
  Plus,
  Trash2,
  MessageSquare,
  Menu,
  Brain,
  Upload,
  FileText,
  Network,
  BookOpen,
  Paperclip,
} from 'lucide-react';
import { useNodesState, useEdgesState, type Node, type Edge } from '@xyflow/react';
import MindmapCanvas from '@/components/MindmapCanvas';
import { treeToFlow } from '@/lib/layoutHelper';
import { type MindmapNode, type MindmapData } from '@/components/MindmapNodeComponent';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';

type ModelOption = {
  id: string;
  label: string;
  status?: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  videoUrl?: string;
  videoFilename?: string;
  modelUsed?: string;
  timestamp: Date;
  isLoading?: boolean;
};

type VideoRecord = {
  filename: string;
  url: string;
  size_bytes: number;
  created_at: string;
};

type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  videoFilename?: string;
  document_id?: string | null;
  document_name?: string;
  timestamp: Date;
};

type DocumentRecord = {
  id: string;
  filename: string;
  page_count: number;
  total_chunks: number;
  created_at: string;
};

type NodeVideoCacheRecord = {
  node_id: string;
  video_url: string | null;
  description: string | null;
};

type NodeVideoStreamResult = {
  type?: string;
  description?: string;
  video_url?: string | null;
  error?: string;
  stages?: string[];
};

const FALLBACK_MODELS: ModelOption[] = [
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', status: 'stable' },
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)', status: 'preview' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', status: 'stable' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', status: 'stable' },
];

const FALLBACK_DEFAULT_MODEL = 'gemini-3.5-flash';

const MathText = ({ text, block = false }: { text: string; block?: boolean }) => {
  const [html, setHtml] = useState<string>('');

  useEffect(() => {
    const renderMath = () => {
      const katexObj = (window as any).katex;
      if (katexObj) {
        try {
          const rendered = katexObj.renderToString(text, {
            displayMode: block,
            throwOnError: false,
          });
          setHtml(rendered);
        } catch (e) {
          setHtml(text);
        }
      } else {
        const interval = setInterval(() => {
          const k = (window as any).katex;
          if (k) {
            clearInterval(interval);
            try {
              const rendered = k.renderToString(text, {
                displayMode: block,
                throwOnError: false,
              });
              setHtml(rendered);
            } catch (e) {
              setHtml(text);
            }
          }
        }, 100);
        return () => clearInterval(interval);
      }
    };
    renderMath();
  }, [text, block]);

  if (html) {
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return <span>{text}</span>;
};

const parseMathAndText = (text: string) => {
  if (!text) return '';
  // Support both block math $$...$$ and inline math $...$
  const blockParts = text.split(/(\$\$.*?\$\$)/g);
  return blockParts.flatMap((bPart, bIdx) => {
    if (bPart.startsWith('$$') && bPart.endsWith('$$')) {
      const mathContent = bPart.slice(2, -2);
      return [<MathText key={`block-${bIdx}`} text={mathContent} block={true} />];
    }
    const inlineParts = bPart.split(/(\$.*?\$)/g);
    return inlineParts.map((iPart, iIdx) => {
      if (iPart.startsWith('$') && iPart.endsWith('$')) {
        const mathContent = iPart.slice(1, -1);
        return <MathText key={`inline-${bIdx}-${iIdx}`} text={mathContent} />;
      }
      return iPart;
    });
  });
};

const parseInlineMarkdown = (text: string) => {
  if (!text) return '';
  const boldParts = text.split(/(\*\*.*?\*\*)/g);
  return boldParts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-zinc-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    
    const codeParts = part.split(/(`.*?`)/g);
    return codeParts.map((subPart, j) => {
      if (subPart.startsWith('`') && subPart.endsWith('`')) {
        return (
          <code key={j} className="px-1.5 py-0.5 bg-zinc-100 border border-zinc-200 text-red-600 font-mono text-xs rounded">
            {subPart.slice(1, -1)}
          </code>
        );
      }
      return parseMathAndText(subPart);
    });
  });
};

const extractManimCode = (descriptionText: string): { cleanText: string; code: string | null } => {
  if (!descriptionText) return { cleanText: '', code: null };
  
  // Try comment tags first
  const startIndex = descriptionText.indexOf('<!-- MANIM_CODE_START -->');
  const endIndex = descriptionText.indexOf('<!-- MANIM_CODE_END -->');
  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const code = descriptionText.slice(startIndex + '<!-- MANIM_CODE_START -->'.length, endIndex).trim();
    const cleanText = (descriptionText.slice(0, startIndex) + descriptionText.slice(endIndex + '<!-- MANIM_CODE_END -->'.length)).trim();
    return { cleanText, code };
  }
  
  // Fallback: match markdown block at the end if it has from manim import
  const match = descriptionText.match(/([\s\S]*?)```python\n(from manim import [\s\S]*?)```$/);
  if (match) {
    return {
      cleanText: match[1].trim(),
      code: match[2].trim()
    };
  }

  return { cleanText: descriptionText, code: null };
};

const extractManimError = (descriptionText: string): string | null => {
  if (!descriptionText) return null;
  const match = descriptionText.match(/<!-- MANIM_ERROR_START -->([\s\S]*?)<!-- MANIM_ERROR_END -->/);
  return match ? match[1].trim() : null;
};

const getErrorMessage = (err: unknown, fallback: string) => {
  return err instanceof Error ? err.message : fallback;
};

const CollapsibleCode = ({ code }: { code: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="mt-6 border border-zinc-200 rounded-xl overflow-hidden bg-zinc-50 shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-100/50 text-sm font-semibold text-zinc-700 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Code size={16} className="text-red-500" />
          <span>View Manim Code</span>
        </div>
        <ChevronDown
          size={16}
          className={isOpen ? 'rotate-180' : ''}
        />
      </button>
      
      {isOpen && (
        <div className="relative border-t border-zinc-200">
          <button
            onClick={handleCopy}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-zinc-800 text-zinc-300 z-10"
            title="Copy code"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          </button>
          <pre className="p-4 bg-zinc-950 text-zinc-100 font-mono text-xs rounded-b-xl overflow-x-auto max-h-[350px] custom-scrollbar">
            <code>{code}</code>
          </pre>
        </div>
      )}
    </div>
  );
};

const renderMarkdown = (text: string) => {
  if (!text) return null;
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let codeBlockLang = '';

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        elements.push(
          <pre key={`code-${idx}`} className="p-4 bg-zinc-950 text-zinc-100 font-mono text-xs rounded-lg overflow-x-auto my-3 border border-zinc-800">
            <code>{codeBlockLines.join('\n')}</code>
          </pre>
        );
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        // Start of code block
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    if (!trimmed) {
      elements.push(<div key={idx} className="h-2" />);
      continue;
    }

    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={idx} className="text-base font-bold text-zinc-900 mt-4 mb-2">
          {parseInlineMarkdown(trimmed.slice(4))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={idx} className="text-lg font-bold text-zinc-900 mt-5 mb-2.5">
          {parseInlineMarkdown(trimmed.slice(3))}
        </h2>
      );
      continue;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={idx} className="text-xl font-bold text-zinc-900 mt-6 mb-3">
          {parseInlineMarkdown(trimmed.slice(2))}
        </h1>
      );
      continue;
    }

    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      elements.push(
        <div key={idx} className="flex gap-2 ml-2 mb-2 text-sm text-zinc-700 leading-relaxed">
          <span className="font-semibold text-zinc-500">{numMatch[1]}.</span>
          <span className="flex-1">{parseInlineMarkdown(numMatch[2])}</span>
        </div>
      );
      continue;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <div key={idx} className="flex gap-2 ml-2 mb-2 text-sm text-zinc-700 leading-relaxed">
          <span className="text-red-500">•</span>
          <span className="flex-1">{parseInlineMarkdown(trimmed.slice(2))}</span>
        </div>
      );
      continue;
    }

    elements.push(
      <p key={idx} className="text-sm text-zinc-700 mb-3 leading-relaxed">
        {parseInlineMarkdown(line)}
      </p>
    );
  }

  // Handle unclosed code block
  if (inCodeBlock && codeBlockLines.length > 0) {
    elements.push(
      <pre key="code-unclosed" className="p-4 bg-zinc-950 text-zinc-100 font-mono text-xs rounded-lg overflow-x-auto my-3 border border-zinc-800">
        <code>{codeBlockLines.join('\n')}</code>
      </pre>
    );
  }

  return elements;
};

export default function Dashboard() {
  const [prompt, setPrompt] = useState('');
  const [models, setModels] = useState<ModelOption[]>(FALLBACK_MODELS);
  const [model, setModel] = useState(FALLBACK_DEFAULT_MODEL);
  
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [showChatbox, setShowChatbox] = useState(true);
  const [videoHistory, setVideoHistory] = useState<VideoRecord[]>([]);
  
  // Chatbox resizing states
  const [chatboxWidth, setChatboxWidth] = useState(450);
  const [isResizing, setIsResizing] = useState(false);
  
  // PDF / Mindmap states
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);
  const [mindmapData, setMindmapData] = useState<MindmapData | null>(null);
  const [mindmapId, setMindmapId] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [generatingMap, setGeneratingMap] = useState(false);

  // Node popup
  const [selectedNode, setSelectedNode] = useState<MindmapNode | null>(null);
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);
  const [nodeDescription, setNodeDescription] = useState<string>('');
  const [nodeVideoUrl, setNodeVideoUrl] = useState<string | null>(null);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoStages, setVideoStages] = useState<string[]>([]);
  const [nodeVideoCache, setNodeVideoCache] = useState<Map<string, NodeVideoCacheRecord>>(new Map());
  const [nodeModel, setNodeModel] = useState('gemini-2.5-flash');
  const [showNodeModelPicker, setShowNodeModelPicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const nodeModelPickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCloseMindMap = async () => {
    setSelectedDoc(null);
    setMindmapData(null);

    if (activeSessionId) {
      await supabase
        .from('chat_sessions')
        .update({ document_id: null })
        .eq('id', activeSessionId);
      setSessions(prev =>
        prev.map(s =>
          s.id === activeSessionId
            ? {
                ...s,
                document_id: null,
                document_name: undefined,
              }
            : s
        )
      );
    }
  };

  // Load sessions from Supabase
  const fetchSessionsFromSupabase = async (docsList?: DocumentRecord[]) => {
    try {
      const currentDocs = docsList || documents;
      const { data: sessData, error: sessErr } = await supabase
        .from('chat_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (sessErr) throw sessErr;

      let allSessions = sessData ? [...sessData] : [];

      // Map doc IDs to names
      const docMap = new Map((currentDocs || []).map(d => [d.id, d.filename]));

      // Link any documents that do not have an associated chat session in Supabase.
      const associatedDocIds = new Set(
        allSessions.map((s: any) => s.document_id).filter(Boolean)
      );
      
      const missingDocs = (currentDocs || []).filter(d => !associatedDocIds.has(d.id));

      if (missingDocs.length > 0) {
        for (const doc of missingDocs) {
          try {
            const { data: newSess, error: newSessErr } = await supabase
              .from('chat_sessions')
              .insert({
                id: crypto.randomUUID(),
                title: doc.filename,
                document_id: doc.id,
                created_at: doc.created_at || new Date().toISOString()
              })
              .select()
              .single();
            
            if (!newSessErr && newSess) {
              allSessions.push(newSess);
            }
          } catch (insertErr) {
            console.error("Failed to auto-create session for doc:", insertErr);
          }
        }
        // Re-sort allSessions by created_at descending if we added new ones
        allSessions.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }

      if (allSessions.length === 0) {
        // Fallback: check localStorage for migration
        const saved = localStorage.getItem('visualearn_sessions');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const migratedSessions = [];
              for (const s of parsed) {
                const { data: newSess, error: newSessErr } = await supabase
                  .from('chat_sessions')
                  .insert({
                    id: s.id,
                    title: s.title,
                    created_at: s.timestamp || new Date().toISOString()
                  })
                  .select()
                  .single();
                
                if (!newSessErr && newSess) {
                  if (s.messages && s.messages.length > 0) {
                    const msgs = s.messages.map((m: any) => ({
                      session_id: newSess.id,
                      role: m.role,
                      content: m.content,
                      video_url: m.videoUrl,
                      video_filename: m.videoFilename,
                      created_at: m.timestamp || new Date().toISOString()
                    }));
                    await supabase.from('chat_messages').insert(msgs);
                  }
                  migratedSessions.push({
                    ...newSess,
                    messages: s.messages || [],
                    timestamp: new Date(newSess.created_at)
                  });
                }
              }
              if (migratedSessions.length > 0) {
                setSessions(migratedSessions);
                setActiveSessionId(migratedSessions[0].id);
                localStorage.removeItem('visualearn_sessions');
                return;
              }
            }
          } catch (migrationErr) {
            console.error("Migration failed:", migrationErr);
          }
        }

        // Create default first session in Supabase
        const defaultId = crypto.randomUUID();
        const { data: defaultSess, error: defaultSessErr } = await supabase
          .from('chat_sessions')
          .insert({
            id: defaultId,
            title: 'New Chat'
          })
          .select()
          .single();
        
        if (!defaultSessErr && defaultSess) {
          const newSess: ChatSession = {
            id: defaultSess.id,
            title: defaultSess.title,
            messages: [],
            document_id: null,
            timestamp: new Date(defaultSess.created_at)
          };
          setSessions([newSess]);
          setActiveSessionId(newSess.id);
        }
        return;
      }

      const formattedSessions: ChatSession[] = allSessions.map((s: any) => {
        let docId = s.document_id;
        if (!docId) {
          const matchingDoc = (currentDocs || []).find(d => d.filename === s.title);
          if (matchingDoc) {
            docId = matchingDoc.id;
            // Link session in Supabase database asynchronously
            supabase.from('chat_sessions').update({ document_id: docId }).eq('id', s.id).then();
          }
        }

        return {
          id: s.id,
          title: s.title,
          messages: [],
          document_id: docId,
          document_name: docId ? docMap.get(docId) || 'Linked Document' : undefined,
          timestamp: new Date(s.created_at)
        };
      });

      setSessions(formattedSessions);

      const savedActiveId = localStorage.getItem('visualearn_active_session_id');
      if (savedActiveId && formattedSessions.some(s => s.id === savedActiveId)) {
        const activeSess = formattedSessions.find(s => s.id === savedActiveId);
        if (activeSess) {
          handleSelectSession(activeSess, currentDocs);
        }
      } else if (formattedSessions.length > 0) {
        handleSelectSession(formattedSessions[0], currentDocs);
      }

    } catch (err) {
      console.error("Error loading sessions from Supabase:", err);
    }
  };

  const saveMessageToSupabase = async (sessionId: string, message: ChatMessage) => {
    try {
      await supabase.from('chat_messages').insert({
        id: message.id,
        session_id: sessionId,
        role: message.role,
        content: message.content,
        video_url: message.videoUrl || null,
        video_filename: message.videoFilename || null,
        created_at: message.timestamp.toISOString()
      });
    } catch (err) {
      console.error("Error saving message to Supabase:", err);
    }
  };

  const updateMessageInSupabase = async (messageId: string, updates: Partial<ChatMessage>) => {
    try {
      await supabase.from('chat_messages').update({
        content: updates.content,
        video_url: updates.videoUrl || null,
        video_filename: updates.videoFilename || null,
        role: updates.role
      }).eq('id', messageId);
    } catch (err) {
      console.error("Error updating message in Supabase:", err);
    }
  };

  async function handleSelectSession(session: ChatSession, docsOverride?: DocumentRecord[]) {
    setActiveSessionId(session.id);
    localStorage.setItem('visualearn_active_session_id', session.id);
    const availableDocs = docsOverride || documents;

    try {
      const { data: msgData, error: msgErr } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', session.id)
        .order('created_at', { ascending: true });

      if (!msgErr && msgData) {
        const sessionMsgs = msgData.map((m: any) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant' | 'error',
          content: m.content,
          videoUrl: m.video_url,
          videoFilename: m.video_filename,
          timestamp: new Date(m.created_at)
        }));

        session.messages = sessionMsgs;
        setSessions(prev => prev.map(s => s.id === session.id ? { ...s, messages: sessionMsgs } : s));

        // Self-healing: check for stuck assistant messages where the browser was refreshed/closed during video generation
        let hasUpdates = false;
        const repairedMsgs = [...sessionMsgs];
        for (let i = 0; i < repairedMsgs.length; i++) {
          const msg = repairedMsgs[i];
          if (msg.role === 'assistant' && msg.content === 'Generating your animation...' && !msg.videoUrl) {
            let userPrompt = '';
            for (let j = i - 1; j >= 0; j--) {
              if (repairedMsgs[j].role === 'user') {
                userPrompt = repairedMsgs[j].content;
                break;
              }
            }
            if (userPrompt) {
              try {
                let slug = userPrompt.replace(/[^a-zA-Z0-9\s]/g, '');
                slug = slug.trim().replace(/\s+/g, '_');
                const slugPrefix = slug.slice(0, 40).replace(/_+$/, '').toLowerCase() + '_';
                
                const vRes = await fetch('http://localhost:8000/videos');
                if (vRes.ok) {
                  const vData = await vRes.json();
                  const matchingVideo = (vData.videos || []).find((v: any) => v.filename.toLowerCase().startsWith(slugPrefix));
                  if (matchingVideo) {
                    msg.content = "Here's your animation:";
                    msg.videoUrl = `${matchingVideo.url}?t=${Date.now()}`;
                    msg.videoFilename = matchingVideo.filename;
                    
                    await supabase.from('chat_messages').update({
                      content: msg.content,
                      video_url: matchingVideo.url,
                      video_filename: matchingVideo.filename
                    }).eq('id', msg.id);
                    
                    hasUpdates = true;
                  }
                }
              } catch (recoverErr) {
                console.error("Self-healing video recovery failed:", recoverErr);
              }
            }
          }
        }
        if (hasUpdates) {
          session.messages = repairedMsgs;
          setSessions(prev => prev.map(s => s.id === session.id ? { ...s, messages: repairedMsgs } : s));
        }
      }
    } catch (err) {
      console.error("Error loading messages for session:", err);
    }

    let docId = session.document_id;
    if (!docId) {
      const matchingDoc = availableDocs.find(
        d => d.filename === session.title || 
             session.title.includes(d.filename) || 
             d.filename.includes(session.title)
      );
      if (matchingDoc) {
        docId = matchingDoc.id;
        session.document_id = docId;
        session.document_name = matchingDoc.filename;
        // Asynchronously update in Supabase to link permanently
        supabase.from('chat_sessions').update({ document_id: docId }).eq('id', session.id).then();
      }
    }

    if (docId) {
      const doc = availableDocs.find(d => d.id === docId);
      if (doc) {
        setSelectedDoc(doc);
        await loadMindmapForDocument(doc.id, { generateIfMissing: false });
      } else {
        const dummyDoc = {
          id: docId,
          filename: session.document_name || 'Linked Document',
          page_count: 0,
          total_chunks: 0,
          created_at: new Date().toISOString()
        };
        setSelectedDoc(dummyDoc);
        await loadMindmapForDocument(docId, { generateIfMissing: false });
      }
    } else {
      setSelectedDoc(null);
      setMindmapData(null);
      setMindmapId(null);
      setNodes([]);
      setEdges([]);
    }
  }

  // Handle mouse events for resizing the chatbox
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 320 && newWidth < 800) {
        setChatboxWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem('visualearn_active_session_id', activeSessionId);
    }
  }, [activeSessionId]);

  useEffect(() => {
    let isMounted = true;
    const loadModels = async () => {
      try {
        const res = await fetch('http://localhost:8000/models');
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;
        if (Array.isArray(data.models) && data.models.length > 0) {
          setModels(data.models);
        }
        if (typeof data.default_model === 'string') {
          setModel(data.default_model);
        }
      } catch {
        // Keep fallback models
      }
    };
    loadModels();
    loadVideoHistory();
    return () => { isMounted = false; };
  }, []);

  // Close model pickers on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as any)) {
        setShowModelPicker(false);
      }
      if (nodeModelPickerRef.current && !nodeModelPickerRef.current.contains(e.target as any)) {
        setShowNodeModelPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Active session and its messages
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const messages = activeSession ? activeSession.messages : [];

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  const handleTextareaInput = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    }
  }, []);

  const loadVideoHistory = async () => {
    try {
      const res = await fetch('http://localhost:8000/videos');
      if (!res.ok) return;
      const data = await res.json();
      setVideoHistory(data.videos || []);
    } catch {}
  };

  // Load documents on mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchDocumentsOnly = async (): Promise<DocumentRecord[]> => {
    const res = await fetch('http://localhost:8000/documents');
    if (!res.ok) throw new Error('Failed to fetch documents');
    const data = await res.json();
    const docs = data.documents || [];
    setDocuments(docs);
    return docs;
  };

  const fetchInitialData = async () => {
    try {
      const docs = await fetchDocumentsOnly();
      await fetchSessionsFromSupabase(docs);
    } catch {
      console.error('Failed to fetch documents');
      await fetchSessionsFromSupabase([]);
    }
  };

  const applyMindmapResult = async (result: any) => {
    const mapData = result.mindmap_data as MindmapData;
    setMindmapData(mapData);
    setMindmapId(result.id);

    const { data: nodeVids } = await supabase
       .from('node_videos')
       .select('node_id, video_url, description')
       .eq('mindmap_id', result.id);

    const cache = new Map<string, NodeVideoCacheRecord>();
    (nodeVids || []).forEach((nv: NodeVideoCacheRecord) => {
      cache.set(nv.node_id, nv);
    });
    setNodeVideoCache(cache);

    const generatedNodeIds = new Set(
      (nodeVids || [])
        .filter((nv: NodeVideoCacheRecord) => Boolean(nv.video_url))
        .map((nv: NodeVideoCacheRecord) => nv.node_id)
    );

    const { nodes: flowNodes, edges: flowEdges } = treeToFlow(mapData.root, generatedNodeIds);
    setNodes(flowNodes);
    setEdges(flowEdges);
  };

  const handleFileUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) return;
    setUploading(true);
    setUploadProgress(10);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress((p) => Math.min(p + 8, 85));
      }, 500);

      const res = await fetch('http://localhost:8000/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(95);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Upload failed');
      }

      const result = await res.json();
      setUploadProgress(100);

      const newDoc = {
        id: result.document_id,
        filename: result.filename,
        page_count: result.page_count,
        total_chunks: result.total_chunks,
        created_at: new Date().toISOString(),
      };
      setDocuments(prev => [newDoc, ...prev.filter(doc => doc.id !== newDoc.id)]);
      setSelectedDoc(newDoc);

      let targetSessionId = activeSessionId;
      const shouldReuseActive =
        activeSession &&
        (activeSession.title === 'New Chat' || (!activeSession.document_id && activeSession.messages.length === 0));

      if (!targetSessionId || !shouldReuseActive) {
        const newSessionId = crypto.randomUUID();
        const { data: createdSession, error: createErr } = await supabase
          .from('chat_sessions')
          .insert({
            id: newSessionId,
            title: result.filename,
            document_id: result.document_id,
          })
          .select()
          .single();

        if (createErr) throw createErr;

        const newSession: ChatSession = {
          id: createdSession.id,
          title: createdSession.title,
          messages: [],
          document_id: result.document_id,
          document_name: result.filename,
          timestamp: new Date(createdSession.created_at),
        };
        setSessions(prev => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
        localStorage.setItem('visualearn_active_session_id', newSession.id);
        targetSessionId = newSession.id;
      } else {
        await supabase
          .from('chat_sessions')
          .update({
            document_id: result.document_id,
            title: result.filename,
          })
          .eq('id', targetSessionId);
          
        setSessions(prev => prev.map(s => s.id === targetSessionId ? {
          ...s,
          document_id: result.document_id,
          document_name: result.filename,
          title: result.filename,
        } : s));
      }

      await loadMindmapForDocument(newDoc.id, { generateIfMissing: true });

      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 500);
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploading(false);
      setUploadProgress(0);
      alert(err.message || 'Failed to upload PDF');
    }
  };

  async function loadMindmapForDocument(
    docId: string,
    options: { generateIfMissing?: boolean } = {}
  ) {
    setMindmapData(null);
    setMindmapId(null);
    setNodes([]);
    setEdges([]);
    setNodeVideoCache(new Map());

    try {
      const existingRes = await fetch(`http://localhost:8000/mindmap/${docId}`);
      if (existingRes.ok) {
        const result = await existingRes.json();
        await applyMindmapResult(result);
        return;
      }

      if (!options.generateIfMissing) {
        return;
      }

      setGeneratingMap(true);
      const res = await fetch(`http://localhost:8000/generate-mindmap/${docId}`, { method: 'POST' });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to generate mindmap');
      }

      const result = await res.json();
      await applyMindmapResult(result);
    } catch (err: unknown) {
      console.error('Mindmap error:', err);
      alert(getErrorMessage(err, 'Failed to generate mindmap'));
    } finally {
      setGeneratingMap(false);
    }
  }

  const onNodeClick = useCallback(
    async (_: unknown, node: Node) => {
      const nodeData = node.data.nodeData as MindmapNode;
      if (!nodeData || node.data.isRoot) return;

      setSelectedNode(nodeData);
      setNodeDescription(nodeData.description);
      setNodeVideoUrl(null);
      setVideoError(null);
      setVideoStages([]);
      setGeneratingVideo(false);
      setGeneratingDescription(false);
      setNodeDialogOpen(true);

      const cached = nodeVideoCache.get(nodeData.id);
      if (cached) {
        if (cached.video_url) setNodeVideoUrl(cached.video_url);
        if (cached.description) {
          setNodeDescription(cached.description);
          const storedError = extractManimError(cached.description);
          if (storedError) setVideoError(storedError.slice(0, 300));
        }
      }
    },
    [nodeVideoCache]
  );

  const handleGenerateNodeVideo = async () => {
    if (!selectedNode || !selectedDoc || !mindmapId) return;
    setGeneratingVideo(true);
    setVideoError(null);
    setVideoStages(['Starting video generation']);

    try {
      const res = await fetch('http://localhost:8000/generate-node-video-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node_id: selectedNode.id,
          node_label: selectedNode.label,
          node_description: selectedNode.description,
          document_id: selectedDoc.id,
          mindmap_id: mindmapId,
          model: nodeModel,
          force: true,
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || 'Video generation failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let result: NodeVideoStreamResult | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === 'stage') {
            setVideoStages((prev) => [...prev, event.stage]);
          } else if (event.type === 'done') {
            result = event;
          } else if (event.type === 'error') {
            throw new Error(event.error || 'Video generation failed');
          }
        }
      }

      if (!result) throw new Error('Video generation finished without a result');

      if (Array.isArray(result.stages)) setVideoStages(result.stages);
      if (result.description) {
        setNodeDescription(result.description);
        setNodeVideoCache(prev => {
          const next = new Map(prev);
          next.set(selectedNode.id, {
            node_id: selectedNode.id,
            video_url: result.video_url || next.get(selectedNode.id)?.video_url || null,
            description: result.description || null,
          });
          return next;
        });
      }
      if (result.video_url) {
        setNodeVideoUrl(result.video_url);
        setNodeVideoCache(prev => {
          const next = new Map(prev);
          next.set(selectedNode.id, {
            node_id: selectedNode.id,
            video_url: result.video_url || null,
            description: result.description || next.get(selectedNode.id)?.description || null,
          });
          return next;
        });
        // Mark node as generated locally so it immediately turns green on the canvas
        setNodes((prevNodes) =>
          prevNodes.map((n) => {
            if (n.id === selectedNode.id) {
              return {
                ...n,
                data: {
                  ...n.data,
                  isGenerated: true,
                },
              };
            }
            return n;
          })
        );
      }
      if (result.error) setVideoError(result.error);
    } catch (err: unknown) {
      setVideoError(getErrorMessage(err, 'Failed to generate video'));
    } finally {
      setGeneratingVideo(false);
    }
  };

  const handleGenerateNodeDescription = async () => {
    if (!selectedNode || !selectedDoc || !mindmapId) return;
    setGeneratingDescription(true);
    setVideoError(null);

    try {
      const res = await fetch('http://localhost:8000/generate-node-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node_id: selectedNode.id,
          node_label: selectedNode.label,
          node_description: selectedNode.description,
          document_id: selectedDoc.id,
          mindmap_id: mindmapId,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.detail || 'Description generation failed');

      if (result.description) {
        setNodeDescription(result.description);
        setNodeVideoCache(prev => {
          const next = new Map(prev);
          next.set(selectedNode.id, {
            node_id: selectedNode.id,
            video_url: result.video_url || next.get(selectedNode.id)?.video_url || null,
            description: result.description,
          });
          return next;
        });
      }
      if (result.video_url) setNodeVideoUrl(result.video_url);
    } catch (err: unknown) {
      setVideoError(getErrorMessage(err, 'Failed to generate description'));
    } finally {
      setGeneratingDescription(false);
    }
  };

  const startNewChat = async () => {
    const newId = crypto.randomUUID();
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          id: newId,
          title: 'New Chat'
        })
        .select()
        .single();
      
      if (error) throw error;
      
      const newSession: ChatSession = {
        id: data.id,
        title: data.title,
        messages: [],
        document_id: null,
        timestamp: new Date(data.created_at)
      };
      
      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setSelectedDoc(null);
      setMindmapData(null);
      
      if (window.innerWidth < 768) {
        setShowHistory(false);
      }
    } catch (err) {
      console.error("Error creating new chat:", err);
    }
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId);
      
      if (error) throw error;
      
      const updated = sessions.filter(s => s.id !== sessionId);
      if (updated.length === 0) {
        const defaultId = crypto.randomUUID();
        const { data: defaultSess } = await supabase
          .from('chat_sessions')
          .insert({
            id: defaultId,
            title: 'New Chat'
          })
          .select()
          .single();
          
        if (defaultSess) {
          const newSess: ChatSession = {
            id: defaultSess.id,
            title: defaultSess.title,
            messages: [],
            document_id: null,
            timestamp: new Date(defaultSess.created_at)
          };
          setSessions([newSess]);
          setActiveSessionId(newSess.id);
          setSelectedDoc(null);
          setMindmapData(null);
        }
      } else {
        setSessions(updated);
        if (activeSessionId === sessionId) {
          // Select the new active session
          const activeSess = updated[0];
          setActiveSessionId(activeSess.id);
          localStorage.setItem('visualearn_active_session_id', activeSess.id);
          if (activeSess.document_id) {
            const doc = documents.find(d => d.id === activeSess.document_id);
            if (doc) {
              setSelectedDoc(doc);
              await loadMindmapForDocument(doc.id, { generateIfMissing: false });
            }
          } else {
            setSelectedDoc(null);
            setMindmapData(null);
            setMindmapId(null);
            setNodes([]);
            setEdges([]);
          }
        }
      }
    } catch (err) {
      console.error("Error deleting session:", err);
    }
  };

  const handleOpenHistoryVideo = async (v: VideoRecord) => {
    // Check if an active session already exists for this video filename
    const existing = sessions.find((s) => s.videoFilename === v.filename);
    if (existing) {
      setActiveSessionId(existing.id);
      if (window.innerWidth < 768) {
        setShowHistory(false);
      }
      return;
    }

    // Extract prompt from filename
    const promptText = v.filename
      .replace(/_\d{8}_\d{6}_[a-f0-9]+\.mp4$/, '')
      .replace(/_/g, ' ');

    const newSessionId = crypto.randomUUID();
    
    try {
      const { data: sess, error: sessErr } = await supabase
        .from('chat_sessions')
        .insert({
          id: newSessionId,
          title: promptText,
          created_at: v.created_at
        })
        .select()
        .single();
        
      if (sessErr) throw sessErr;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: promptText,
        timestamp: new Date(v.created_at),
      };
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'From history:',
        videoUrl: `${v.url}?t=${Date.now()}`,
        videoFilename: v.filename,
        timestamp: new Date(v.created_at),
      };

      await saveMessageToSupabase(newSessionId, userMsg);
      await saveMessageToSupabase(newSessionId, assistantMsg);

      const newSession: ChatSession = {
        id: newSessionId,
        title: promptText,
        messages: [userMsg, assistantMsg],
        videoFilename: v.filename,
        timestamp: new Date(v.created_at),
      };

      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSessionId);
      
      if (window.innerWidth < 768) {
        setShowHistory(false);
      }
    } catch (e) {
      console.error("Failed to create history session in Supabase:", e);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt.trim(),
      timestamp: new Date(),
    };

    const loadingMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: 'Generating your animation...',
      isLoading: true,
      timestamp: new Date(),
    };

    let targetSessionId = activeSessionId;
    if (!targetSessionId) {
      const newId = crypto.randomUUID();
      const newTitle = userMsg.content.slice(0, 30) + (userMsg.content.length > 30 ? '...' : '');
      const { data: sess, error } = await supabase
        .from('chat_sessions')
        .insert({
          id: newId,
          title: newTitle
        })
        .select()
        .single();
        
      if (error) {
        console.error("Error creating session in Supabase:", error);
        return;
      }
      
      const newSession: ChatSession = {
        id: sess.id,
        title: sess.title,
        messages: [userMsg, loadingMsg],
        timestamp: new Date(sess.created_at)
      };
      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      targetSessionId = newSession.id;
    } else {
      // Update session title in Supabase if it was 'New Chat'
      const activeSess = sessions.find(s => s.id === targetSessionId);
      if (activeSess && activeSess.title === 'New Chat') {
        const newTitle = userMsg.content.slice(0, 30) + (userMsg.content.length > 30 ? '...' : '');
        await supabase
          .from('chat_sessions')
          .update({ title: newTitle })
          .eq('id', targetSessionId);
          
        setSessions((prevSessions) =>
          prevSessions.map((s) => {
            if (s.id === targetSessionId) {
              return {
                ...s,
                title: newTitle,
                messages: [...s.messages, userMsg, loadingMsg],
              };
            }
            return s;
          })
        );
      } else {
        setSessions((prevSessions) =>
          prevSessions.map((s) => {
            if (s.id === targetSessionId) {
              return {
                ...s,
                messages: [...s.messages, userMsg, loadingMsg],
              };
            }
            return s;
          })
        );
      }
    }

    await saveMessageToSupabase(targetSessionId, userMsg);
    await saveMessageToSupabase(targetSessionId, loadingMsg);

    setPrompt('');
    setIsLoading(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const res = await fetch('http://localhost:8000/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ prompt: userMsg.content, model }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to generate');
      if (!data.video_url) throw new Error('No video_url returned from backend');

      const cacheBustedUrl = `${data.video_url}?t=${Date.now()}`;

      setSessions((prevSessions) =>
        prevSessions.map((s) => {
          if (s.id === targetSessionId) {
            return {
              ...s,
              videoFilename: data.video_filename, // associate this session with the new video filename
              messages: s.messages.map((m) =>
                m.id === loadingMsg.id
                  ? {
                      ...m,
                      content: "Here's your animation:",
                      videoUrl: cacheBustedUrl,
                      videoFilename: data.video_filename,
                      modelUsed: data.model_used || model,
                      isLoading: false,
                    }
                  : m
              ),
            };
          }
          return s;
        })
      );
      
      await updateMessageInSupabase(loadingMsg.id, {
        content: "Here's your animation:",
        videoUrl: cacheBustedUrl,
        videoFilename: data.video_filename,
      });

      // Reload history sidebar list to show new video
      loadVideoHistory();
    } catch (err: any) {
      setSessions((prevSessions) =>
        prevSessions.map((s) => {
          if (s.id === targetSessionId) {
            return {
              ...s,
              messages: s.messages.map((m) =>
                m.id === loadingMsg.id
                  ? {
                      ...m,
                      role: 'error',
                      content: err.message || 'Something went wrong',
                      isLoading: false,
                    }
                  : m
              ),
            };
          }
          return s;
        })
      );

      await updateMessageInSupabase(loadingMsg.id, {
        role: 'error',
        content: err.message || 'Something went wrong',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDocAsk = async () => {
    if (!prompt.trim() || isLoading || !selectedDoc) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt.trim(),
      timestamp: new Date(),
    };

    const loadingMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: 'Searching PDF content...',
      isLoading: true,
      timestamp: new Date(),
    };

    let targetSessionId = activeSessionId;
    if (!targetSessionId) {
      const newId = crypto.randomUUID();
      const newTitle = userMsg.content.slice(0, 30) + (userMsg.content.length > 30 ? '...' : '');
      const { data: sess, error } = await supabase
        .from('chat_sessions')
        .insert({
          id: newId,
          title: newTitle,
          document_id: selectedDoc.id
        })
        .select()
        .single();
        
      if (error) {
        console.error("Error creating session in Supabase:", error);
        return;
      }
      
      const newSession: ChatSession = {
        id: sess.id,
        title: sess.title,
        messages: [userMsg, loadingMsg],
        document_id: selectedDoc.id,
        document_name: selectedDoc.filename,
        timestamp: new Date(sess.created_at)
      };
      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      targetSessionId = newSession.id;
    } else {
      // Update session title in Supabase if it was 'New Chat'
      const activeSess = sessions.find(s => s.id === targetSessionId);
      if (activeSess && activeSess.title === 'New Chat') {
        const newTitle = userMsg.content.slice(0, 30) + (userMsg.content.length > 30 ? '...' : '');
        await supabase
          .from('chat_sessions')
          .update({ 
            title: newTitle,
            document_id: selectedDoc.id
          })
          .eq('id', targetSessionId);
          
        setSessions((prevSessions) =>
          prevSessions.map((s) => {
            if (s.id === targetSessionId) {
              return {
                ...s,
                title: newTitle,
                document_id: selectedDoc.id,
                document_name: selectedDoc.filename,
                messages: [...s.messages, userMsg, loadingMsg],
              };
            }
            return s;
          })
        );
      } else {
        // Link to the doc in Supabase if not already linked
        if (activeSess && !activeSess.document_id) {
          await supabase
            .from('chat_sessions')
            .update({ document_id: selectedDoc.id })
            .eq('id', targetSessionId);
            
          setSessions((prevSessions) =>
            prevSessions.map((s) => {
              if (s.id === targetSessionId) {
                return {
                  ...s,
                  document_id: selectedDoc.id,
                  document_name: selectedDoc.filename,
                  messages: [...s.messages, userMsg, loadingMsg],
                };
              }
              return s;
            })
          );
        } else {
          setSessions((prevSessions) =>
            prevSessions.map((s) => {
              if (s.id === targetSessionId) {
                return {
                  ...s,
                  messages: [...s.messages, userMsg, loadingMsg],
                };
              }
              return s;
            })
          );
        }
      }
    }

    await saveMessageToSupabase(targetSessionId, userMsg);
    await saveMessageToSupabase(targetSessionId, loadingMsg);

    setPrompt('');
    setIsLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const res = await fetch('http://localhost:8000/ask-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: selectedDoc.id,
          question: userMsg.content,
          model: model,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to get answer');

      setSessions((prevSessions) =>
        prevSessions.map((s) => {
          if (s.id === targetSessionId) {
            return {
              ...s,
              messages: s.messages.map((m) =>
                m.id === loadingMsg.id
                  ? {
                      ...m,
                      content: data.answer,
                      isLoading: false,
                    }
                  : m
              ),
            };
          }
          return s;
        })
      );

      await updateMessageInSupabase(loadingMsg.id, {
        content: data.answer,
      });
    } catch (err: any) {
      setSessions((prevSessions) =>
        prevSessions.map((s) => {
          if (s.id === targetSessionId) {
            return {
              ...s,
              messages: s.messages.map((m) =>
                m.id === loadingMsg.id
                  ? {
                      ...m,
                      role: 'error',
                      content: err.message || 'Something went wrong',
                      isLoading: false,
                    }
                  : m
              ),
            };
          }
          return s;
        })
      );

      await updateMessageInSupabase(loadingMsg.id, {
        role: 'error',
        content: err.message || 'Something went wrong',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (selectedDoc) {
        handleDocAsk();
      } else {
        handleGenerate();
      }
    }
  };

  const selectedModel = models.find((m) => m.id === model);

  const renderChatArea = (isSidebar: boolean) => {
    return (
      <div className="flex-1 flex flex-col h-full relative">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-6 h-[60px] min-h-[60px] bg-[#fdfbf7]/80 backdrop-blur-md border-b border-zinc-200 relative z-20">
          <div className="flex items-center gap-3">
            {!showHistory && !isSidebar && (
              <button
                className="flex items-center justify-center w-9 h-9 rounded-full text-zinc-600 cursor-pointer"
                onClick={() => {
                  loadVideoHistory();
                  setShowHistory(true);
                }}
                title="Open Sidebar"
              >
                <Menu size={20} />
              </button>
            )}
            
            <div className="flex items-center gap-2">
              <span className="text-[16px] font-bold text-zinc-900 tracking-tight">
                {isSidebar ? 'Chat Assistant' : 'VisualEarn'}
              </span>
            </div>
          </div>

          {selectedDoc && isSidebar && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-zinc-500 gap-1.5"
              onClick={() => setShowChatbox(false)}
            >
              <X size={14} />
              Chatbox
            </Button>
          )}
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth custom-scrollbar pb-32">
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
                <h2 className={`${isSidebar ? 'text-2xl' : 'text-4xl md:text-5xl'} font-bold text-zinc-900 mb-4 tracking-tight`}>
                  {isSidebar ? 'Ask about this document' : 'What would you like to visualize?'}
                </h2>
                <p className="text-zinc-600 max-w-[500px] text-sm leading-relaxed mb-8">
                  {isSidebar 
                    ? 'Enter your questions and we will use semantic search to answer based on the PDF content.' 
                    : "Describe any math, physics, or computer science concept and I'll create a beautiful animated video using Manim."}
                </p>
                
                {!isSidebar && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
                    {examplePrompts.map((ep, idx) => (
                      <button
                        key={idx}
                        className="flex flex-col gap-2 p-4 bg-white border border-zinc-200 rounded-2xl text-left cursor-pointer shadow-sm shadow-black/5"
                        onClick={() => setPrompt(ep)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 rounded-lg bg-red-50 text-red-600">
                            <Play size={14} className="ml-0.5" />
                          </div>
                          <span className="text-sm font-medium text-zinc-700">{ep}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col space-y-6">
                {messages.map((msg, i) => (
                  <div
                    key={msg.id}
                    className={`flex gap-4 w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role !== 'user' && (
                      <div className="shrink-0 w-8 h-8 mt-1 rounded-xl bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center shadow-md shadow-red-600/20 border border-red-500">
                        {msg.role === 'error' ? <AlertCircle size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
                      </div>
                    )}
                    
                    <div
                      className={`relative max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-4 ${
                        msg.role === 'user'
                          ? 'bg-red-600 text-white rounded-tr-sm shadow-md shadow-red-600/20'
                          : msg.role === 'error'
                          ? 'bg-red-50 text-red-800 border border-red-200 rounded-tl-sm'
                          : 'bg-white text-zinc-800 rounded-tl-sm border border-zinc-200 shadow-lg shadow-black/5'
                      }`}
                    >
                      {msg.isLoading ? (
                        <div className="flex items-center gap-3">
                          <span className="w-2 h-2 rounded-full bg-red-600" />
                          <span className="text-sm font-medium text-red-700">
                            {isSidebar ? 'Searching PDF content' : 'Rendering video'}
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <p className={`text-[15px] leading-relaxed break-words whitespace-pre-wrap ${msg.role === 'error' ? 'text-red-800 font-medium' : ''}`}>
                            {msg.content}
                          </p>
                          
                          {msg.videoUrl && (
                            <div className="mt-4 rounded-xl overflow-hidden border border-zinc-200 bg-zinc-50 shadow-md">
                              <video
                                src={msg.videoUrl}
                                controls
                                autoPlay
                                loop
                                playsInline
                                className="w-full max-h-[500px] block object-contain bg-zinc-100"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} className="h-4" />
              </div>
            )}
          </div>
        </div>

        {/* Floating Input Area */}
        <div className="absolute bottom-0 left-0 w-full p-4 md:p-6 bg-gradient-to-t from-[#fdfbf7] via-[#fdfbf7]/90 to-transparent pointer-events-none z-10">
          <div className="max-w-3xl mx-auto w-full pointer-events-auto">
            <div className="relative bg-white/90 backdrop-blur-xl border border-zinc-200 rounded-2xl shadow-xl shadow-black/5 overflow-visible">
              <div className="flex flex-col relative z-10">
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    handleTextareaInput();
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={isSidebar ? "Ask a question about this PDF..." : "Describe an animation to generate..."}
                  rows={1}
                  className="w-full bg-transparent border-0 text-zinc-900 placeholder-zinc-400 text-[15px] p-4 resize-none outline-none focus:ring-0 leading-relaxed min-h-[56px] max-h-[200px] custom-scrollbar"
                  disabled={isLoading}
                />
                
                <div className="flex items-center justify-between p-3 pt-0">
                  <div className="flex items-center gap-2">
                    <div className="relative" ref={modelPickerRef}>
                      <button
                        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 border border-zinc-200 text-zinc-600 rounded-lg text-xs font-medium cursor-pointer"
                        onClick={() => setShowModelPicker(!showModelPicker)}
                      >
                        <span className="w-2 h-2 rounded-full bg-red-50 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
                        <span>{selectedModel?.label || 'Model'}</span>
                        <ChevronDown size={14} className={`text-zinc-400 ${showModelPicker ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {showModelPicker && (
                        <div className="absolute bottom-full left-0 mb-3 w-64 bg-white border border-zinc-200 rounded-xl shadow-xl p-2 z-50 origin-bottom-left">
                          {models.map((option) => (
                            <button
                              key={option.id}
                              className={`flex items-center justify-between w-full px-3 py-2.5 text-left rounded-lg text-sm cursor-pointer ${
                                option.id === model 
                                  ? 'bg-red-50 text-red-700 font-medium' 
                                  : 'text-zinc-600'
                              }`}
                              onClick={() => {
                                  setModel(option.id);
                                  setShowModelPicker(false);
                              }}
                            >
                              <div className="flex flex-col gap-0.5">
                                <span>{option.label}</span>
                              </div>
                              {option.id === model && <Check size={16} className="text-red-600" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Paperclip upload button */}
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => !uploading && fileInputRef.current?.click()}
                      className="flex items-center justify-center p-2 bg-zinc-50 border border-zinc-200 text-zinc-600 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Upload PDF"
                    >
                      {uploading ? (
                        <Loader2 size={14} className="animate-spin text-red-500" />
                      ) : (
                        <Paperclip size={14} className="text-zinc-500" />
                      )}
                    </button>

                    {/* Status message next to paperclip icon */}
                    {(uploading || generatingMap) && (
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500 ml-1">
                        <span className="font-medium text-red-600 bg-red-50/80 px-2.5 py-1 rounded-full border border-red-100 flex items-center gap-1.5 shadow-sm">
                          <Loader2 size={11} className="animate-spin text-red-500 shrink-0" />
                          <span>
                            {generatingMap 
                              ? "Generating mindmap..."
                              : uploadProgress < 30
                              ? "Uploading PDF..."
                              : uploadProgress < 50
                              ? "Chunking text..."
                              : uploadProgress < 85
                              ? "Embedding chunks..."
                              : "Saving data..."}
                          </span>
                        </span>
                        
                        {/* Tooltip explaining steps and slowness */}
                        <div className="group relative cursor-pointer flex items-center justify-center">
                          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-zinc-100 text-zinc-500 text-[10px] font-bold border border-zinc-200">?</span>
                          <div className="absolute bottom-full left-0 mb-2.5 hidden group-hover:block w-72 p-3.5 bg-zinc-900 text-white text-[11px] rounded-xl shadow-xl z-50 leading-relaxed pointer-events-none">
                            <p className="font-semibold mb-1 text-red-400">Mindmap Generation Steps:</p>
                            <ol className="list-decimal pl-4 space-y-1.5 text-zinc-300">
                              <li><strong>Extracting & Chunking:</strong> The PDF text is divided into readable chunks.</li>
                              <li><strong>Vector Embeddings:</strong> We run Gemini embeddings in parallel batches for high-dimensional semantic search.</li>
                              <li><strong>AI Mindmap:</strong> Gemini analyses all chunks to map out concepts.</li>
                            </ol>
                            <p className="mt-2 text-zinc-400 border-t border-zinc-800 pt-1.5">
                              Database syncing and Gemini API calls require a few seconds. We&apos;ve optimized this by batch-processing the embeddings.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Send Button */}
                  <button
                    onClick={isSidebar ? handleDocAsk : handleGenerate}
                    disabled={!prompt.trim() || isLoading}
                    className={`flex items-center justify-center w-10 h-10 rounded-xl ${
                      !prompt.trim() || isLoading
                        ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-md shadow-red-600/30 cursor-pointer'
                    }`}
                  >
                    {isLoading ? (
                      <Loader2 size={18} className="animate-spin text-white/80" />
                    ) : (
                      <Send size={18} className={!prompt.trim() ? 'ml-0' : 'ml-0.5'} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  

  const examplePrompts = [
    'A bouncing ball over a sine wave with trails',
    'Two planets orbiting each other',
    'Neural network architecture diagram',
    'Pythagorean theorem geometric proof',
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#fdfbf7] text-zinc-900 font-sans relative selection:bg-red-500/20">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
          e.target.value = '';
        }}
      />
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-red-600/10 blur-[120px]" />
        <div className="absolute top-[60%] -right-[10%] w-[60%] h-[60%] rounded-full bg-orange-400/10 blur-[150px]" />
      </div>

      {/* History Sidebar */}
      {showHistory && (
        <div className="flex flex-col bg-[#fdfbf7]/80 backdrop-blur-2xl border-r border-zinc-200 z-20 h-full w-[300px] relative">
          <div className="flex items-center justify-between px-5 py-4 h-[60px] min-h-[60px]">
            <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
              <History size={16} className="text-red-600" />
              History
            </h3>
            <button
              className="flex items-center justify-center w-8 h-8 rounded-full text-zinc-500 cursor-pointer"
              onClick={() => setShowHistory(false)}
            >
              <X size={18} />
            </button>
          </div>
          
          <div className="p-4 pb-2">
            <button
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-white border border-zinc-200 text-zinc-800 rounded-xl font-medium text-sm shadow-sm cursor-pointer"
              onClick={startNewChat}
            >
              <Plus size={16} className="text-red-600" />
              <span>New Chat</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-6 custom-scrollbar">
            {/* Active Sessions List */}
            <div>
              <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3 px-2">Active Chats</h4>
              {sessions.length === 0 ? (
                <p className="text-zinc-500 text-xs text-center py-4">No active chats</p>
              ) : (
                <div className="space-y-1">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className={`flex items-center justify-between w-full px-3 py-2.5 rounded-xl cursor-pointer text-sm ${
                        s.id === activeSessionId
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'text-zinc-600 border border-transparent'
                      }`}
                      onClick={() => handleSelectSession(s)}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <MessageSquare size={14} className={s.id === activeSessionId ? "text-red-600 shrink-0" : "text-zinc-400 shrink-0"} />
                        <span className="truncate font-medium">{s.title}</span>
                      </div>
                      <button
                        className="flex items-center justify-center p-1.5 rounded-lg text-zinc-400 cursor-pointer"
                        onClick={(e) => deleteSession(s.id, e)}
                        title="Delete chat"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Main Split Layout */}
      <div className="flex-1 flex h-full min-w-0 relative z-10">
        {selectedDoc ? (
          <>
            {/* Center Area: Mindmap Canvas */}
            <div className="flex-1 h-full min-w-0 relative border-r border-zinc-200">
              {generatingMap ? (
                <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
                  <Loader2 size={32} className="animate-spin text-red-600" />
                  <p className="text-sm font-semibold text-zinc-600">Generating structured mindmap...</p>
                </div>
              ) : (
                <MindmapCanvas
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodeClick={onNodeClick}
                  title={mindmapData?.title || selectedDoc.filename}
                  showHistory={showHistory}
                  setShowHistory={setShowHistory}
                  showChatbox={showChatbox}
                  setShowChatbox={setShowChatbox}
                  onCloseMindMap={handleCloseMindMap}
                />
              )}
            </div>

            {/* Right Panel: Chat Area */}
            {showChatbox && (
              <div 
                style={{ width: `${chatboxWidth}px`, minWidth: '320px', maxWidth: '800px' }}
                className="h-full flex flex-col relative bg-[#fdfbf7] z-10 border-l border-zinc-200"
              >
                {/* Resize Handle / Splitter */}
                <div
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setIsResizing(true);
                  }}
                  className="absolute top-0 left-0 -ml-1 w-2 h-full cursor-col-resize hover:bg-red-500/20 active:bg-red-500/40 transition-colors z-30"
                  title="Drag to resize chatbox"
                />
                {renderChatArea(true)}
              </div>
            )}
          </>
        ) : (
          /* Normal Full Screen Chat Area */
          <div className="flex-1 h-full flex flex-col relative z-10">
            {renderChatArea(false)}
          </div>
        )}
      </div>

      <Dialog open={nodeDialogOpen} onOpenChange={setNodeDialogOpen}>
        <DialogContent className="!max-w-6xl !sm:max-w-6xl w-[92vw] h-[85vh] max-h-[800px] p-0 overflow-hidden rounded-2xl border-zinc-200 bg-white flex flex-col">
          <div className="flex flex-col md:flex-row h-full overflow-hidden">
            {/* Video Panel */}
            <div className="md:w-[55%] bg-zinc-950 flex flex-col">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Play size={14} className="text-red-500" />
                  <span className="text-sm font-semibold text-white">{selectedNode?.label}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto flex items-center justify-center p-6 min-h-[300px]">
                {nodeVideoUrl ? (
                  <div className="w-full">
                    <video
                      src={nodeVideoUrl}
                      controls
                      autoPlay
                      loop
                      playsInline
                      className="w-full rounded-lg shadow-2xl"
                    />
                  </div>
                ) : generatingVideo ? (
                  <div className="text-center space-y-4">
                    <Loader2 size={40} className="text-red-500 mx-auto animate-spin" />
                    <div className="space-y-1">
                      <p className="text-sm text-zinc-300">
                        {videoStages[videoStages.length - 1] || 'Preparing video generation'}
                      </p>
                      <p className="text-xs text-zinc-600">
                        If Manim fails, the LLM receives the render error and repairs the code.
                      </p>
                    </div>
                    {videoStages.length > 0 && (
                      <div className="mx-auto max-w-sm rounded-lg border border-white/10 bg-white/5 p-3 text-left">
                        {videoStages.slice(-4).map((stage, idx) => (
                          <p key={`${stage}-${idx}`} className="text-xs text-zinc-500">
                            {stage}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    {videoError ? (
                      <>
                        <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
                          <X size={28} className="text-red-400" />
                        </div>
                        <p className="text-sm text-red-400">{videoError}</p>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 mx-auto rounded-full bg-white/5 flex items-center justify-center">
                          <Play size={28} className="text-zinc-500" />
                        </div>
                        <p className="text-sm text-zinc-500">Click generate to create a video</p>
                      </>
                    )}
                    <Button
                      variant="secondary"
                      className="gap-2"
                      onClick={handleGenerateNodeVideo}
                      disabled={generatingVideo}
                    >
                      <Sparkles size={14} />
                      {videoError ? 'Regenerate Video' : 'Generate Video'}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Description Panel */}
            <div className="md:w-[45%] flex flex-col bg-white">
              <DialogHeader className="p-5 pb-3 border-b border-zinc-100">
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <BookOpen size={18} className="text-red-600" />
                  {selectedNode?.label}
                </DialogTitle>
              </DialogHeader>

              <ScrollArea className="flex-1 min-h-0 p-5">
                <div className="prose prose-sm prose-zinc max-w-none">
                  {nodeDescription ? (
                    (() => {
                      const { cleanText, code } = extractManimCode(nodeDescription);
                      return (
                        <div className="text-sm text-zinc-700 leading-relaxed">
                          {renderMarkdown(cleanText)}
                          {code && <CollapsibleCode code={code} />}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-4/5" />
                      <Skeleton className="h-4 w-3/5" />
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Actions */}
              <div className="p-4 border-t border-zinc-100 font-sans flex gap-2 items-center">
                <div className="relative" ref={nodeModelPickerRef}>
                  <button
                    className="flex items-center gap-1.5 px-3 h-10 bg-zinc-50 border border-zinc-200 text-zinc-600 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                    onClick={() => setShowNodeModelPicker(!showNodeModelPicker)}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
                    <span>{models.find(m => m.id === nodeModel)?.label || 'Model'}</span>
                    <ChevronDown size={14} className={`text-zinc-400 ${showNodeModelPicker ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showNodeModelPicker && (
                    <div className="absolute bottom-full left-0 mb-2 w-56 bg-white border border-zinc-200 rounded-xl shadow-xl p-2 z-50 origin-bottom-left">
                      {models.map((option) => (
                        <button
                          key={option.id}
                          className={`flex items-center justify-between w-full px-3 py-2 text-left rounded-lg text-xs cursor-pointer ${
                            option.id === nodeModel 
                              ? 'bg-red-50 text-red-700 font-semibold' 
                              : 'text-zinc-600'
                          }`}
                          onClick={() => {
                            setNodeModel(option.id);
                            setShowNodeModelPicker(false);
                          }}
                        >
                          <span>{option.label}</span>
                          {option.id === nodeModel && <Check size={14} className="text-red-600" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  className="flex-1 gap-2 h-10 bg-red-600 text-white shadow-sm cursor-pointer whitespace-nowrap"
                  onClick={handleGenerateNodeDescription}
                  disabled={generatingDescription}
                >
                  {generatingDescription ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Generating...
                    </>
                  ) : nodeDescription && nodeDescription !== selectedNode?.description ? (
                    <>
                      <BookOpen size={14} />
                      Regenerate Description
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      Generate Description Only
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
