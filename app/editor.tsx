// src/app/editor.tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { python } from '@codemirror/lang-python';
import { tokyoNight, tokyoNightInit } from '@uiw/codemirror-theme-tokyo-night';
import { andromeda, andromedaInit } from '@uiw/codemirror-theme-andromeda'
import { materialDark, materialDarkInit } from '@uiw/codemirror-theme-material'
import { indentWithTab } from '@codemirror/commands';
import { keymap } from '@codemirror/view';
import React from 'react';
import { EditorState } from '@codemirror/state'; // Import EditorState

interface EditorProps {
  initialCode: string; // Renamed to be more explicit
  onCodeChange: (code: string) => void;

}


export default function Editor({
  initialCode,
  onCodeChange,
  
}: EditorProps) {
  
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // To prevent re-initializing the editor on every parent re-render if only onCodeChange callback instance changed
  const onCodeChangeRef = useRef(onCodeChange);
  useEffect(() => {
    onCodeChangeRef.current = onCodeChange;
  }, [onCodeChange]);

  useEffect(() => {
    if (editorRef.current && !viewRef.current) {
      console.log("Editor.tsx: Initializing EditorView with:", initialCode);
      const startState = EditorState.create({
        doc: initialCode,
        extensions: [
          basicSetup,
          python(),
          keymap.of([indentWithTab]),
          andromedaInit(),
          andromeda,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onCodeChangeRef.current(update.state.doc.toString());
            }
          }),
            EditorView.theme({
                "&": { height: "100%" },
                ".cm-scroller": { overflow: "auto" }
            })
            ],
            
        });
         const view = new EditorView({
        state: startState,
        parent: editorRef.current,
      });
      viewRef.current = view;
      onCodeChangeRef.current(initialCode);
    }

     // This cleanup is important
    return () => {
      if (viewRef.current) {
        console.log("Editor.tsx: Destroying EditorView");
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, []);


  // Removed fixed height/width here, rely on parent container's styling
  // Added h-full to make it fill the parent div's height
  return <div ref={editorRef} className="border-2 rounded-2xl border-[rgb(75,75,75)] w-[500px] h-[400px] overflow-auto" />; // overflow-hidden on parent
}