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

interface EditorProps {
  initialCode?: string;
  onCodeChange?: (code: string) => void;
}

const defaultInitialCode = `def solve():
  pass
`;

export default function Editor({
  initialCode = defaultInitialCode,
  onCodeChange,
}: EditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    // Ensure effect runs only once per component mount correctly
    if (editorRef.current && !viewRef.current) {
        const view = new EditorView({
            doc: initialCode,
            extensions: [
            basicSetup,
            python(),
            keymap.of([indentWithTab]),
            andromedaInit(),
            andromeda,
            EditorView.updateListener.of((update) => {
                if (update.docChanged && onCodeChange) {
                onCodeChange(update.state.doc.toString());
                }
            }),
            // Make CodeMirror fill its container height
            EditorView.theme({
                "&": { height: "100%" },
                ".cm-scroller": { overflow: "auto" }
            })
            ],
            parent: editorRef.current,
        });
        viewRef.current = view;

        if (onCodeChange) {
            onCodeChange(initialCode);
        }
    }

    return () => {
        viewRef.current?.destroy();
        viewRef.current = null;
    };
    // Only depend on onCodeChange for re-running if needed
    // initialCode prop changes are handled by the second useEffect
  }, [onCodeChange]); // Removed initialCode dependency here

  // Handle external changes to initialCode after mount
  useEffect(() => {
      if (viewRef.current && initialCode !== viewRef.current.state.doc.toString()) {
          viewRef.current.dispatch({
              changes: { from: 0, to: viewRef.current.state.doc.length, insert: initialCode }
          });
      }
  }, [initialCode]);


  // Removed fixed height/width here, rely on parent container's styling
  // Added h-full to make it fill the parent div's height
  return <div ref={editorRef} className="border rounded border-gray-500 w-[500px] h-[400px] overflow-auto" />; // overflow-hidden on parent
}