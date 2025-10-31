import React, { useState, useEffect } from 'react';

interface EmoteProps {
    emoji: string;
    startRef: React.RefObject<HTMLDivElement>;
    onEnd: () => void;
}

const Emote: React.FC<EmoteProps> = ({ emoji, startRef, onEnd }) => {
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

    const isUrl = emoji.startsWith('assets/');

    if (startPos.top === 0) return null; // Don't render until position is calculated

    return (
        <div 
            className={`fixed text-5xl z-30 pointer-events-none ${isUrl ? 'animate-emote-gif-fall' : 'animate-emote-static-fall'}`}
            style={{
                top: startPos.top,
                left: startPos.left,
            }}
            onAnimationEnd={onEnd}
        >
            {isUrl ? <img src={emoji} alt="emote" className="w-16 h-16" /> : emoji}

            <style>{`
                /* Animation for GIF emojis */
                @keyframes emote-gif-fall-anim {
                    0% {
                        transform: translate(-50%, -50%) scale(0.5);
                        opacity: 0;
                    }
                    15% { /* Appear */
                        transform: translate(-50%, -50%) scale(1.2);
                        opacity: 1;
                    }
                    40% { /* Fall */
                        transform: translate(-50%, 200px) scale(1);
                        opacity: 1;
                    }
                    90% { /* Stay visible */
                        transform: translate(-50%, 200px) scale(1);
                        opacity: 1;
                    }
                    100% { /* Fade out */
                        transform: translate(-50%, 250px) scale(0.8);
                        opacity: 0;
                    }
                }
                .animate-emote-gif-fall {
                    animation: emote-gif-fall-anim 5s ease-out forwards;
                }

                /* Animation for static emojis with a wobble */
                @keyframes emote-static-fall-anim {
                    0% {
                        transform: translate(-50%, -50%) scale(0.5);
                        opacity: 0;
                    }
                    15% {
                        transform: translate(-50%, -50%) scale(1.2);
                        opacity: 1;
                    }
                    40% {
                        transform: translate(-50%, 200px) scale(1) rotate(0deg);
                        opacity: 1;
                    }
                    /* Wobble sequence starts after landing */
                    45% { transform: translate(-50%, 200px) scale(1.05) rotate(-5deg); }
                    50% { transform: translate(-50%, 200px) scale(1.05) rotate(5deg); }
                    55% { transform: translate(-50%, 200px) scale(1.02) rotate(-3deg); }
                    60% { transform: translate(-50%, 200px) scale(1.02) rotate(3deg); }
                    65% { transform: translate(-50%, 200px) scale(1) rotate(-1deg); }
                    70% { transform: translate(-50%, 200px) scale(1) rotate(1deg); }
                    75%, 90% { /* End wobble, stay still */
                        transform: translate(-50%, 200px) scale(1) rotate(0deg);
                        opacity: 1;
                    }
                    100% {
                        transform: translate(-50%, 250px) scale(0.8);
                        opacity: 0;
                    }
                }
                .animate-emote-static-fall {
                    animation: emote-static-fall-anim 5s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default Emote;