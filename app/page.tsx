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
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { BadgeHelp, Play } from 'lucide-react'


// Header 
const Header: React.FC<{ title: string }> = ({ title }) => {
  return (
    <header className="relative bg-black border-b border-gray-500 py-4">
      <div className="container mx-auto relative">
        <h1 className="text-white text-center text-3xl font-bold">
          {title}
        </h1>
        {/* Dialog positioned in the top right */}
        <div className="absolute top-2 right-0">
          <Dialog>
            <DialogTrigger className="flex items-center gap-2 text-white hover:underline focus:outline-none">
              <span>About</span>
              <BadgeHelp size={25} />
            </DialogTrigger>
            <DialogContent className="bg-black p-6 rounded-md">
              <DialogHeader>
                <DialogTitle className=''>About</DialogTitle>
              </DialogHeader>
              
              <p>This is some information about the website.</p>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  )
}

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
    <Header title="PyAssistant"/>
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

