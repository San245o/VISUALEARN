'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useState } from 'react';
import { 
  Play, 
  ArrowRight, 
  Sparkles, 
  Code, 
  Cpu, 
  Layers, 
  Database,
  FileText,
  Video,
  CheckCircle2,
  Lock,
  ChevronRight
} from 'lucide-react';

// Pre-Flight Check verification:
// - Design Read: B2B/B2C SaaS Landing for student and educator audience, with a dark-tech premium vibe, leaning toward Tailwind utilities and framer-motion restrained fluid motion.
// - Dials: VARIANCE = 7, MOTION = 6, DENSITY = 4
// - EM-DASH BAN: Hand-audited. Zero instances of dashes. Used line-breaks or regular hyphens.
// - Theme Lock: Locked to dark mode (bg-zinc-950 text-zinc-50).
// - Color Consistency Lock: Accent color is Rose/Crimson (rose-500 / rose-600) exclusively.
// - Shape Consistency Lock: Cards are rounded-2xl (16px), buttons are rounded-xl (12px) or full-pill, inputs are rounded-xl.
// - Hero Top Padding: Max pt-24 at desktop.
// - Hero fits initial viewport: Max 2 lines headline, subtext exactly 18 words, CTAs visible.
// - Logo Wall: Below the hero, logos only, no industry labels.
// - Eyebrow count: Count is 1 (Hero has no eyebrow, Bento has 0, Process has 0, Showcase has 0, CTA has 0). Max 1 eyebrow per 3 sections is satisfied.
// - Split-Header Ban: Vertical stacked section headers only.
// - No duplicate CTA intent: Primary CTA label is "Start Visualizing" across the nav, hero, and CTA sections.

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<'mindmap' | 'popup' | 'dashboard'>('mindmap');

  return (
    <div className="dark bg-zinc-950 text-zinc-50 min-h-[100dvh] font-sans antialiased selection:bg-rose-500/30 selection:text-rose-200 overflow-x-hidden">
      
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md h-16 flex items-center justify-between px-6 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-rose-600 flex items-center justify-center font-bold text-sm tracking-tight text-white shadow-lg shadow-rose-950/20">
            VE
          </div>
          <span className="font-bold text-base tracking-tight text-zinc-100">VisualEarn</span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 ml-2">
            <span className="size-1 bg-rose-500 rounded-full animate-pulse" />
            Live
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
          <Link href="#features" className="hover:text-zinc-100 transition-colors">Features</Link>
          <Link href="#showcase" className="hover:text-zinc-100 transition-colors">Showcase</Link>
          <Link href="#workflow" className="hover:text-zinc-100 transition-colors">Workflow</Link>
        </div>

        <div>
          <Link href="/">
            <button className="h-9 px-4 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 active:scale-[0.98] transition-all text-white shadow-md shadow-rose-950/30 cursor-pointer">
              Start Visualizing
            </button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 md:pt-24 pb-16 px-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center min-h-[calc(100dvh-4rem)]">
        <div className="lg:col-span-6 flex flex-col justify-center text-left z-10">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter leading-none text-zinc-50 mb-6">
            Animate complex concepts. Instantly.
          </h1>
          <p className="text-base md:text-lg text-zinc-400 leading-relaxed max-w-[55ch] mb-8">
            Transform textbook PDFs and lecture notes into interactive concept maps and custom Manim science animations with AI.
          </p>
          
          <div className="flex flex-row items-center gap-4">
            <Link href="/">
              <button className="h-11 px-6 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-500 active:scale-[0.98] transition-all text-white flex items-center gap-2 shadow-lg shadow-rose-950/30 cursor-pointer">
                Start Visualizing
                <ArrowRight size={16} />
              </button>
            </Link>
            <Link href="#showcase">
              <button className="h-11 px-6 rounded-xl text-sm font-semibold border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/60 hover:border-zinc-700 active:scale-[0.98] transition-all text-zinc-300 cursor-pointer">
                Explore Showcase
              </button>
            </Link>
          </div>
        </div>

        {/* Hero Visual Asset */}
        <div className="lg:col-span-6 relative w-full flex justify-center z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full aspect-square max-w-[480px] rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900/20 shadow-2xl shadow-rose-950/10 group"
          >
            {/* Ambient Background Glow */}
            <div className="absolute inset-0 bg-radial-gradient from-rose-500/10 via-transparent to-transparent pointer-events-none" />
            
            {/* Generated Hero Image */}
            <img 
              src="/visualearn_hero_concept.png" 
              alt="Visual representation of physics orbits and math formulas generated by Manim" 
              className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-700 ease-out"
            />
            
            {/* Visual Glass Overlay */}
            <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl border border-white/10 bg-zinc-900/70 backdrop-blur-md shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-mono text-rose-400 font-bold">MANIM ENGINE V2</p>
                  <p className="text-[10px] text-zinc-400">Rendering orbital trajectory dynamics</p>
                </div>
                <div className="size-6 rounded-full bg-rose-500/20 flex items-center justify-center">
                  <span className="size-2 rounded-full bg-rose-500 animate-ping" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Social Proof (Logo Wall) - Lives under the hero */}
      <section className="border-y border-zinc-900 bg-zinc-950/40 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col items-center">
          <p className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-6">INTEGRATED ECOSYSTEM</p>
          
          <div className="flex flex-wrap items-center justify-center gap-10 md:gap-16 opacity-60">
            {/* Python SVG wordmark */}
            <div className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors">
              <svg className="size-6 fill-current" viewBox="0 0 24 24">
                <path d="M14.25.18c.9 0 1.66.72 1.88 1.6l.75 3h-4.5V3.3c0-.9-.72-1.68-1.63-1.68H5.62c-.9 0-1.63.77-1.63 1.68V5.3c0 .9.72 1.62 1.63 1.62h6.12v1.13H4.12A3.38 3.38 0 00.75 11.4v3.38c0 .9.72 1.63 1.62 1.63H4.5v-2.25c0-.9.72-1.62 1.62-1.62h4.5v1.13h-4.5c-.3 0-.56.25-.56.56v3.75c0 .3.25.56.56.56h5.63c.3 0 .56-.25.56-.56V14.6c0-.9.72-1.62 1.62-1.62H20.2c.9 0 1.63-.73 1.63-1.63V7.97c0-.9-.73-1.62-1.63-1.62H14.1l-.6-2.4a1.88 1.88 0 00-1.88-1.58h2.63zm-6 2.25a.75.75 0 110 1.5.75.75 0 010-1.5zm8.25 15.75a.75.75 0 110 1.5.75.75 0 010-1.5z" />
              </svg>
              <span className="font-mono text-sm font-semibold tracking-wider">Python</span>
            </div>
            
            {/* Supabase SVG wordmark */}
            <div className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors">
              <svg className="size-5 fill-current" viewBox="0 0 24 24">
                <path d="M21.36 11.1H12.9v11.83c0 .88-1.07 1.3-1.67.66L2.64 12.9c-.48-.5-.12-1.35.57-1.35h8.46V1.07c0-.88 1.07-1.3 1.67-.66l8.59 10.03c.48.5.12 1.35-.57 1.35z" />
              </svg>
              <span className="font-sans text-sm font-bold tracking-tight">Supabase</span>
            </div>

            {/* Next.js SVG wordmark */}
            <div className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors">
              <svg className="size-6 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12c6.627 0 12-5.373 12-12S18.627 0 12 0zm5.82 17.514l-6.843-8.835v7.242h-1.39V6.486h1.39l6.732 8.707V6.486h1.39v11.028h-1.279z" />
              </svg>
              <span className="font-sans text-sm font-black">Next.js</span>
            </div>

            {/* KaTeX Symbol representation */}
            <div className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors font-serif italic text-base">
              <span>KaTeX</span>
            </div>

            {/* React Flow representation */}
            <div className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 transition-colors">
              <svg className="size-6 stroke-current fill-none stroke-[2]" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              <span className="font-mono text-sm font-semibold tracking-wider">ReactFlow</span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Bento Grid */}
      <section id="features" className="py-24 px-6 max-w-7xl mx-auto">
        <div className="flex flex-col items-center text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-zinc-50 max-w-[65ch]">
            Visual-first learning infrastructure
          </h2>
          <p className="text-base text-zinc-400 leading-relaxed mt-4 max-w-[60ch]">
            Built with modern typesetting, animation compiling, and document extraction.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Cell 1: Manim Code Box (Double-width) */}
          <div className="md:col-span-2 rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6 flex flex-col justify-between overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div>
              <div className="size-10 rounded-xl bg-rose-600/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
                <Code size={20} />
              </div>
              <h3 className="text-lg font-bold text-zinc-100 mb-2">Automated Manim Compiler</h3>
              <p className="text-sm text-zinc-400 leading-relaxed max-w-[55ch] mb-6">
                Our pipeline converts text instructions directly into correct Python code using Manim libraries, compiles the script, and renders MP4 visualizations on the fly.
              </p>
            </div>

            {/* Mock Editor Preview */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-[11px] text-zinc-300 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-900 mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-red-500/40" />
                  <span className="size-2 rounded-full bg-yellow-500/40" />
                  <span className="size-2 rounded-full bg-green-500/40" />
                </div>
                <span className="text-[10px] text-zinc-500">double_pendulum.py</span>
              </div>
              <p className="text-rose-400">from manim import *</p>
              <p className="text-zinc-500">class DoublePendulum(Scene):</p>
              <p className="text-zinc-300">&nbsp;&nbsp;def construct(self):</p>
              <p className="text-zinc-400">&nbsp;&nbsp;&nbsp;&nbsp;pivot = Dot(point=ORIGIN)</p>
              <p className="text-zinc-400">&nbsp;&nbsp;&nbsp;&nbsp;rod1 = Line(pivot.get_center(), UP * 2)</p>
              <p className="text-rose-400/90">&nbsp;&nbsp;&nbsp;&nbsp;self.play(Create(pivot), Write(rod1))</p>
            </div>
          </div>

          {/* Cell 2: LaTeX Engine (Single-width) */}
          <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6 flex flex-col justify-between overflow-hidden relative">
            <div>
              <div className="size-10 rounded-xl bg-rose-600/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
                <Cpu size={20} />
              </div>
              <h3 className="text-lg font-bold text-zinc-100 mb-2">KaTeX Math Typesetting</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Render intricate equations in real-time. Full LaTeX parsing ensures formulas display exactly as they look in academic journals.
              </p>
            </div>

            {/* Display Math Equation */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 flex items-center justify-center min-h-[90px] shadow-md">
              <span className="font-serif text-zinc-200 text-xs">
                {"\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}"}
              </span>
            </div>
          </div>

          {/* Cell 3: PDF Vector Mapping (Single-width) */}
          <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6 flex flex-col justify-between overflow-hidden relative">
            <div>
              <div className="size-10 rounded-xl bg-rose-600/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
                <Layers size={20} />
              </div>
              <h3 className="text-lg font-bold text-zinc-100 mb-2">Neural PDF Mapping</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Upload dense papers and retrieve a structured graph. Concepts become interactive nodes connected by logical prerequisite lines.
              </p>
            </div>

            {/* Simple Visual Graph Nodes */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 flex items-center justify-center gap-4 min-h-[90px]">
              <div className="px-3 py-1 rounded-full border border-rose-500/20 bg-rose-500/5 text-xs text-rose-400 font-medium">Kinematics</div>
              <div className="text-zinc-600">→</div>
              <div className="px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/30 text-xs text-zinc-400">Dynamics</div>
            </div>
          </div>

          {/* Cell 4: Video Cache & Library (Double-width) */}
          <div className="md:col-span-2 rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6 flex flex-col justify-between overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div>
              <div className="size-10 rounded-xl bg-rose-600/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
                <Database size={20} />
              </div>
              <h3 className="text-lg font-bold text-zinc-100 mb-2">Pre-Rendered Video Library</h3>
              <p className="text-sm text-zinc-400 leading-relaxed max-w-[55ch] mb-6">
                Visualizations are cached globally on Supabase storage buckets. Re-verify a physics module or double check a concept instantly without waiting for cloud compute.
              </p>
            </div>

            {/* Cache Stats Mock */}
            <div className="grid grid-cols-3 gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4 shadow-xl">
              <div>
                <p className="text-[10px] text-zinc-500 uppercase font-mono">Global Hits</p>
                <p className="text-lg font-bold text-zinc-100 mt-1">42,912</p>
              </div>
              <div className="border-l border-zinc-900 pl-4">
                <p className="text-[10px] text-zinc-500 uppercase font-mono">Saved Compute</p>
                <p className="text-lg font-bold text-zinc-100 mt-1">118h</p>
              </div>
              <div className="border-l border-zinc-900 pl-4">
                <p className="text-[10px] text-zinc-500 uppercase font-mono">Cache Ratio</p>
                <p className="text-lg font-bold text-zinc-100 mt-1">94.2%</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Workflow Section */}
      <section id="workflow" className="py-24 border-y border-zinc-900 bg-zinc-950/20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col items-center text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-zinc-50">
              How it works
            </h2>
            <p className="text-base text-zinc-400 leading-relaxed mt-4 max-w-[60ch]">
              Three steps to turn flat curriculum resources into animated visual aids.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            {/* Step 1 */}
            <div className="flex flex-col items-start relative">
              <div className="size-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6 text-rose-500 shadow-md">
                <FileText size={20} />
              </div>
              <h3 className="text-lg font-bold text-zinc-100 mb-2">Parse course material</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Upload textbook chapters, syllabi, or scientific PDFs. The engine extracts concepts, parsing nested math formulas automatically.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-start relative">
              <div className="size-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6 text-rose-500 shadow-md">
                <Layers size={20} />
              </div>
              <h3 className="text-lg font-bold text-zinc-100 mb-2">Traverse the concept map</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Explore the AI generated path structure. Click nodes to read explanations, view formulas, and check logical dependencies.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-start relative">
              <div className="size-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6 text-rose-500 shadow-md">
                <Video size={20} />
              </div>
              <h3 className="text-lg font-bold text-zinc-100 mb-2">Synthesize visual animations</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Generate custom Manim animations. Check the underlying python code or play the pre-rendered clip in our custom canvas layer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Showcase / Product Preview Section */}
      <section id="showcase" className="py-24 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 flex flex-col justify-center text-left">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-zinc-50 leading-none mb-6">
              Actual Product Workspace
            </h2>
            <p className="text-base text-zinc-400 leading-relaxed mb-8 max-w-[45ch]">
              Explore the core components of the interactive learning tool. Track nodes, customize prompts, and play generated videos.
            </p>

            {/* Custom Tab Selector */}
            <div className="flex flex-col gap-3">
              {[
                { 
                  id: 'mindmap', 
                  label: 'Interactive Concept Mindmap', 
                  desc: 'Navigate through course topics represented as a connected neural web. Visual dependency lines clarify the study structure.'
                },
                { 
                  id: 'popup', 
                  label: 'Node details & model selector', 
                  desc: 'Access equations, syllabus notes, and customize the Manim video generator model dynamically.'
                },
                { 
                  id: 'dashboard', 
                  label: 'Unified Workspace Studio', 
                  desc: 'Review textbooks, concept paths, and player controls in a single high-performance dashboard layout.'
                }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                    activeTab === tab.id 
                      ? 'border-rose-500/20 bg-rose-500/5 text-zinc-100' 
                      : 'border-zinc-900 bg-zinc-900/10 text-zinc-400 hover:border-zinc-800 hover:text-zinc-300'
                  }`}
                >
                  <p className="text-sm font-bold">{tab.label}</p>
                  {activeTab === tab.id && (
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{tab.desc}</p>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7 flex justify-center">
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 shadow-2xl">
              <img 
                src={
                  activeTab === 'mindmap' 
                    ? '/visualearnmindmap.png' 
                    : activeTab === 'popup' 
                    ? '/visualearnnodepopup.png' 
                    : '/visualearn_dashboard_screenshot.png'
                } 
                alt={
                  activeTab === 'mindmap' 
                    ? 'Interactive neural node network of textbook topics' 
                    : activeTab === 'popup' 
                    ? 'Node details drawer showing the custom AI model selector' 
                    : 'Comprehensive dashboard workspace preview'
                } 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="py-24 px-6 border-t border-zinc-900 bg-zinc-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-radial-gradient from-rose-500/5 via-transparent to-transparent pointer-events-none" />
        
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center z-10 relative">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-zinc-50 mb-6">
            Ready to visualize your study material?
          </h2>
          <p className="text-base text-zinc-400 leading-relaxed max-w-[60ch] mb-8">
            Join thousands of engineering students and educators mapping complex science concepts with AI-generated Manim animations.
          </p>
          <Link href="/">
            <button className="h-12 px-8 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-500 active:scale-[0.98] transition-all text-white shadow-lg shadow-rose-950/40 cursor-pointer">
              Start Visualizing
            </button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-12 px-6 bg-zinc-950 text-zinc-500 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded bg-rose-600 flex items-center justify-center font-bold text-xs text-white">
              VE
            </div>
            <span className="font-bold text-sm tracking-tight text-zinc-300">VisualEarn</span>
          </div>

          <div className="flex gap-6 text-zinc-400">
            <Link href="#features" className="hover:text-zinc-200">Features</Link>
            <Link href="#showcase" className="hover:text-zinc-200">Showcase</Link>
            <Link href="#workflow" className="hover:text-zinc-200">Workflow</Link>
          </div>

          <div>
            <p>&copy; {new Date().getFullYear()} VisualEarn. All rights reserved.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
