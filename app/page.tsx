'use client'

import Chat from '@/components/chat'
import { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { python } from '@codemirror/lang-python'
import { tokyoNight, tokyoNightInit } from '@uiw/codemirror-theme-tokyo-night'
import { indentWithTab } from '@codemirror/commands'
import { keymap } from '@codemirror/view'

export const runtime = 'edge'

export default function Home() {
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editorRef.current) {
      // Create a new EditorView instance with a Python language extension and the Tokyo Night theme
      const view = new EditorView({
        doc: "# Write your Python code here\nprint('Hello, world!')",
        extensions: [
          basicSetup,
          python(),
          keymap.of([indentWithTab]),
          tokyoNightInit(), // any necessary initialization for the theme
          tokyoNight,      // the actual theme styles
        ],
        parent: editorRef.current,
      })
      // Optionally, store the view instance if needed later.
    }
  }, [])

  return (
    
    <div className="flex justify-center items-center min-h-screen space-x-6">
      <div className="flex-shrink-0 w-[600px]">
        <Chat />
      </div>
      <div
        ref={editorRef}
        className="border border-gray-300 h-[300px] w-[600px]"
      />
    </div>
  )
  
}

