import './globals.css'
import type { Metadata } from 'next'
import { Outfit, Instrument_Serif, Geist } from 'next/font/google'
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const outfit = Outfit({
  variable: '--font-outfit',
  subsets: ['latin'],
})

const instrumentSerif = Instrument_Serif({
  variable: '--font-serif',
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  title: 'VisualEarn – AI Animation Generator',
  description: 'Generate stunning Manim animations from text prompts. Built for engineering students to visualize math, physics, and CS concepts.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={cn(outfit.variable, instrumentSerif.variable, "font-sans", geist.variable)}>
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css" />
        <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js" defer />
      </head>
      <body className="font-sans antialiased bg-[#fdfbf7] text-zinc-900">
        {children}
      </body>
    </html>
  )
}
