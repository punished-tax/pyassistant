'use client';
import { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { python } from '@codemirror/lang-python';
import { tokyoNight, tokyoNightInit } from '@uiw/codemirror-theme-tokyo-night'
import { indentWithTab } from '@codemirror/commands'
import { keymap } from '@codemirror/view'
import React from 'react';
// Other necessary imports

export default function Editor() {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current) {
      const emptyLines = '\n'.repeat(20);
      const docContent = `def solve():
  pass${emptyLines}`;

      const view = new EditorView({
        doc: docContent,
        extensions: [
          basicSetup,
          python(),
          keymap.of([indentWithTab]),
          tokyoNightInit(),
          tokyoNight,
        ],
        parent: editorRef.current,
      });
    }
  }, []);

  return <div ref={editorRef} className="border border-gray-500 h-[400px] w-[500px] overflow-auto " />;
}