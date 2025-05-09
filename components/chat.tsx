// chat.tsx
'use client'

import { useChat } from '@ai-sdk/react'
import { useEffect, useRef } from 'react'
import { Input } from './ui/input'
import { Button } from './ui/button' // Assuming you might want a button later
import { ScrollArea } from './ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { SendHorizontalIcon } from 'lucide-react'
import CopytoClipboard from './ui/copy-to-clipboard'

export default function Chat() {
    // Rename ref for clarity - it points to the ScrollArea component's root element
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const { messages, input, handleInputChange, handleSubmit, isLoading, error } =
    useChat({
        initialMessages: [
            {
                id: Date.now().toString(),
                role: 'system',
                content: 'You are an arrogant python programming expert that likes to withhold information. Whenever someone asks you a question, you will provide a barebones answer that is almost unhelpful, but just enough to go off of. You will never answer any question unrelated to python programming. '
            },
            {
                id: 'welcome message',
                role: 'assistant',
                content: "I'm here to assist you in your coding journey. Keep in mind that I won't be giving away complete answers!"
            }
        ]
    });

    // Effect to scroll to bottom when messages change
    useEffect(() => {
        // Check if the ScrollArea's root element ref is current
        if (scrollAreaRef.current) {
            // Find the viewport element within the ScrollArea using its data attribute
            // This attribute is typical for Radix UI based components like shadcn/ui's ScrollArea
            const viewport = scrollAreaRef.current.querySelector<HTMLDivElement>(
                '[data-radix-scroll-area-viewport]'
            );

            if (viewport) {
                // If the viewport is found, scroll it to the bottom
                viewport.scrollTo({
                    top: viewport.scrollHeight,
                    behavior: 'smooth' // Use smooth scrolling for better UX
                });
            } else {
                // Log a warning if the viewport isn't found (might indicate structure changed)
                 console.warn("Chat viewport element not found for autoscrolling.");
                 // As a fallback, you could try scrolling the root element, though less likely to work correctly
                 // scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
            }
        }
    }, [messages]); // Re-run the effect whenever the messages array changes

    return (
        <section className="flex justify-center p-4">
          <div className=" w-full max-w-2xl h-[500px]">
            {/* Chat “window” wrapper */}
            <div className="flex flex-col h-full border-2 border-[rgb(75,75,75)] rounded-2xl bg-black overflow-hidden">
              
              {/* Message pane */}
              <ScrollArea
                className="flex-1 min-h-0 p-12"
                ref={scrollAreaRef}
              >
                {error && (
                  <div className="text-sm font-mono text-red-400">{error.message}</div>
                )}
                {messages.map(m => (
                            <div key={m.id} className='mr-6 whitespace-pre-wrap md:mr-12'>
                                {m.role === 'user' && (
                                    <div className='mb-6 flex gap-3'>
                                        <Avatar>
                                            <AvatarImage src=''/>
                                            <AvatarFallback className='text-sm font-mono bg-blue-500'>U</AvatarFallback>
                                        </Avatar>
                                        <div className='mt-1.5'>
                                            <p className='font-mono text-blue-500'>You</p>
                                            <div className='mt-1.5 text-sm font-mono text-gray-200'>
                                                {m.content}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {m.role === 'assistant' && (
                                    <div className='mb-6 flex gap-3'>
                                        <Avatar>
                                            <AvatarImage src=''/>
                                            <AvatarFallback className='bg-orange-600 text-white font-mono'>
                                                AI
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className='mt-1.5 w-full'>
                                            <div className='flex justify-between'>
                                                <p className='font-mono text-orange-600'>Bot</p>
                                                <CopytoClipboard message={m} className='-mt-1' />
                                            </div>
                                            <div className='mt-2 text-sm font-mono text-gray-200'>
                                                {m.content}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        {/* You might want a visual indicator during loading */}
                        {isLoading && <div className="ml-10 flex items-center space-x-2 text-zinc-400 p-4">
                            <div className="animate-bounce">•</div>
                            <div className="animate-bounce" style={{ animationDelay: '100ms' }}>•</div>
                            <div className="animate-bounce" style={{ animationDelay: '200ms' }}>•</div>
                            </div>}
                    </ScrollArea>
    
              {/* Input form, now inside the same bordered container */}
              <form
                onSubmit={handleSubmit}
                className="relative flex items-center p-4 font-mono"
              >
                <Input
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Type your message..."
                  disabled={isLoading}
                  className="flex-grow h-12 border-[rgb(55,55,55)] bg-[#383A40] placeholder:italic placeholder:text-zinc-500 rounded-2xl pr-12 focus:border-blue-500 focus:ring-blue-500 focus:ring-1 hover:border-blue-500 transition-colors duration-75 text-gray-100"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="absolute right-6 top-1/2 -translate-y-1/2 h-8 w-8"
                  disabled={isLoading || !input.trim()}
                >
                  <SendHorizontalIcon className="h-4 w-4 text-emerald-400" />
                </Button>
              </form>
            </div>
          </div>
        </section>
      )
    }