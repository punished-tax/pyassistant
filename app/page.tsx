'use client'

import Chat from '@/components/chat'
import { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { python } from '@codemirror/lang-python'
import { tokyoNight, tokyoNightInit } from '@uiw/codemirror-theme-tokyo-night'
import { indentWithTab } from '@codemirror/commands'
import { keymap } from '@codemirror/view'
import React from 'react';
import DailyQuestion from '@/components/dailyQuestion'


// Header component with a black background, white border, and centered bold text
const Header: React.FC<{ title: string }> = ({ title }) => {
  return (
    <header className="bg-black border-b border-gray-500 py-4 ">
      <div className="container mx-auto">
        <h1 className="text-white text-center text-3xl font-bold">
          {title}
        </h1>
      </div>
    </header>
  );
};

export const runtime = 'edge'

export default function Home() {
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editorRef.current) {

      const emptyLines = '\n'.repeat(14);
      const docContent = `def solve():
  pass${emptyLines}`;

      const view = new EditorView({
        doc: docContent,
        extensions: [
          basicSetup,
          python(),
          
          keymap.of([indentWithTab]),
          tokyoNightInit(), // any necessary initialization for the theme
          tokyoNight,      // the actual theme styles
        ],
        parent: editorRef.current,
});
      
    }
  }, [])

  return (
  <>
    <Header title="PyAssistant" />
    <DailyQuestion />
    <div className="flex justify-center items-center min-h-screen space-x-6">
      <div className="flex-shrink-0 w-[600px]">
        <Chat />
      </div>
      <div
      ref={editorRef}
      className="border border-gray-500 h-[300px] w-[600px] overflow-auto mb-4"
/>
    </div>
    </>
  )
  
}

