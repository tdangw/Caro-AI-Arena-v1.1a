import React, { useState, useEffect } from 'react';

interface ChatBubbleAnimationProps {
    text: string;
    startRef: React.RefObject<HTMLDivElement>;
    onEnd: () => void;
}

const ChatBubbleAnimation: React.FC<ChatBubbleAnimationProps> = ({ text, startRef, onEnd }) => {
    const [startPos, setStartPos] = useState({ top: 0, left: 0 });

    useEffect(() => {
        if (startRef.current) {
            const rect = startRef.current.getBoundingClientRect();
            setStartPos({
                top: rect.top + rect.height / 2,
                left: rect.left + rect.width / 2,
            });
        }
    }, [startRef]);

    if (startPos.top === 0) return null; // Don't render until position is calculated

    return (
        <div 
            className="fixed z-30 pointer-events-none animate-chat-bubble-fall"
            style={{
                top: startPos.top,
                left: startPos.left,
                transform: 'translate(-50%, -50%)',
            }}
            onAnimationEnd={onEnd}
        >
            <div className="bg-slate-800/80 backdrop-blur-sm text-white text-sm rounded-lg p-2 shadow-lg max-w-xs border border-slate-600 w-fit break-words">
                {text}
            </div>

            <style>{`
                @keyframes chat-bubble-fall-anim {
                    0% {
                        transform: translate(-50%, -50%) scale(0.5);
                        opacity: 0;
                    }
                    20% {
                        transform: translate(-50%, -50%) scale(1.1);
                        opacity: 1;
                    }
                    80% {
                        transform: translate(-50%, 250px) scale(1);
                        opacity: 1;
                    }
                    100% {
                        transform: translate(-50%, 300px) scale(0.8);
                        opacity: 0;
                    }
                }
                .animate-chat-bubble-fall {
                    animation: chat-bubble-fall-anim 3.5s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default ChatBubbleAnimation;