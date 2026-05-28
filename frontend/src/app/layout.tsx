import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'VisualEarn',
  description: 'Manim code generator for engineering students',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-50 min-h-screen">
        {children}
      </body>
    </html>
  )
}
