// src/app/editor.tsx
'use client';
import { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { python } from '@codemirror/lang-python';
//import { tokyoNight, tokyoNightInit } from '@uiw/codemirror-theme-tokyo-night';
import { andromeda, andromedaInit } from '@uiw/codemirror-theme-andromeda'
//import { materialDark, materialDarkInit } from '@uiw/codemirror-theme-material'
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
    if (editorRef.current) {
      if (!viewRef.current) { // Initialize editor only once
        console.log("Editor.tsx: Initializing EditorView with:", initialCode);
        const startState = EditorState.create({
          doc: initialCode, // Initial document
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
              "&": { height: "100%" }, // Ensure editor takes full height of its container
              ".cm-scroller": { overflow: "auto" }
            }),
            
            ],
            
        });
         const view = new EditorView({
          state: startState,
          parent: editorRef.current,
        });
        viewRef.current = view;
      } else {
        // Editor already initialized, update its content if initialCode prop changes
        // and is different from the current editor document.
        const currentDoc = viewRef.current.state.doc.toString();
        if (initialCode !== currentDoc) {
          console.log("Editor.tsx: initialCode prop changed. Updating editor content.");
          viewRef.current.dispatch({
            changes: { from: 0, to: currentDoc.length, insert: initialCode }
          });
          // Notify parent that the code has been programmatically changed
          // This ensures consistency if the parent relies on this callback for its state.
          onCodeChangeRef.current(initialCode);
        }
      }
    }
    // The dependency on initialCode ensures this effect runs when the initial code changes
    // (e.g., when navigating to a different challenge).
  }, [initialCode]);


   // Separate effect for destroying the editor on component unmount
   useEffect(() => {
    return () => {
      if (viewRef.current) {
        console.log("Editor.tsx: Component unmounting. Destroying EditorView.");
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, []); // Empty dependency array means this runs only on mount and unmount



  // Removed fixed height/width here, rely on parent container's styling
  // Added h-full to make it fill the parent div's height
  return <div ref={editorRef} className="border-2 rounded-2xl border-[rgb(75,75,75)] w-[500px] h-[400px] overflow-auto" />;
}