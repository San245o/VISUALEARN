'use client';

import { useEffect, useState } from 'react';
import { Play, Loader2, PlayCircle, Settings, Home, Code, Info } from 'lucide-react';

type ModelOption = {
  id: string;
  label: string;
  status?: string;
};

const FALLBACK_MODELS: ModelOption[] = [
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', status: 'stable' },
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)', status: 'preview' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', status: 'stable' },
];

const FALLBACK_DEFAULT_MODEL = 'gemini-3.5-flash';

export default function Dashboard() {
  const [prompt, setPrompt] = useState('');
  const [models, setModels] = useState<ModelOption[]>(FALLBACK_MODELS);
  const [model, setModel] = useState(FALLBACK_DEFAULT_MODEL);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        // Keep fallback models if the backend is unavailable.
      }
    };

    loadModels();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsLoading(true);
    setError(null);
    setVideoUrl(null);

    try {
      const res = await fetch('http://localhost:8000/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to generate');
      setVideoUrl(data.video_url);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const examplePrompts = [
    "A bouncing ball over a sine wave with trails",
    "Two planets orbiting each other with gravitational forces",
    "A simple neural network architecture diagram connecting layers",
    "Pythagorean theorem geometric proof with colored squares"
  ];

  return (
    <div className="flex h-screen w-full bg-slate-950 font-sans text-slate-50">
      <div className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col hidden md:flex">
        <div className="p-6">
          <h1 className="text-xl font-bold flex items-center gap-2 text-indigo-400">
            <PlayCircle className="w-6 h-6" /> VisualEarn
          </h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          <button className="w-full flex items-center gap-3 px-3 py-2 bg-indigo-500/10 text-indigo-400 rounded-md transition-colors">
            <Home className="w-5 h-5" /> Dashboard
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors">
            <Code className="w-5 h-5" /> Templates
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors">
            <Info className="w-5 h-5" /> Help
          </button>
        </nav>
        
        <div className="p-4 border-t border-slate-800">
          <button className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors">
            <Settings className="w-5 h-5" /> Settings
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <header className="h-16 border-b border-slate-800 flex items-center px-6 bg-slate-900/50 sticky top-0 z-10">
          <h2 className="text-lg font-medium tracking-tight">Manim Generator</h2>
        </header>

        <main className="flex-1 overflow-auto p-6 md:p-10">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="p-6">
                <label htmlFor="prompt" className="block text-sm font-medium mb-3 text-slate-300">
                  Describe what you want to animate in Manim
                </label>
                <textarea
                  id="prompt"
                  rows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., A bouncing ball over a sine wave or a simple physics projectile motion..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-4 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />

                <div className="mt-4">
                  <label htmlFor="model" className="block text-xs font-medium mb-2 text-slate-400">
                    Model
                  </label>
                  <select
                    id="model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {models.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-slate-500">
                    Preview models may change or be rate-limited.
                  </p>
                </div>
                
                <div className="mt-4">
                  <p className="text-xs text-slate-400 mb-2">Example prompts:</p>
                  <div className="flex flex-wrap gap-2">
                    {examplePrompts.map((ep, idx) => (
                      <button
                        key={idx}
                        onClick={() => setPrompt(ep)}
                        className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-indigo-500/20 hover:text-indigo-300 hover:border-indigo-500/30 border border-slate-700 rounded-full text-slate-300 transition-colors"
                      >
                        {ep}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="bg-slate-950/50 px-6 py-4 border-t border-slate-800 flex justify-end">
                <button
                  onClick={handleGenerate}
                  disabled={!prompt || isLoading}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400 disabled:pointer-events-none disabled:opacity-50 bg-indigo-500 text-white shadow hover:bg-indigo-600 h-9 px-4 py-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Generate Video
                    </>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg">
                <strong>Error:</strong> {error}
              </div>
            )}

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="border-b border-slate-800 bg-slate-900/80 px-6 py-4 border-t-0">
                <h3 className="font-medium text-slate-200">Animation Output</h3>
              </div>
              <div className="p-6 min-h-[400px] flex items-center justify-center bg-[#0a0f1c] relative">
                {isLoading && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0a0f1c]/80 backdrop-blur-sm">
                    <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mb-4" />
                    <p className="text-slate-400 animate-pulse">Wait a moment for generation...</p>
                  </div>
                )}
                
                {videoUrl ? (
                  <video
                    src={videoUrl}
                    controls
                    autoPlay
                    loop
                    className="max-h-[500px] w-full object-contain rounded-md"
                  />
                ) : !isLoading ? (
                  <p className="text-slate-500 text-sm">
                    Enter a prompt and hit generate to see the output here.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
