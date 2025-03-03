'use client'

import { useChat } from '@ai-sdk/react'
import { useEffect, useRef } from 'react'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { SendHorizontalIcon } from 'lucide-react'
import CopytoClipboard from './ui/copy-to-clipboard'

export default function Chat() {
    const ref = useRef<HTMLDivElement>(null)
    const { messages, input, handleInputChange, handleSubmit, isLoading, error } =
    useChat({
        initialMessages: [
            {
                id: Date.now().toString(),
                role: 'system',
                content: 'You are a helpful assistant that provides code snippets on various coding concepts in python.'
            }
        ]
    })
    useEffect(()=>{
        if (ref.current === null) return
        ref.current.scrollTo(0, ref.current.scrollHeight)
    }, [messages])
    return (
        <section className='text-indigo-400'>
            <div className="container flex h-screen flex-col items-center justify-center">
                <h1 className="font-mono text-3xl font-medium">PyAssistant</h1>
                <div className="mt-4 w-full max-w-lg">
                    {/*...*/ }
                    <ScrollArea
                        className='mb-2 h-[400px] rounded-md border p-4'
                        ref={ref}
                        >
                            {error && (
                                <div className='text-sm text-red-400'>{error.message}</div>
                            )}
                            {messages.map(m => (
                                <div key={m.id} className='mr-6 whitespace-pre-wrap md:mr-12'>
                                    {m.role === 'user' && (
                                        <div className='mb-6 flex gap-3'>
                                            <Avatar>
                                                <AvatarImage src=''/>
                                                <AvatarFallback className='text-sm'>U</AvatarFallback>
                                            </Avatar>
                                            <div className='mt-1.5'>
                                                <p className='font-semibold'>You</p>
                                                <div className='mt-1.5 text-sm text-zinc-500'>
                                                    {m.content}
                                                </div>
                                            </div>
                                        </div>        
                                    )}

                                    {m.role === 'assistant' && (
                                        <div className='mb-6 flex gap-3'>
                                            <Avatar>
                                                <AvatarImage src=''/>
                                                <AvatarFallback className='bg-emerald-500 text-white'>
                                                    AI
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className='mt-1.5 w-full'>
                                                <div className='flex justify-between'>
                                                    <p className='font-semibold'>Bot</p>
                                                    <CopytoClipboard message={m} className='-mt-1' />
                                                    </div>
                                                    <div className='mt-2 text-sm text-zinc-500'>
                                                        {m.content}
                                                    </div>
                                                </div>
                                            </div>        
                                          )}
                                    </div>
                            ))}
                    </ScrollArea>

                    {/*input form */}
                    <form onSubmit={handleSubmit} className='relative'>
                        <Input
                        value={input}
                        onChange={handleInputChange}
                        placeholder='Ask me a question...'
                        className='pr-12 placeholder:italic placeholder:text-zinc-600'
                        />
                        <Button>                    

                        </Button>
                    </form>

                </div>
            </div>
        </section>
    )
}