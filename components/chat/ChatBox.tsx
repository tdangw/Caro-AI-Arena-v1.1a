import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as onlineService from '../../services/onlineService';
import type { ChatMessage, Emoji } from '../../types';
import { useSound } from '../../hooks/useSound';
import { EMOJIS } from '../../constants';

interface ChatBoxProps {
    isOpen: boolean;
    onClose: () => void;
    chatId: string;
    currentUserId: string;
    senderName: string;
    recipientName: string;
    onMessageSent?: (text: string) => void;
    isReadOnly?: boolean;
    recipientId?: string;
}

const QUICK_CHATS = ["Good move!", "Nice!", "Well played.", "Thinking...", "Good luck!"];
const QUICK_REACTIONS = ['❤️', '😂', '👍'];

const ChatBox: React.FC<ChatBoxProps> = ({ isOpen, onClose, chatId, currentUserId, senderName, recipientName, onMessageSent, isReadOnly = false, recipientId }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isEmojiPanelOpen, setIsEmojiPanelOpen] = useState(false);
    const [reactingToMessageId, setReactingToMessageId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const { playSound } = useSound();
    const [displayedMessageCount, setDisplayedMessageCount] = useState(10);

    const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    };

    useEffect(() => {
        if (isOpen && chatId) {
            const unsubscribe = onlineService.listenForMessages(chatId, (allMessages) => {
                const container = scrollContainerRef.current;
                const isScrolledToBottom = container 
                    ? container.scrollHeight - container.clientHeight <= container.scrollTop + 50 
                    : true;

                setMessages(allMessages);
                
                if (isScrolledToBottom) {
                    setTimeout(() => scrollToBottom('smooth'), 100);
                }
            });

            setTimeout(() => scrollToBottom('auto'), 300);

            return () => unsubscribe();
        }
    }, [isOpen, chatId]);

    const handleScroll = () => {
        const container = scrollContainerRef.current;
        if (container) {
            const { scrollTop, scrollHeight, clientHeight } = container;
            setShowScrollButton(scrollHeight - scrollTop - clientHeight > 200);
        }
    };

    const handleSendMessage = async (text: string) => {
        const trimmedText = text.trim();
        if (trimmedText) {
            playSound('select');
            await onlineService.sendMessage(chatId, currentUserId, senderName, trimmedText);
            onMessageSent?.(trimmedText);
            setNewMessage('');
            setTimeout(() => scrollToBottom('smooth'), 50);
        }
    };

    const handleSendReaction = (targetMessageId: string, emoji: string) => {
        handleSendMessage(`REACT:${emoji}:${targetMessageId}`);
        setReactingToMessageId(null);
    };
    
    const handleEmojiSelect = (emoji: Emoji) => {
        setNewMessage(prev => prev + emoji.emoji);
        setIsEmojiPanelOpen(false);
    };
    
    const uidToNameMap = useMemo(() => {
        const map: Record<string, string> = { [currentUserId]: senderName };
        const opponentId = recipientId || chatId.split('_').find(id => id !== currentUserId);
        if (opponentId) {
            map[opponentId] = recipientName;
        }
        return map;
    }, [currentUserId, senderName, recipientName, chatId, recipientId]);

    const { processedMessages, reactionsMap } = useMemo(() => {
        const reactions = new Map<string, { [emoji: string]: string[] }>();
        const regularMessages: ChatMessage[] = [];

        if (!Array.isArray(messages)) {
            console.error("ChatBox received a non-array `messages` state:", messages);
            return { processedMessages: [], reactionsMap: reactions };
        }

        for (const msg of messages) {
            try {
                if (typeof msg?.id !== 'string' || typeof msg?.senderId !== 'string' || typeof msg?.text !== 'string') {
                    console.warn("Skipping malformed message object:", msg);
                    continue;
                }

                if (msg.text.startsWith('REACT:')) {
                    const parts = msg.text.split(':');
                    if (parts.length !== 3) continue;

                    const [, emoji, targetId] = parts;
                    if (!targetId || !emoji) continue;

                    let targetReactions = reactions.get(targetId);
                    if (!targetReactions) {
                        targetReactions = {};
                        reactions.set(targetId, targetReactions);
                    }
                    if (!Array.isArray(targetReactions[emoji])) {
                        targetReactions[emoji] = [];
                    }
                    if (!targetReactions[emoji].includes(msg.senderId)) {
                        targetReactions[emoji].push(msg.senderId);
                    }
                } else {
                    regularMessages.push(msg);
                }
            } catch (error) {
                console.error("Error processing a chat message:", msg, error);
            }
        }
        return { processedMessages: regularMessages, reactionsMap: reactions };
    }, [messages]);

    const messagesToDisplay = useMemo(() => {
        return processedMessages.slice(-displayedMessageCount);
    }, [processedMessages, displayedMessageCount]);

    const handleLoadMore = () => {
        const container = scrollContainerRef.current;
        if (container) {
            const oldScrollHeight = container.scrollHeight;
            const oldScrollTop = container.scrollTop;
            
            setDisplayedMessageCount(prev => {
                const newCount = prev + 10;
                
                requestAnimationFrame(() => {
                    if (scrollContainerRef.current) {
                        const newScrollHeight = scrollContainerRef.current.scrollHeight;
                        scrollContainerRef.current.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight);
                    }
                });

                return newCount;
            });
        }
    };


    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div 
                className="bg-slate-900/20 backdrop-blur-md border border-slate-700 rounded-xl w-full max-w-sm flex flex-col animate-scale-in relative"
                style={{ height: '500px' }}
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex-shrink-0 flex items-center justify-between p-3 border-b border-slate-700">
                    <h3 className="text-lg font-semibold text-white">{isReadOnly ? 'Chat History' : 'Chat'} with {recipientName}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
                </header>
                
                <div className="flex-grow relative overflow-hidden">
                    <div
                        ref={scrollContainerRef}
                        onScroll={handleScroll}
                        className="absolute inset-0 p-3 overflow-y-auto scrollbar-hide"
                    >
                        {processedMessages.length > displayedMessageCount && (
                            <div className="text-center my-2">
                                <button
                                    onClick={handleLoadMore}
                                    className="bg-slate-700 text-slate-300 text-xs px-3 py-1 rounded-full hover:bg-slate-600 transition-colors"
                                >
                                    Load More
                                </button>
                            </div>
                        )}
                        {messagesToDisplay.map(msg => {
                            const msgReactions = reactionsMap.get(msg.id);
                            const isMyMessage = msg.senderId === currentUserId;

                            return (
                                <div key={msg.id} className={`flex flex-col mb-1 group relative ${isMyMessage ? 'items-end' : 'items-start'}`}>
                                    <div className="text-xs text-slate-400 px-1 mb-1">
                                        {isMyMessage ? senderName : recipientName}
                                    </div>
                                    <div className={`flex items-end gap-2 ${isMyMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                                        <div className={`inline-block max-w-[80%] lg:max-w-sm rounded-lg px-2 py-2 text-sm break-words ${isMyMessage ? 'bg-cyan-600/50 text-white' : 'bg-slate-700/50 text-slate-200'}`}>
                                            {msg.text}
                                        </div>
                                        {!isReadOnly && <button onClick={() => setReactingToMessageId(reactingToMessageId === msg.id ? null : msg.id)} className="text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity text-xs pb-1">😊</button>}
                                    </div>
                                    {reactingToMessageId === msg.id && (
                                        <div className={`flex gap-2 p-1 bg-slate-800 rounded-full mt-1 ${isMyMessage ? 'mr-10' : 'ml-10'}`}>
                                            {QUICK_REACTIONS.map(emoji => (
                                                <button key={emoji} onClick={() => handleSendReaction(msg.id, emoji)} className="text-lg hover:scale-125 transition-transform">{emoji}</button>
                                            ))}
                                        </div>
                                    )}
                                    {msgReactions && (
                                        <div className={`flex gap-1 mt-1 flex-wrap ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                                            {Object.entries(msgReactions).map(([emoji, uids]) => {
                                                if (!Array.isArray(uids) || uids.length === 0) return null;

                                                const reactorNames = uids.map(uid => uidToNameMap[uid] || '...').join(', ');
                                                
                                                return (
                                                    <div key={emoji} title={reactorNames} className="bg-slate-700/50 rounded-full px-2 py-0.5 text-xs flex items-center gap-1 cursor-pointer">
                                                        <span>{emoji}</span>
                                                        <span className="text-slate-300 font-medium">
                                                            {uids.length > 1 ? uids.length : (uidToNameMap[uids[0]] || '...')}
                                                        </span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                    <span className="text-xs text-slate-500 mt-1 px-1">{onlineService.formatFullTimestamp(msg.timestamp)}</span>
                                </div>
                            )
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                     {showScrollButton && (
                        <button
                            onClick={() => scrollToBottom('smooth')}
                            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-slate-700/80 backdrop-blur-sm text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-slate-600 transition-all animate-fade-in-up"
                            aria-label="Scroll to latest messages"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    )}
                </div>

                {!isReadOnly && (
                    <div className="flex-shrink-0 p-2 border-t border-slate-700 relative">
                        {isEmojiPanelOpen && (
                            <div className="absolute bottom-full left-0 right-0 p-2 bg-slate-900/90 rounded-t-lg grid grid-cols-6 gap-1">
                                {EMOJIS.slice(0, 18).map(emoji => (
                                    <button key={emoji.id} onClick={() => handleEmojiSelect(emoji)} className="text-2xl rounded-md hover:bg-slate-700 transition-colors p-1">{emoji.emoji}</button>
                                ))}
                            </div>
                        )}
                        <div className="flex gap-1 overflow-x-auto scrollbar-hide mb-2">
                            {QUICK_CHATS.map(text => (
                                <button key={text} onClick={() => handleSendMessage(text)} className="flex-shrink-0 bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded-full hover:bg-slate-600">
                                    {text}
                                </button>
                            ))}
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(newMessage);}} className="flex gap-2">
                            <button type="button" onClick={() => setIsEmojiPanelOpen(p => !p)} className="bg-slate-700 text-lg px-3 rounded-lg hover:bg-slate-600">😊</button>
                            <div className="relative flex-grow">
                                <input 
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type a message..."
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 pr-12"
                                    maxLength={100}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">
                                    {newMessage.length}/100
                                </span>
                            </div>
                            <button type="submit" className="bg-cyan-500 text-black font-bold px-4 rounded-lg hover:bg-cyan-400">Send</button>
                        </form>
                    </div>
                )}
            </div>
             <style>{`
                @keyframes scale-in { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                .animate-scale-in { animation: scale-in 0.3s cubic-bezier(0.165, 0.84, 0.44, 1) forwards; }
                @keyframes fade-in-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default ChatBox;