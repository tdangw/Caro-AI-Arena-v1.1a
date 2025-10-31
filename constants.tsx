import React, { useMemo } from 'react';
import type { GameTheme, PieceStyle, Cosmetic, BotProfile, Avatar, Emoji, PieceEffect, VictoryEffect, BoomEffect, MusicTrack, RankInfo, BoardStyle, AnimatedEmoji } from './types';

// --- Game Settings ---
export const BOARD_SIZE = 15;
export const WINNING_LENGTH = 5;
export const INITIAL_GAME_TIME = 900; // 15 minutes total for the game
export const TURN_TIME = 60; // 1 minutes per turn

// --- Rewards and Levels ---
export const COIN_REWARD = {
    win: 50,
    draw: 20,
    loss: 10,
};
export const XP_REWARD = {
    win: 30,
    draw: 10,
    loss: 5,
};

export const getXpForNextLevel = (level: number) => 100 + (level - 1) * 50;

// --- Player Status ---
export const PRESET_STATUS_MESSAGES = [
    "Available for a match!",
    "Happy 😊",
    "In love 🥰",
    "Feeling lucky 🍀",
    "Busy",
    "Just chilling...",
    "Up for a challenge!",
];


// --- Ranking System ---
export const RANKS = [
  { name: 'Sắt', tiers: 3, baseCp: 0, icon: '🛡️' }, // 0 - 299
  { name: 'Đồng', tiers: 3, baseCp: 300, icon: '🥉' }, // 300 - 599
  { name: 'Bạc', tiers: 3, baseCp: 600, icon: '🥈' }, // 600 - 899
  { name: 'Vàng', tiers: 3, baseCp: 900, icon: '🥇' }, // 900 - 1199
  { name: 'Kim Cương', tiers: 3, baseCp: 1200, icon: '💎' }, // 1200 - 1499
  { name: 'Cao Thủ', tiers: 3, baseCp: 1500, icon: '👑' }, // 1500 - 1799
  { name: 'Thách Đấu', tiers: 0, baseCp: 1800, icon: '🔥' }, // 1800+
];

export const getRankFromCp = (cp: number | null | undefined): RankInfo => {
  const currentCp = Number.isFinite(cp) ? Math.max(0, cp as number) : 0;
  let playerRank = RANKS[0];

  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (currentCp >= RANKS[i].baseCp) {
      playerRank = RANKS[i];
      break;
    }
  }

  if (playerRank.name === 'Thách Đấu') {
    return { name: `Thách Đấu`, cpInTier: currentCp, icon: playerRank.icon };
  }

  const cpIntoRank = currentCp - playerRank.baseCp;
  const tierCp = 100;
  const tier = playerRank.tiers - Math.floor(cpIntoRank / tierCp);
  const cpInTier = cpIntoRank % tierCp;
  const tierRoman = { 3: 'III', 2: 'II', 1: 'I' }[tier] || 'I';

  return { name: `${playerRank.name} ${tierRoman}`, cpInTier, icon: playerRank.icon };
};

/**
 * Calculates the change in Caro Points (CP) based on the Elo rating system.
 * @param playerCp The CP of the player for whom the change is being calculated.
 * @param opponentCp The CP of their opponent.
 * @param result The outcome of the game for the player ('win', 'loss', or 'draw').
 * @returns The number of CP points the player gains or loses.
 */
export const calculateCpChange = (playerCp: number, opponentCp: number, result: 'win' | 'loss' | 'draw'): number => {
    const K = 40; // K-factor, determines the maximum change in rating.
    const score = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
    
    // Calculate the expected score for the player against the opponent
    const expectedScore = 1 / (1 + Math.pow(10, (opponentCp - playerCp) / 400));
    
    // Calculate the change in rating
    const cpChange = K * (score - expectedScore);
    
    // Ensure wins grant at least 1 point and losses remove at least 1 point
    if (result === 'win') {
        return Math.max(1, Math.round(cpChange));
    }
    if (result === 'loss') {
        return Math.min(-1, Math.round(cpChange));
    }
    
    return Math.round(cpChange);
};


// --- SVG Icon Components ---
const Hexagon: React.FC<{ className?: string }> = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M17.2,3H6.8l-5.2,9l5.2,9h10.4l5.2-9L17.2,3z"/></svg>);
const Triangle: React.FC<{ className?: string }> = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12,2L1,21h22L12,2z"/></svg>);
const Plus: React.FC<{ className?: string }> = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>);
const Sun: React.FC<{ className?: string }> = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.03-3.58 2.37-6.53 5.5-7.65L8.5 3.5C4.73 4.83 2 8.57 2 13zm18 0c0-4.43-3.27-8.17-7.5-9.5L11.5 5.35c3.13 1.12 5.47 4.07 5.5 7.65h2zM12 5V3c4.42 0 8 3.58 8 8h-2c0-3.31-2.69-6-6-6zm0 14v2c-4.42 0-8-3.58-8-8h2c0 3.31 2.69 6 6 6z"/></svg>);
const Ghost: React.FC<{ className?: string }> = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.69 2 6 4.69 6 8v6c0 1.1.9 2 2 2h2v4h4v-4h2c1.1 0 2-.9 2-2V8c0-3.31-2.69-6-6-6zm-2 10c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm4 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg>);
const PeaceSign: React.FC<{ className?: string }> = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v5.5l3.5 3.5-1.42 1.42L11 13.41V7z"/></svg>);
const Circle: React.FC<{ className?: string }> = ({ className }) => (<svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="12"/></svg>);
const Cross: React.FC<{ className?: string }> = ({ className }) => (<svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 10 L90 90 M90 10 L10 90" stroke="currentColor" strokeWidth="12" strokeLinecap="round"/></svg>);

const Diamond: React.FC<{ className?: string }> = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 L2 12 L12 22 L22 12 Z"/></svg>);
const Star: React.FC<{ className?: string }> = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>);
const Heart: React.FC<{ className?: string }> = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>);
const MusicNote: React.FC<{ className?: string }> = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>);
const Bolt: React.FC<{ className?: string }> = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>);
const Planet: React.FC<{ className?: string }> = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.53c-.25.58-.56 1.12-.9 1.6l-2.8-2.81c.81-.43 1.51-1.03 2-1.79.49-.76.79-1.68.8-2.65.01-.98-.24-1.92-.7-2.75l1.45-1.45C18.53 7.8 19 9.83 19 12c0 2.21-.81 4.24-2.1 5.86v.01z"/></svg>);
const Shield: React.FC<{ className?: string }> = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>);
const Square: React.FC<{ className?: string }> = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M3 3v18h18V3H3zm16 16H5V5h14v14z"/></svg>);
const Anchor: React.FC<{ className?: string }> = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-14h2v4h3v2h-3v4h-2v-4H8v-2h3V6z"/></svg>);
const Bug: React.FC<{ className?: string }> = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M19 8h-1.81c-.45-1.73-1.98-3-3.88-3s-3.43 1.27-3.88 3H7.69l-1.63 4.9A2 2 0 0 0 8 15h8a2 2 0 0 0 1.94-2.1L16.31 8h1.88c.55 0 1-.45 1-1s-.45-1-1-1zm-7 8c-1.66 0-3-1.34-3-3h6c0 1.66-1.34 3-3 3z"/></svg>);
const Crown: React.FC<{ className?: string }> = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z"/></svg>);
const Eye: React.FC<{ className?: string }> = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 13c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"/></svg>);
const Flag: React.FC<{ className?: string }> = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6z"/></svg>);
const Dragon: React.FC<{ className?: string }> = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1,9 L5,5 L9,9 L13,5 L17,9 L21,5 L23,7 L19,11 L23,15 L21,17 L17,13 L13,17 L9,13 L5,17 L1,13 L5,9 M9,11 A2,2 0 1,1 9,10.99" /></svg>);
const YinYang: React.FC<{ className?: string }> = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8v16zM12 5.5A1.5 1.5 0 1 1 12 8.5 1.5 1.5 0 0 1 12 5.5zm0 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>);
const Atom: React.FC<{ className?: string }> = ({ className }) => (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(45 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-45 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(90 12 12)"/></svg>);
const Biohazard: React.FC<{ className?: string }> = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M15.42 16.62c.69.41 1.25.98 1.66 1.67.4-.7.95-1.25 1.64-1.65-.69-.4-1.25-.96-1.65-1.65a4.34 4.34 0 0 1-1.65 1.63M8.58 16.62a4.34 4.34 0 0 1-1.65-1.63c-.4.7-.96 1.25-1.65 1.65.69.4 1.25.95 1.65 1.65.41-.7.97-1.26 1.65-1.67M12 8.3c.7 0 1.25.56 1.25 1.25S12.7 10.8 12 10.8s-1.25-.56-1.25-1.25S11.3 8.3 12 8.3m0-2.5c-2.07 0-3.75 1.68-3.75 3.75S9.93 13.3 12 13.3s3.75-1.68 3.75-3.75S14.07 5.8 12 5.8m0-3.8C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-3.42-3.05c.41-.7.97-1.26 1.65-1.67-.69-.41-1.25-.98-1.66-1.67-.4.7-.95 1.25-1.64 1.65.7.41 1.25.96 1.65 1.69z"/></svg>);
const Leaf: React.FC<{ className?: string }> = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66C7.32 17.33 10 12 17 10V8m-2-6h2v2h-2V2z"/><path d="M15 4c-3.9 2-6.2 8-8.18 13.34l1.89.66C10.32 12.33 13 6 15 4z"/></svg>);
const Flower: React.FC<{ className?: string }> = ({ className }) => (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4m0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m6.5 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m-13 0C4.4 10 3.5 10.9 3.5 12s.9 2 2 2 2-.9 2-2-.9-2-2-2m2 13c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2m9-13c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m-9 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m2-2.5c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m9 9c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>);


// --- Theme Decorators ---
const IceThemeDecorator: React.FC = React.memo(() => (
    <>
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {[...Array(25)].map((_, i) => (
                <div key={i} className="absolute text-cyan-200/50" style={{
                    top: '-10%',
                    left: `${-10 + Math.random() * 120}%`,
                    fontSize: `${0.8 + Math.random() * 1.2}rem`,
                    animationName: 'snowfall, sway',
                    animationDuration: `${10 + Math.random() * 10}s, ${4 + Math.random() * 4}s`,
                    animationDelay: `${Math.random() * 15}s, ${Math.random() * 4}s`,
                    animationTimingFunction: 'linear, ease-in-out',
                    animationIterationCount: 'infinite, infinite',
                    // @ts-ignore
                    '--sway-amount': `${(Math.random() - 0.5) * 80}px`,
                }}>
                    ❄
                </div>
            ))}
        </div>
        <style>{`
            @keyframes snowfall {
                from {
                    transform: translateY(0vh) rotate(0deg);
                    opacity: 1;
                }
                to {
                    transform: translateY(105vh) rotate(720deg);
                    opacity: 0;
                }
            }
             @keyframes sway {
                0%, 100% { margin-left: 0; }
                50% { margin-left: var(--sway-amount); }
            }
        `}</style>
    </>
));
const RetroThemeDecorator: React.FC = React.memo(() => (
    <>
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-20 animate-scanlines"></div>
         <style>{`
            @keyframes scanlines {
                0% { background-position: 0 0; }
                100% { background-position: 0 50px; }
            }
            .animate-scanlines {
                background: linear-gradient(to bottom, transparent 0%, transparent 50%, rgba(24, 24, 27, 0.5) 50%, rgba(24, 24, 27, 0.5) 100%);
                background-size: 100% 4px;
                animation: scanlines 0.5s linear infinite;
            }
        `}</style>
    </>
));
const RubyThemeDecorator: React.FC = React.memo(() => (
     <>
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {[...Array(15)].map((_,i) => (
                <div key={i} className="absolute text-pink-400/50" style={{
                    top: `${Math.random() * 100}%`,
                    left: `${Math.random() * 100}%`,
                    fontSize: `${0.5 + Math.random() * 1}rem`,
                    animationName: 'glint, drift',
                    animationDelay: `${Math.random() * 8}s`,
                    animationDuration: `${4 + Math.random() * 4}s, ${4 + Math.random() * 4}s`,
                    animationTimingFunction: 'ease-in-out, linear',
                    animationIterationCount: 'infinite, infinite',
                }}>✦</div>
            ))}
        </div>
         <style>{`
            @keyframes glint {
                0%, 100% { transform: scale(0.8); opacity: 0; }
                50% { transform: scale(1.5); opacity: 1; }
                75% { transform: scale(1.2); opacity: 0.8; }
            }
            @keyframes drift {
                from { transform: translateY(0); }
                to { transform: translateY(-80px); opacity: 0; }
            }
        `}</style>
    </>
));
const AutumnThemeDecorator: React.FC = React.memo(() => (
    <>
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {[...Array(12)].map((_, i) => (
                <div key={i} className="absolute text-orange-400/50" style={{
                    top: '-10%',
                    left: `${-10 + Math.random() * 120}%`,
                    fontSize: `${1 + Math.random() * 1.5}rem`,
                    animationName: 'fall, sway',
                    animationDuration: `${7 + Math.random() * 8}s, ${4 + Math.random() * 5}s`,
                    animationDelay: `${Math.random() * 10}s, ${Math.random() * 5}s`,
                    animationTimingFunction: 'linear, ease-in-out',
                    animationIterationCount: 'infinite, infinite',
                    // @ts-ignore
                    '--sway-amount': `${(Math.random() - 0.5) * 150}px`,
                }}>
                    {Math.random() > 0.5 ? '🍁' : '🍂'}
                </div>
            ))}
        </div>
        <style>{`
            @keyframes fall {
                to {
                    transform: translateY(105vh) rotate(720deg);
                    opacity: 0;
                }
            }
            @keyframes sway {
                0%, 100% { margin-left: 0px; }
                50% { margin-left: var(--sway-amount); }
            }
        `}</style>
    </>
));
const SpringThemeDecorator: React.FC = React.memo(() => (
    <>
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {[...Array(15)].map((_, i) => (
                <div key={i} className="absolute text-pink-200/60" style={{
                    top: '-10%',
                    left: `${-10 + Math.random() * 120}%`,
                    fontSize: `${0.8 + Math.random() * 1.2}rem`,
                    animationName: 'fall, sway',
                    animationDuration: `${8 + Math.random() * 7}s, ${5 + Math.random() * 5}s`,
                    animationDelay: `${Math.random() * 12}s, ${Math.random() * 5}s`,
                    animationTimingFunction: 'linear, ease-in-out',
                    animationIterationCount: 'infinite, infinite',
                    // @ts-ignore
                    '--sway-amount': `${(Math.random() - 0.5) * 120}px`,
                }}>
                    🌸
                </div>
            ))}
        </div>
        <style>{`
            @keyframes fall {
                to { transform: translateY(105vh) rotate(720deg); opacity: 0; }
            }
            @keyframes sway {
                0%, 100% { margin-left: 0; }
                50% { margin-left: var(--sway-amount); }
            }
        `}</style>
    </>
));

const SummerThemeDecorator: React.FC = React.memo(() => (
    <>
        {/* Sun */}
        <div className="absolute -top-24 -right-24 w-96 h-96 pointer-events-none z-0">
            <div className="absolute inset-0 bg-yellow-300 rounded-full blur-3xl animate-pulse-slow opacity-10"></div>
            <div className="absolute inset-10 bg-yellow-200 rounded-full blur-2xl animate-pulse-slow opacity-20"></div>
        </div>
        
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* God Rays */}
            {[...Array(3)].map((_, i) => (
                <div key={i} className="absolute h-[150%] w-[150%]" style={{
                    top: '-25%', right: '-25%',
                    background: 'linear-gradient(225deg, rgba(253, 224, 71, 0.08), rgba(253, 224, 71, 0))',
                    transformOrigin: 'top right',
                    animation: `god-ray-pulse 8s ease-in-out infinite ${i * 2.5}s`,
                }}></div>
            ))}
             {/* Rain Shower */}
            {[...Array(30)].map((_, i) => (
                <div key={i} className="absolute w-0.5 h-12 bg-gradient-to-b from-cyan-200/0 to-cyan-200/30" style={{
                    top: '-20%', left: `${Math.random() * 100}%`,
                    animation: `rain-fall ${0.5 + Math.random() * 0.5}s linear infinite`,
                    animationDelay: `${Math.random() * 5}s`
                }}></div>
            ))}
        </div>
        <style>{`
            @keyframes pulse-slow { 50% { opacity: 0.4; transform: scale(1.05); } }
            .animate-pulse-slow { animation: pulse-slow 10s ease-in-out infinite; }
            @keyframes god-ray-pulse {
                0%, 100% { opacity: 0; transform: rotate(15deg); }
                50% { opacity: 0.6; transform: rotate(20deg); }
            }
            @keyframes rain-fall {
                from { transform: translateY(0vh); }
                to { transform: translateY(120vh); }
            }
        `}</style>
    </>
));

const WinterThemeDecorator: React.FC = React.memo(() => (
    <>
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {[...Array(40)].map((_, i) => (
                <div key={i} className="absolute text-blue-200/60" style={{
                    top: '-10%',
                    left: `${-10 + Math.random() * 120}%`,
                    fontSize: `${0.6 + Math.random() * 1.0}rem`,
                    animationName: 'snowfall, sway',
                    animationDuration: `${8 + Math.random() * 8}s, ${3 + Math.random() * 4}s`,
                    animationDelay: `${Math.random() * 12}s, ${Math.random() * 4}s`,
                    animationTimingFunction: 'linear, ease-in-out',
                    animationIterationCount: 'infinite, infinite',
                    // @ts-ignore
                    '--sway-amount': `${(Math.random() - 0.5) * 120}px`,
                }}>
                    {Math.random() > 0.3 ? '❄' : '•'}
                </div>
            ))}
        </div>
        <style>{`
            @keyframes snowfall {
                from {
                    transform: translateY(0vh) rotate(0deg);
                    opacity: 1;
                }
                to {
                    transform: translateY(105vh) rotate(360deg);
                    opacity: 0;
                }
            }
             @keyframes sway {
                0%, 100% { margin-left: 0; }
                50% { margin-left: var(--sway-amount); }
            }
        `}</style>
    </>
));

const SpaceThemeDecorator: React.FC = React.memo(() => (
    <>
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {/* Twinkling Stars */}
            {[...Array(60)].map((_, i) => (
                <div key={`star-${i}`} className="absolute w-0.5 h-0.5 bg-white rounded-full animate-twinkle" style={{
                    top: `${Math.random() * 100}%`,
                    left: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 10}s`,
                    animationDuration: `${2 + Math.random() * 3}s`,
                    opacity: Math.random() * 0.5 + 0.2,
                }}/>
            ))}
             {/* Shooting Stars */}
            {[...Array(3)].map((_, i) => (
                 <div key={`shooting-star-${i}`} className="absolute h-0.5 w-24 bg-gradient-to-l from-white/50 to-transparent animate-shooting-star" style={{
                    top: `${Math.random() * 60 - 10}%`,
                    left: `${Math.random() * 60 + 50}%`,
                    animationDelay: `${3 + Math.random() * 12}s`,
                    animationDuration: `${1.5 + Math.random() * 1}s`,
                 }} />
            ))}
        </div>
        <style>{`
            @keyframes twinkle {
                0%, 100% { opacity: 0.2; transform: scale(0.8); }
                50% { opacity: 1; transform: scale(1.2); filter: drop-shadow(0 0 3px white); }
            }
            .animate-twinkle { animation: twinkle ease-in-out infinite; }

            @keyframes shooting-star {
                from {
                    transform: rotate(135deg) translateX(0);
                    opacity: 1;
                }
                to {
                    transform: rotate(135deg) translateX(150vmin);
                    opacity: 0;
                }
            }
            .animate-shooting-star { animation: shooting-star linear infinite; }
        `}</style>
    </>
));

const FireThemeDecorator: React.FC = React.memo(() => (
    <>
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-orange-900/40 to-transparent pointer-events-none z-0 animate-pulse-slow"></div>
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {[...Array(25)].map((_, i) => (
                <div key={i} className="absolute rounded-full" style={{
                    bottom: '-5%',
                    left: `${Math.random() * 100}%`,
                    width: `${2 + Math.random() * 3}px`,
                    height: `${2 + Math.random() * 3}px`,
                    backgroundColor: `rgba(251, 146, 60, ${0.5 + Math.random() * 0.5})`, // orange-400
                    boxShadow: '0 0 6px 3px #f97316, 0 0 12px 6px #ef4444', // orange-500, red-500
                    animationName: 'emberRise, emberWobble',
                    animationDuration: `${4 + Math.random() * 6}s, ${3 + Math.random() * 3}s`,
                    animationDelay: `${Math.random() * 8}s, ${Math.random() * 3}s`,
                    animationTimingFunction: 'linear, ease-in-out',
                    animationIterationCount: 'infinite, infinite',
                    // @ts-ignore
                    '--wobble-amount': `${(Math.random() - 0.5) * 80}px`,
                }}>
                </div>
            ))}
        </div>
        <style>{`
            @keyframes emberRise {
                from {
                    transform: translateY(0) scale(1);
                    opacity: 1;
                }
                to {
                    transform: translateY(-105vh) scale(0.5);
                    opacity: 0;
                }
            }
             @keyframes emberWobble {
                0%, 100% { margin-left: 0; }
                50% { margin-left: var(--wobble-amount); }
            }
            @keyframes pulse-slow { 
                50% { opacity: 0.6; } 
            }
            .animate-pulse-slow { animation: pulse-slow 6s ease-in-out infinite; }
        `}</style>
    </>
));

const ForestThemeDecorator: React.FC = React.memo(() => (
    <>
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {/* Grass and Butterflies */}
            {/* Bottom Left Corner */}
            <div className="absolute bottom-0 left-0 w-48 h-32">
                <div className="absolute bottom-0 left-4 w-1 h-12 bg-green-400/30 rounded-t-full transform -rotate-12"></div>
                <div className="absolute bottom-0 left-8 w-1 h-16 bg-green-400/40 rounded-t-full transform rotate-6"></div>
                <div className="absolute bottom-0 left-12 w-1.5 h-20 bg-green-300/50 rounded-t-full transform -rotate-6"></div>
                {/* Butterfly 1 */}
                <div className="absolute bottom-16 left-10 text-3xl animate-butterfly-flap" style={{ animationDelay: '0.5s' }}>
                    🦋
                </div>
            </div>

            {/* Bottom Right Corner */}
            <div className="absolute bottom-0 right-0 w-48 h-40">
                <div className="absolute bottom-0 right-4 w-1 h-16 bg-green-400/30 rounded-t-full transform rotate-12"></div>
                <div className="absolute bottom-0 right-8 w-1 h-20 bg-green-400/40 rounded-t-full transform -rotate-6"></div>
                <div className="absolute bottom-0 right-12 w-1.5 h-24 bg-green-300/50 rounded-t-full transform rotate-6"></div>
                 {/* Butterfly 2 */}
                <div className="absolute bottom-20 right-14 text-2xl animate-butterfly-flap" style={{ animationDelay: '1.2s' }}>
                    🦋
                </div>
            </div>
        </div>
        <style>{`
            @keyframes butterfly-flap {
                0%, 100% { transform: scaleY(1) translateY(0) rotate(-15deg); }
                25% { transform: scaleY(0.2) translateY(5px) rotate(-15deg); }
                50% { transform: scaleY(1) translateY(0) rotate(-15deg); }
                75% { transform: scaleY(0.2) translateY(5px) rotate(-15deg); }
            }
            .animate-butterfly-flap {
                animation: butterfly-flap 2.5s ease-in-out infinite;
            }
        `}</style>
    </>
));

// --- Game Themes ---
export const DEFAULT_THEME: GameTheme = { id: 'theme_default', name: 'Default', boardBg: 'bg-slate-900', cellBg: 'bg-transparent', gridColor: 'border-slate-500', nameColor: 'text-white' };

export const THEMES: GameTheme[] = [
    { id: 'theme_ice', name: 'Ice', boardBg: 'bg-[#0c1a3e]', boardBgImage: 'assets/themes/ice.png', cellBg: 'bg-transparent', gridColor: 'border-cyan-400/50', nameColor: 'text-cyan-100', decoratorComponent: IceThemeDecorator },
    { id: 'theme_retro', name: 'Retro', boardBg: 'bg-[#281e36]', boardBgImage: 'assets/themes/retro.png', cellBg: 'bg-transparent', gridColor: 'border-yellow-400/50', nameColor: 'text-yellow-100', decoratorComponent: RetroThemeDecorator },
    { id: 'theme_ruby', name: 'Ruby', boardBg: 'bg-[#3b0f2d]', boardBgImage: 'assets/themes/ruby.png', cellBg: 'bg-transparent', gridColor: 'border-pink-400/50', nameColor: 'text-pink-100', decoratorComponent: RubyThemeDecorator },
    { id: 'theme_autumn', name: 'Autumn', boardBg: 'bg-[#4a2525]', boardBgImage: 'assets/themes/autumn.png', cellBg: 'bg-transparent', gridColor: 'border-orange-400/50', nameColor: 'text-orange-100', decoratorComponent: AutumnThemeDecorator },
    { id: 'theme_spring', name: 'Spring', boardBg: 'bg-[#4d7c5a]', boardBgImage: 'assets/themes/spring.png', cellBg: 'bg-transparent', gridColor: 'border-pink-200/60', nameColor: 'text-pink-50', decoratorComponent: SpringThemeDecorator },
    { id: 'theme_summer', name: 'Summer', boardBg: 'bg-[#005f73]', boardBgImage: 'assets/themes/summer.png', cellBg: 'bg-transparent', gridColor: 'border-yellow-200/50', nameColor: 'text-yellow-50', decoratorComponent: SummerThemeDecorator },
    { id: 'theme_winter', name: 'Winter', boardBg: 'bg-[#1a2b4a]', boardBgImage: 'assets/themes/winter.png', cellBg: 'bg-transparent', gridColor: 'border-blue-200/50', nameColor: 'text-blue-100', decoratorComponent: WinterThemeDecorator },
    { id: 'theme_space', name: 'Space', boardBg: 'bg-[#0c0a1f]', boardBgImage: 'assets/themes/space.png', cellBg: 'bg-transparent', gridColor: 'border-purple-400/50', nameColor: 'text-purple-200', decoratorComponent: SpaceThemeDecorator },
    { id: 'theme_fire', name: 'Fire', boardBg: 'bg-[#2d0d0d]', boardBgImage: 'assets/themes/fire.png', cellBg: 'bg-transparent', gridColor: 'border-orange-500/50', nameColor: 'text-yellow-200', decoratorComponent: FireThemeDecorator },
    { id: 'theme_forest', name: 'Forest', boardBg: 'bg-[#1c3d1c]', boardBgImage: 'assets/themes/forest.png', cellBg: 'bg-transparent', gridColor: 'border-green-400/50', nameColor: 'text-green-100', decoratorComponent: ForestThemeDecorator },
];

// --- Board Styles ---
export const DEFAULT_BOARD_STYLE: BoardStyle = {
    id: 'board_default',
    name: 'Default',
    style: {
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        borderWidth: '2px',
        borderStyle: 'solid',
    },
};

export const BOARD_STYLES: BoardStyle[] = [
    {
        id: 'board_ice', name: 'Băng giá',
        style: { backgroundColor: 'rgba(2, 6, 23, 0.5)', borderColor: '#22d3ee', boxShadow: '0 0 20px #22d3ee', borderWidth: '2px', borderStyle: 'solid' }
    },
    {
        id: 'board_fire', name: 'Lửa',
        style: { backgroundColor: 'rgba(30, 7, 0, 0.5)', borderColor: '#f87171', boxShadow: '0 0 20px #f87171', borderWidth: '2px', borderStyle: 'solid' }
    },
    {
        id: 'board_forest', name: 'Rừng',
        style: { backgroundColor: 'rgba(4, 20, 10, 0.5)', borderColor: '#34d399', boxShadow: '0 0 20px #34d399', borderWidth: '2px', borderStyle: 'solid' }
    },
    {
        id: 'board_autumn', name: 'Mùa thu',
        style: { backgroundColor: 'rgba(40, 15, 0, 0.5)', borderColor: '#fb923c', boxShadow: '0 0 20px #fb923c', borderWidth: '2px', borderStyle: 'solid' }
    },
    {
        id: 'board_celestial', name: 'Celestial',
        style: { 
            backgroundColor: 'rgba(19, 15, 46, 0.6)', 
            borderColor: '#a78bfa',
            borderWidth: '2px',
            borderStyle: 'solid',
            boxShadow: '0 0 25px #a78bfa, inset 0 0 10px rgba(167, 139, 250, 0.5)' 
        }
    }
];


// --- Piece Styles ---
export const DEFAULT_PIECES_X: PieceStyle = { id: 'piece_default_x', name: 'Cross', component: Cross };
export const DEFAULT_PIECES_O: PieceStyle = { id: 'piece_default_o', name: 'Circle', component: Circle };

export const PIECE_STYLES: PieceStyle[] = [
    { id: 'piece_hexagon', name: 'Hexagon', component: Hexagon },
    { id: 'piece_triangle', name: 'Triangle', component: Triangle },
    { id: 'piece_plus', name: 'Plus', component: Plus },
    { id: 'piece_sun', name: 'Sun', component: Sun },
    { id: 'piece_ghost', name: 'Ghost', component: Ghost },
    { id: 'piece_peace', name: 'Peace Sign', component: PeaceSign },
    { id: 'piece_diamond', name: 'Diamond', component: Diamond },
    { id: 'piece_star', name: 'Star', component: Star },
    { id: 'piece_heart', name: 'Heart', component: Heart },
    { id: 'piece_music', name: 'Music Note', component: MusicNote },
    { id: 'piece_bolt', name: 'Bolt', component: Bolt },
    { id: 'piece_planet', name: 'Planet', component: Planet },
    { id: 'piece_shield', name: 'Shield', component: Shield },
    { id: 'piece_square', name: 'Square', component: Square },
    { id: 'piece_anchor', name: 'Anchor', component: Anchor },
    { id: 'piece_bug', name: 'Bug', component: Bug },
    { id: 'piece_crown', name: 'Crown', component: Crown },
    { id: 'piece_eye', name: 'Eye', component: Eye },
    { id: 'piece_flag', name: 'Flag', component: Flag },
    { id: 'piece_dragon', name: 'Dragon', component: Dragon },
    { id: 'piece_yin_yang', name: 'Yin Yang', component: YinYang },
    { id: 'piece_atom', name: 'Atom', component: Atom },
    { id: 'piece_biohazard', name: 'Biohazard', component: Biohazard },
    { id: 'piece_leaf', name: 'Leaf', component: Leaf },
    { id: 'piece_flower', name: 'Flower', component: Flower },
];

// --- Avatars ---
export const DEFAULT_AVATAR: Avatar = { id: 'avatar_default', name: 'Guest', url: 'assets/avatars/avatar_1.png' };
export const AVATARS: Avatar[] = [
    { id: 'avatar_2', name: 'Rebel', url: 'assets/avatars/avatar_2.png' },
    { id: 'avatar_3', name: 'Scholar', url: 'assets/avatars/avatar_3.png' },
    { id: 'avatar_4', name: 'Ninja', url: 'assets/avatars/avatar_4.png' },
    { id: 'avatar_5', name: 'Knight', url: 'assets/avatars/avatar_5.png' },
    { id: 'avatar_6', name: 'Shadow', url: 'assets/avatars/avatar_6.png' },
];

// --- Emojis ---
export const EMOJIS: Emoji[] = [
    { id: 'emoji_wave', name: 'Wave', emoji: '👋' },
    { id: 'emoji_cool', name: 'Cool', emoji: '😎' },
    { id: 'emoji_laugh', name: 'Laugh', emoji: '😂' },
    { id: 'emoji_wow', name: 'Wow', emoji: '😮' },
    { id: 'emoji_think', name: 'Thinking', emoji: '🤔' },
    { id: 'emoji_gg', name: 'Good Game', emoji: '🤝' },
    { id: 'emoji_thumbs_up', name: 'Thumbs Up', emoji: '👍' },
    { id: 'emoji_clap', name: 'Clapping', emoji: '👏' },
    { id: 'emoji_fire', name: 'Fire', emoji: '🔥' },
    { id: 'emoji_mind_blown', name: 'Mind Blown', emoji: '🤯' },
    { id: 'emoji_cry', name: 'Crying', emoji: '😭' },
    { id: 'emoji_angry', name: 'Angry', emoji: '😠' },
    { id: 'emoji_sleep', name: 'Sleeping', emoji: '😴' },
    { id: 'emoji_facepalm', name: 'Facepalm', emoji: '🤦' },
    { id: 'emoji_shrug', name: 'Shrug', emoji: '🤷' },
    { id: 'emoji_heart', name: 'Heart', emoji: '❤️' },
    { id: 'emoji_rocket', name: 'Rocket', emoji: '🚀' },
    { id: 'emoji_star_struck', name: 'Star-Struck', emoji: '🤩' },
    { id: 'emoji_wink', name: 'Wink', emoji: '😉' },
    { id: 'emoji_eyes', name: 'Eyes', emoji: '👀' },
    { id: 'emoji_pray', name: 'Pray', emoji: '🙏' },
    { id: 'emoji_celebrate', name: 'Celebrate', emoji: '🎉' },
    { id: 'emoji_sad', name: 'Sad', emoji: '😢' },
    { id: 'emoji_zany', name: 'Zany', emoji: '🤪' },
    { id: 'emoji_skull', name: 'Skull', emoji: '💀' },
    { id: 'emoji_clown', name: 'Clown', emoji: '🤡' },
    { id: 'emoji_fleur', name: 'Fleur-de-lis', emoji: '⚜️' },
    { id: 'emoji_dragon', name: 'Dragon', emoji: '🐉' },
    { id: 'emoji_robot', name: 'Robot', emoji: '🤖' },
    { id: 'emoji_tophat', name: 'Top Hat', emoji: '🎩' },
];

export const ANIMATED_EMOJIS: AnimatedEmoji[] = [
    { id: 'anim_emoji_laugh', name: 'Laughing GIF', url: 'assets/emojis/laughing.gif' },
    { id: 'anim_emoji_smile', name: 'Smile', url: 'assets/emojis/smile.gif' },
];


// --- Piece Placement Effects ---
const EffectComponent: React.FC<{className?: string}> = ({className}) => ( <div className={className}><div /></div> );

// Previews
const DropPreview: React.FC = () => (<svg viewBox="0 0 100 100"><path d="M50 10 L50 70 M30 50 L50 70 L70 50" stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round"/><circle cx="50" cy="80" r="10" fill="currentColor" /></svg>);
const RotatePreview: React.FC = () => (<svg viewBox="0 0 100 100"><path d="M 50,50 m -35,0 a 35,35 0 1,0 70,0 a 35,35 0 1,0 -70,0" stroke="currentColor" strokeWidth="6" fill="none" strokeDasharray="150 220" strokeDashoffset="0"></path><path d="M80 50 L65 40 M80 50 L65 60" stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round" /></svg>);
const FlashPreview: React.FC = () => (<svg viewBox="0 0 100 100" className="text-yellow-300"><path d="M50 10 L55 45 L90 50 L55 55 L50 90 L45 55 L10 50 L45 45 Z" fill="currentColor" /></svg>);
const PhasePreview: React.FC = () => (<svg viewBox="0 0 100 100" className="text-purple-400"><circle cx="50" cy="50" r="15" stroke="currentColor" strokeWidth="4" fill="none" /><circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="4 8" /></svg>);
const RipplePreview: React.FC = () => (<svg viewBox="0 0 100 100" className="text-cyan-400"><circle cx="50" cy="50" r="10" stroke="currentColor" strokeWidth="4" fill="none"><animate attributeName="r" from="10" to="40" dur="1s" repeatCount="indefinite" begin="0s"/><animate attributeName="opacity" from="1" to="0" dur="1s" repeatCount="indefinite" begin="0s"/></circle></svg>);
const WarpPreview: React.FC = () => (<svg viewBox="0 0 100 100" className="text-blue-400"><path d="M50 10 L50 90 M10 50 L90 50" stroke="currentColor" strokeWidth="6" strokeDasharray="10 15" strokeLinecap="round" /><circle cx="50" cy="50" r="10" fill="currentColor" /></svg>);

const getEffectStyles = () => `
  /* Universal Glow for all effects */
  @keyframes piece-glow {
    0%, 100% { filter: drop-shadow(0 0 2px transparent); }
    50% { filter: drop-shadow(0 0 12px currentColor) drop-shadow(0 0 5px currentColor) brightness(1.2); }
  }

  /* Drop: Piece falls from above and lands with a bounce. */
  @keyframes piece-drop-fall {
    0% { transform: translateY(-200%); opacity: 0; }
    80% { transform: translateY(0); opacity: 1; }
    90% { transform: translateY(-10%); }
    100% { transform: translateY(0); }
  }
  .animate-effect_drop { animation: piece-drop-fall 0.4s cubic-bezier(0.5, 0, 0.25, 1.5) forwards; }

  /* Rotate: Spins 360 degrees. */
  @keyframes piece-rotate-spin {
    from { transform: rotate(-360deg) scale(0.5); opacity: 0; }
    to { transform: rotate(0deg) scale(1); opacity: 1; }
  }
  .animate-effect_rotate { animation: piece-rotate-spin 0.35s ease-out forwards; }

  /* Flash: An elegant, bright golden flash that bursts outwards */
  @keyframes piece-flash-burst {
    0% { transform: scale(0); opacity: 0.8; }
    100% { transform: scale(1.8); opacity: 0; }
  }
   @keyframes piece-flash-self {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); filter: brightness(3); }
  }
  .animate-effect_flash { animation: piece-flash-self 0.3s ease-in-out forwards; }
  .animate-effect_flash::after {
    content: '';
    position: absolute;
    inset: -20%;
    border-radius: 99px;
    background: radial-gradient(circle, currentColor 0%, transparent 70%);
    opacity: 0;
    transform: scale(0);
    animation: piece-flash-burst 0.35s ease-out forwards;
  }

  /* Phase: Holographic activation rings, no longer obscures piece */
  @keyframes piece-phase-fade-in {
    from { opacity: 0; transform: scale(0.8); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes piece-phase-rings {
    from { transform: scale(0.5); opacity: 1; }
    to { transform: scale(1.5); opacity: 0; }
  }
  .animate-effect_phase { animation: piece-phase-fade-in 0.4s ease-out forwards; }
  .animate-effect_phase::before, .animate-effect_phase::after {
    content: '';
    position: absolute;
    inset: 0;
    border: 2px solid currentColor;
    border-radius: 99px;
    opacity: 0;
    transform: scale(0.5);
    animation: piece-phase-rings 0.45s ease-out forwards;
  }
  .animate-effect_phase::after { animation-delay: 0.1s; }

  /* Ripple: Expanding shockwave */
  @keyframes piece-ripple {
    from { transform: scale(0); opacity: 0.7; }
    to { transform: scale(3); opacity: 0; }
  }
  .animate-effect_ripple { animation: piece-glow 0.5s ease-out forwards; }
  .animate-effect_ripple::before {
    content: ''; position: absolute; inset: 0; border-radius: 99px;
    border: 3px solid currentColor;
    animation: piece-ripple 0.4s ease-out forwards;
  }

  /* Warp: Scales up from the center. */
  @keyframes piece-warp-in {
    from { transform: scale(0); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
  .animate-effect_warp { animation: piece-warp-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
`;

export const EffectStyles: React.FC = () => (<style>{getEffectStyles()}</style>);


export const DEFAULT_EFFECT: PieceEffect = { id: 'effect_flash', name: 'Flash', component: EffectComponent, previewComponent: FlashPreview };

export const PIECE_EFFECTS: PieceEffect[] = [
    { id: 'effect_rotate', name: 'Rotate', component: EffectComponent, previewComponent: RotatePreview },
    { id: 'effect_drop', name: 'Drop', component: EffectComponent, previewComponent: DropPreview },
    { id: 'effect_phase', name: 'Phase', component: EffectComponent, previewComponent: PhasePreview },
    { id: 'effect_ripple', name: 'Ripple', component: EffectComponent, previewComponent: RipplePreview },
    { id: 'effect_warp', name: 'Warp', component: EffectComponent, previewComponent: WarpPreview },
];

// --- VICTORY & BOOM EFFECTS ---

// Victory Previews
const DefaultVictoryPreview: React.FC = () => (<svg viewBox="0 0 100 100" className="text-yellow-300"><path d="M50 10 L55 45 L90 50 L55 55 L50 90 L45 55 L10 50 L45 45 Z" fill="currentColor" /><path d="M20 20 L30 30 M70 30 L80 20 M70 70 L80 80 M20 80 L30 70" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg>);
const ConfettiPreview: React.FC = () => (<svg viewBox="0 0 100 100"><g transform="translate(15 15) scale(0.7)"><rect x="10" y="20" width="15" height="8" fill="#34D399" transform="rotate(-30 17.5 24)" /><rect x="50" y="15" width="15" height="8" fill="#F472B6" transform="rotate(20 57.5 19)" /><rect x="70" y="60" width="15" height="8" fill="#60A5FA" transform="rotate(-10 77.5 64)" /><rect x="25" y="70" width="15" height="8" fill="#FBBF24" transform="rotate(40 32.5 74)" /></g></svg>);
const FireworksPreview: React.FC = () => (<svg viewBox="0 0 100 100"><g strokeWidth="4" strokeLinecap="round"><path d="M50 50 L50 30" stroke="#F472B6" /><path d="M50 50 L70 50" stroke="#60A5FA" /><path d="M50 50 L30 50" stroke="#34D399" /><path d="M50 50 L50 70" stroke="#FBBF24" /></g></svg>);
const StarlightPreview: React.FC = () => (<svg viewBox="0 0 100 100" className="text-yellow-300"><path d="M50 10 L55 45 L90 50 L55 55 L50 90 L45 55 L10 50 L45 45 Z" fill="none" stroke="currentColor" strokeWidth="4" /><text x="25" y="30" fontSize="30">✨</text><text x="75" y="75" fontSize="30">✨</text></svg>);
const AscensionPreview: React.FC = () => (<svg viewBox="0 0 100 100" className="text-yellow-300"><g stroke="currentColor" strokeWidth="6" strokeLinecap="round"><path d="M30 70 L30 30 M20 40 L30 30 L40 40" /><path d="M70 70 L70 30 M60 40 L70 30 L80 40" /></g></svg>);
const AuraRisePreview: React.FC = () => (<svg viewBox="0 0 100 100" className="text-yellow-300"><path d="M20 80 Q 50 20, 80 80" stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round"/><path d="M30 80 Q 50 40, 70 80" stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.6"/></svg>);

// Boom Previews
const HeartBoomPreview: React.FC = () => (<svg viewBox="0 0 100 100" className="text-pink-500"><path d="M10 50 L 90 50 M80 40 L90 50 L80 60" stroke="currentColor" strokeWidth="6" strokeLinecap="round" /><text x="50" y="55" textAnchor="middle" fontSize="30">❤️</text></svg>);
const RocketBoomPreview: React.FC = () => (<svg viewBox="0 0 100 100" className="text-orange-500"><path d="M10 50 L 90 50 M80 40 L90 50 L80 60" stroke="currentColor" strokeWidth="6" strokeLinecap="round" /><text x="50" y="55" textAnchor="middle" fontSize="30">🚀</text></svg>);
const MagicMissilePreview: React.FC = () => (<svg viewBox="0 0 100 100" className="text-purple-500"><path d="M20 50 C 40 30, 60 70, 80 50" stroke="currentColor" strokeWidth="6" fill="none" /><circle cx="15" cy="50" r="8" fill="currentColor" /></svg>);
const GhostBoomPreview: React.FC = () => (<svg viewBox="0 0 100 100" className="text-slate-300"><path d="M10 50 L 90 50 M80 40 L90 50 L80 60" stroke="currentColor" strokeWidth="6" strokeLinecap="round" /><text x="50" y="55" textAnchor="middle" fontSize="30">👻</text></svg>);
const VoidCollapsePreview: React.FC = () => (<svg viewBox="0 0 100 100" className="text-purple-400"><circle cx="50" cy="50" r="25" fill="black" /><path d="M 50,50 m -15,0 a 15,15 0 1,0 30,0 a 15,15 0 1,0 -30,0" stroke="currentColor" strokeWidth="4" fill="none" transform="rotate(45 50 50)" strokeDasharray="10 10" /></svg>);
const ThunderclapBoomPreview: React.FC = () => (<svg viewBox="0 0 100 100" className="text-yellow-400"><path d="M10 50 L 30 50 L 25 30 L 45 70 L 40 50 L 60 50" stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M60 50 L 90 50 M80 40 L90 50 L80 60" stroke="currentColor" strokeWidth="6" strokeLinecap="round" /></svg>);


// Victory Components
const DefaultVictoryEffect: React.FC = () => (<div className="absolute inset-0 pointer-events-none z-10">{Array(30).fill(0).map((_, i) => (<div key={i} className="absolute w-2 h-2 bg-yellow-300 rounded-full animate-particle" style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 2}s` }} />))}</div>);
const ConfettiEffect: React.FC = () => (<div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">{[...Array(50)].map((_, i) => (<div key={i} className="absolute h-4 animate-confetti" style={{ width: '8px', left: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 0.2}s`, animationDuration: `${2 + Math.random() * 2}s`, backgroundColor: ['#34D399', '#F472B6', '#60A5FA', '#FBBF24'][i % 4]}}></div>))}</div>);
const FireworksEffect: React.FC = () => {
    const colors = ['#F472B6', '#60A5FA', '#34D399', '#FBBF24', '#A78BFA', '#FDE047'];
    // 5 distinct waves of fireworks, more centrally located
    const bursts = [
        { delay: 0.2, scale: 1.0, left: '45%', top: '40%' },
        { delay: 0.7, scale: 0.8, left: '65%', top: '50%' },
        { delay: 1.2, scale: 1.2, left: '35%', top: '30%' },
        { delay: 1.6, scale: 0.9, left: '55%', top: '60%' },
        { delay: 2.0, scale: 1.1, left: '40%', top: '55%' },
    ];
    return (
        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
            {bursts.map((burst, i) => (
                <div key={i} className="absolute animate-firework-container" style={{
                    left: burst.left,
                    top: burst.top,
                    transform: `scale(${burst.scale})`,
                    animationDelay: `${burst.delay}s`,
                }}>
                    {[...Array(35)].map((_, p_i) => {
                        const angle = Math.random() * 360;
                        const distance = 60 + Math.random() * 70;
                        return (
                            <div key={p_i} className="absolute w-2 h-2 rounded-full animate-firework-particle" style={{
                                backgroundColor: colors[p_i % colors.length],
                                // @ts-ignore
                                '--angle': `${angle}deg`,
                                '--distance': `${distance}px`,
                                '--duration': `${0.9 + Math.random() * 0.5}s`,
                            }} />
                        )
                    })}
                </div>
            ))}
        </div>
    );
};
const StarlightEffect: React.FC = () => (<div className="absolute inset-0 pointer-events-none z-10">{Array(25).fill(0).map((_, i) => (<div key={i} className="animate-starlight" style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 2}s`, transform: `scale(${0.5 + Math.random() * 0.5})` }}>✨</div>))}</div>);
const AscensionEffect: React.FC = () => (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
        {[...Array(15)].map((_, i) => (
            <div key={i} className="absolute bottom-0 w-2 animate-ascension-beam" style={{
                left: `${5 + Math.random() * 90}%`,
                animationDelay: `${Math.random() * 2.5}s`,
                animationDuration: `${2.5 + Math.random() * 2}s`,
            }} />
        ))}
    </div>
);
const AuraRiseEffect: React.FC = () => (
    <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
        <div className="relative w-[40vmin] h-[40vmin]">
            <div className="absolute inset-0 rounded-full animate-aura-rise-1"></div>
            <div className="absolute inset-0 rounded-full animate-aura-rise-2"></div>
            <div className="absolute inset-0 rounded-full animate-aura-rise-3"></div>
        </div>
    </div>
);

// Boom Components
const getCoords = (rect?: DOMRect) => rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: 0, y: 0 };
const HeartBoomEffect: React.FC<{ winnerCoords?: DOMRect, loserCoords?: DOMRect }> = ({ winnerCoords, loserCoords }) => {
  const start = getCoords(winnerCoords);
  const end = getCoords(loserCoords);
  if (!winnerCoords || !loserCoords) return null;
  return <div className="fixed inset-0 pointer-events-none z-50"><div className="absolute text-5xl animate-boom-travel-vanish" style={{'--start-x': `${start.x}px`, '--start-y': `${start.y}px`, '--end-x': `${end.x}px`, '--end-y': `${end.y}px`} as React.CSSProperties}>❤️</div><div className="animate-boom-impact" style={{'--end-x': `${end.x}px`, '--end-y': `${end.y}px`} as React.CSSProperties}></div></div>;
}
const RocketBoomEffect: React.FC<{ winnerCoords?: DOMRect, loserCoords?: DOMRect }> = ({ winnerCoords, loserCoords }) => {
  const start = getCoords(winnerCoords);
  const end = getCoords(loserCoords);
  if (!winnerCoords || !loserCoords) return null;
  return <div className="fixed inset-0 pointer-events-none z-50"><div className="absolute text-5xl animate-boom-travel-vanish" style={{'--start-x': `${start.x}px`, '--start-y': `${start.y}px`, '--end-x': `${end.x}px`, '--end-y': `${end.y}px`} as React.CSSProperties}>🚀</div><div className="animate-boom-impact" style={{'--end-x': `${end.x}px`, '--end-y': `${end.y}px`} as React.CSSProperties}></div></div>;
}
const MagicMissileEffect: React.FC<{ winnerCoords?: DOMRect, loserCoords?: DOMRect }> = ({ winnerCoords, loserCoords }) => {
  const start = getCoords(winnerCoords);
  const end = getCoords(loserCoords);
  if (!winnerCoords || !loserCoords) return null;
  return <div className="fixed inset-0 pointer-events-none z-50"><div className="absolute w-8 h-8 rounded-full bg-purple-500 animate-boom-travel-vanish" style={{'--start-x': `${start.x}px`, '--start-y': `${start.y}px`, '--end-x': `${end.x}px`, '--end-y': `${end.y}px`} as React.CSSProperties}></div><div className="animate-boom-impact" style={{'--end-x': `${end.x}px`, '--end-y': `${end.y}px`} as React.CSSProperties}></div></div>
}
const GhostBoomEffect: React.FC<{ winnerCoords?: DOMRect, loserCoords?: DOMRect }> = ({ winnerCoords, loserCoords }) => {
  const start = getCoords(winnerCoords);
  const end = getCoords(loserCoords);
  if (!winnerCoords || !loserCoords) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      <div className="absolute text-5xl animate-boom-travel-vanish" style={{'--start-x': `${start.x}px`, '--start-y': `${start.y}px`, '--end-x': `${end.x}px`, '--end-y': `${end.y}px`} as React.CSSProperties}>👻</div>
      <div className="animate-boom-ghost-wail" style={{'--end-x': `${end.x}px`, '--end-y': `${end.y}px`} as React.CSSProperties}>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="absolute text-2xl top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ transform: `rotate(${i * 45}deg) translateY(-50px)`}}>👻</div>
        ))}
      </div>
    </div>
  );
}
const VoidCollapseBoomEffect: React.FC<{ winnerCoords?: DOMRect, loserCoords?: DOMRect }> = ({ winnerCoords, loserCoords }) => {
  const start = getCoords(winnerCoords);
  const end = getCoords(loserCoords);
  if (!winnerCoords || !loserCoords) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      <div
        className="absolute w-8 h-8 rounded-full bg-black border-2 border-purple-500 animate-boom-void-travel"
        style={{
          '--start-x': `${start.x}px`,
          '--start-y': `${start.y}px`,
          '--end-x': `${end.x}px`,
          '--end-y': `${end.y}px`,
        } as React.CSSProperties}
      />
      <div
        className="w-48 h-48 animate-boom-void-impact-container"
        style={{
          '--end-x': `${end.x}px`,
          '--end-y': `${end.y}px`,
        } as React.CSSProperties}
      >
        <div className="absolute inset-0 animate-boom-void-black-hole"></div>
        <div className="absolute inset-0 animate-boom-void-particles">
          {[...Array(12)].map((_, i) => (
              <div key={i} className="absolute w-1 h-8 bg-purple-400 animate-boom-void-particle" style={{ '--i': i } as React.CSSProperties}/>
          ))}
        </div>
      </div>
    </div>
  );
};
const ThunderclapBoomEffect: React.FC<{ winnerCoords?: DOMRect, loserCoords?: DOMRect }> = ({ winnerCoords, loserCoords }) => {
    const start = getCoords(winnerCoords);
    const end = getCoords(loserCoords);
    if (!winnerCoords || !loserCoords) return null;
    
    const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
    const distance = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));

    // Generate a jagged path for the lightning bolt
    const lightningPath = useMemo(() => {
        let path = 'M0 0';
        const segments = Math.max(8, Math.floor(distance / 40)); // More segments for longer distances
        const deviation = 20;
        const segmentLength = distance / segments;

        for (let i = 1; i <= segments; i++) {
            const x = segmentLength * i;
            // Add random vertical deviation, but ensure the last point is at y=0
            const y = (i === segments) ? 0 : (Math.random() - 0.5) * deviation;
            path += ` L${x.toFixed(2)} ${y.toFixed(2)}`;
        }
        return path;
    }, [distance]);

    return (
        <div className="fixed inset-0 pointer-events-none z-50">
            <svg className="absolute w-full h-full overflow-visible">
                <defs>
                    <filter id="thunder-glow">
                        <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
                        <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                </defs>
                <path
                    d={lightningPath}
                    stroke="white"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    className="animate-boom-thunderclap-bolt"
                    style={{'--distance': distance, filter: 'url(#thunder-glow)'} as React.CSSProperties}
                    transform={`translate(${start.x}, ${start.y}) rotate(${angle})`}
                />
            </svg>
            <div className="animate-boom-impact" style={{'--end-x': `${end.x}px`, '--end-y': `${end.y}px`} as React.CSSProperties}></div>
        </div>
    );
}


// Styles for Victory and Boom effects
const getVictoryAndBoomStyles = () => `
  /* Victory: Default Particle Burst */
  @keyframes particle { 0% { transform: scale(1) translateY(0); opacity: 1; } 100% { transform: scale(0) translateY(-100px); opacity: 0; } }
  .animate-particle { animation: particle 2s ease-out forwards; }
  /* Victory: Confetti */
  @keyframes confetti-fall { from { transform: translateY(-20vh) rotate(0deg); } to { transform: translateY(100vh) rotate(1080deg); } }
  .animate-confetti { animation: confetti-fall linear infinite; }
  /* Victory: Starlight */
  @keyframes starlight-twinkle { 0%, 100% { transform: scale(0.5); opacity: 0.5; } 50% { transform: scale(1.2); opacity: 1; filter: drop-shadow(0 0 5px currentColor); } }
  .animate-starlight { position: absolute; color: #fef08a; font-size: 1.5rem; animation: starlight-twinkle 2s ease-in-out infinite; }
  
  /* Victory: Fireworks */
  @keyframes firework-burst {
    0% { transform: rotate(var(--angle)) translateY(0) scale(1.5); opacity: 1; }
    100% { transform: rotate(var(--angle)) translateY(var(--distance)) scale(0); opacity: 0; }
  }
  .animate-firework-particle {
    animation: firework-burst var(--duration) cubic-bezier(0.2, 0.8, 0.7, 1) forwards;
    filter: drop-shadow(0 0 4px currentColor);
  }
  .animate-firework-container { opacity: 0; animation: firework-fade-in 0.1s linear forwards; animation-delay: inherit; }
  @keyframes firework-fade-in { to { opacity: 1; } }

  /* Victory: Ascension */
  @keyframes light-beam-rise {
    from { transform: translateY(0) scaleY(1); opacity: 0; }
    20% { opacity: 0.7; }
    80% { opacity: 0.7; }
    to { transform: translateY(-100vh) scaleY(3); opacity: 0; }
  }
  .animate-ascension-beam {
    height: 30vh;
    background: linear-gradient(to top, rgba(253, 224, 71, 0), rgba(253, 224, 71, 0.6), rgba(253, 224, 71, 0));
    filter: drop-shadow(0 0 6px #fde047);
    animation: light-beam-rise ease-in forwards;
  }
  
  /* Victory: Aura Rise */
      @keyframes aura-rise-anim {
          from {
              transform: scale(0.2);
              opacity: 1;
          }
          to {
              transform: scale(2);
              opacity: 0;
          }
      }
      .animate-aura-rise-1, .animate-aura-rise-2, .animate-aura-rise-3 {
          border: 3px solid;
          animation: aura-rise-anim 2s cubic-bezier(0.25, 1, 0.5, 1) forwards;
      }
      .animate-aura-rise-1 {
          border-color: #fef08a; /* yellow-200 */
          filter: drop-shadow(0 0 10px #fef08a);
      }
      .animate-aura-rise-2 {
          border-color: #fde047; /* yellow-300 */
          filter: drop-shadow(0 0 15px #fde047);
          animation-delay: 0.15s;
      }
      .animate-aura-rise-3 {
          border-color: #facc15; /* yellow-400 */
          filter: drop-shadow(0 0 20px #facc15);
          animation-delay: 0.3s;
      }

  /* Boom: Projectile Travel & Vanish (FIXED: Centered and vanishes on impact) */
  @keyframes boom-travel-vanish {
    0% { transform: translate(var(--start-x), var(--start-y)) translate(-50%, -50%) scale(0.5); opacity: 0; }
    10% { transform: translate(var(--start-x), var(--start-y)) translate(-50%, -50%) scale(1); opacity: 1; }
    89% { transform: translate(var(--end-x), var(--end-y)) translate(-50%, -50%) scale(1); opacity: 1; }
    100% { transform: translate(var(--end-x), var(--end-y)) translate(-50%, -50%) scale(1.5); opacity: 0; }
  }
  .animate-boom-travel-vanish {
    position: fixed; top: 0; left: 0;
    animation: boom-travel-vanish 1s ease-in-out forwards;
  }
  
  /* Boom: Impact flash at destination */
  @keyframes boom-impact-flash { 
      0% { transform: translate(-50%,-50%) scale(0); opacity: 1; filter: brightness(1.5); } 
      50% { filter: brightness(2.5); }
      100% { transform: translate(-50%,-50%) scale(3); opacity: 0; filter: brightness(1); } 
  }
  .animate-boom-impact {
    position: fixed;
    left: var(--end-x); top: var(--end-y);
    width: 100px; height: 100px; border-radius: 99px;
    background: radial-gradient(circle, white 0%, #FFD700 40%, #FF8C00 70%, transparent 85%);
    transform: translate(-50%, -50%);
    opacity: 0;
    animation: boom-impact-flash 0.4s ease-out forwards;
    animation-delay: 0.85s; /* Delay until travel is almost complete */
  }

  /* Boom: Ghostly Wail Impact */
  @keyframes boom-ghost-wail-anim {
      from { transform: translate(-50%, -50%) scale(0) rotate(0deg); opacity: 1; }
      to { transform: translate(-50%, -50%) scale(1) rotate(360deg); opacity: 0; }
  }
  .animate-boom-ghost-wail {
      position: fixed;
      left: var(--end-x); top: var(--end-y);
      width: 150px; height: 150px;
      transform: translate(-50%, -50%) scale(0);
      opacity: 0;
      animation: boom-ghost-wail-anim 0.8s ease-out forwards;
      animation-delay: 0.85s;
  }

  /* Boom: Void Collapse */
  @keyframes boom-void-travel-anim {
      0% { transform: translate(var(--start-x), var(--start-y)) translate(-50%, -50%) scale(0.5); opacity: 0; }
      10% { transform: translate(var(--start-x), var(--start-y)) translate(-50%, -50%) scale(1); opacity: 1; }
      89% { transform: translate(var(--end-x), var(--end-y)) translate(-50%, -50%) scale(1); opacity: 1; }
      100% { transform: translate(var(--end-x), var(--end-y)) translate(-50%, -50%) scale(0.5); opacity: 0; }
  }
  .animate-boom-void-travel {
      position: fixed; top: 0; left: 0;
      filter: drop-shadow(0 0 8px #a855f7);
      animation: boom-void-travel-anim 1s ease-in-out forwards;
  }
  .animate-boom-void-impact-container {
      position: fixed;
      top: var(--end-y);
      left: var(--end-x);
      transform: translate(-50%, -50%);
      opacity: 0;
      animation: firework-fade-in 0.1s linear forwards;
      animation-delay: 0.85s;
  }
  @keyframes boom-void-black-hole-anim {
    0% { transform: translate(-50%, -50%) scale(0); opacity: 0.5; }
    30% { transform: translate(-50%, -50%) scale(0.6); opacity: 1; }
    100% { transform: translate(-50%, -50%) scale(0.5) rotate(90deg); opacity: 1; }
  }
  .animate-boom-void-black-hole {
    position: absolute; top: 50%; left: 50%;
    width: 100%; height: 100%;
    transform-origin: center;
    transform: translate(-50%, -50%) scale(0);
    background: radial-gradient(circle, #2d0b45 10%, black 60%);
    border-radius: 50%;
    filter: blur(8px);
    animation: boom-void-black-hole-anim 0.8s ease-out forwards;
  }
  @keyframes boom-void-particles-rotate {
      from { transform: scale(1.5) rotate(0deg); }
      to { transform: scale(1.5) rotate(-360deg); }
  }
  .animate-boom-void-particles {
      transform-origin: center;
      animation: boom-void-particles-rotate 0.8s ease-in forwards;
  }
  @keyframes boom-void-particle-suck {
      from { transform: rotate(calc(var(--i) * 30deg)) translateY(0) scaleY(1); opacity: 1; }
      to { transform: rotate(calc(var(--i) * 30deg)) translateY(-70px) scaleY(0.2); opacity: 0; }
  }
  .animate-boom-void-particle {
      top: 50%; left: 50%;
      transform-origin: center bottom;
      animation: boom-void-particle-suck 0.5s ease-in forwards;
  }

  /* Boom: Thunderclap */
  @keyframes boom-thunderclap-bolt-anim {
      0% { stroke-dasharray: 0, var(--distance); }
      30% { stroke-dasharray: var(--distance), var(--distance); }
      100% { stroke-dasharray: var(--distance), var(--distance); opacity: 0; }
  }
  .animate-boom-thunderclap-bolt {
      animation: boom-thunderclap-bolt-anim 1s ease-out forwards;
  }
`;
export const VictoryAndBoomStyles: React.FC = () => (<style>{getVictoryAndBoomStyles()}</style>);


// Define and export Victory/Boom effects
export const DEFAULT_VICTORY_EFFECT: VictoryEffect = { id: 'victory_default', name: 'Glimmer', component: DefaultVictoryEffect, previewComponent: DefaultVictoryPreview };
export const VICTORY_EFFECTS: VictoryEffect[] = [
    { id: 'victory_confetti', name: 'Confetti', component: ConfettiEffect, previewComponent: ConfettiPreview },
    { id: 'victory_fireworks', name: 'Fireworks', component: FireworksEffect, previewComponent: FireworksPreview },
    { id: 'victory_starlight', name: 'Starlight', component: StarlightEffect, previewComponent: StarlightPreview },
    { id: 'victory_ascension', name: 'Ascension', component: AscensionEffect, previewComponent: AscensionPreview },
    { id: 'victory_aurarise', name: 'Aura Rise', component: AuraRiseEffect, previewComponent: AuraRisePreview },
];

export const DEFAULT_BOOM_EFFECT: BoomEffect = { id: 'boom_heart', name: 'Heart', component: HeartBoomEffect, previewComponent: HeartBoomPreview };
export const BOOM_EFFECTS: BoomEffect[] = [
    { id: 'boom_rocket', name: 'Rocket Barrage', component: RocketBoomEffect, previewComponent: RocketBoomPreview },
    { id: 'boom_missile', name: 'Magic Missile', component: MagicMissileEffect, previewComponent: MagicMissilePreview },
    { id: 'boom_ghost', name: 'Ghostly Wail', component: GhostBoomEffect, previewComponent: GhostBoomPreview },
    { id: 'boom_void_collapse', name: 'Void Collapse', component: VoidCollapseBoomEffect, previewComponent: VoidCollapsePreview },
    { id: 'boom_thunderclap', name: 'Thunderclap', component: ThunderclapBoomEffect, previewComponent: ThunderclapBoomPreview },
];

// --- AI Bot Profiles ---
export const BOTS: BotProfile[] = [
    { id: 'bot_easy', name: 'Meow', avatar: 'assets/avatars/bot_1.png', level: 2, skillLevel: 'easy', description: 'Một chú mèo nhỏ mới tập chơi! Tuyệt vời cho những màn đấu không căng não.', cp: 550 },
    { id: 'bot_medium', name: 'Nova', avatar: 'assets/avatars/bot_2.png', level: 10, skillLevel: 'medium', description: 'Một cô gái xinh đẹp đã thành thạo chiến lược. Hứa hẹn một ván đấu mãn nhãn.', cp: 1150 },
    { id: 'bot_hard', name: 'Kael', avatar: 'assets/avatars/bot_3.png', level: 15, skillLevel: 'hard', description: 'Một hacker trẻ, suy nghĩ rất kỹ trước khi hành động, thất bại là điều hiển nhiên.', cp: 1750 },
];

// --- Music Tracks ---
export const MUSIC_TRACKS: MusicTrack[] = [
    { id: 'music_default', name: 'Celestial', url: 'assets/sounds/music.mp3' },
    { id: 'music_chill', name: 'Chillhop', url: 'assets/sounds/music_1.mp3' },
    { id: 'music_action', name: 'Action', url: 'assets/sounds/music_2.mp3' },
    { id: 'music_synth', name: 'Synthwave', url: 'assets/sounds/music_3.mp3' },
];

// --- All Cosmetics for the Shop ---
export const ALL_COSMETICS: Cosmetic[] = [
  // Themes
  { id: DEFAULT_THEME.id, name: DEFAULT_THEME.name, type: 'theme', price: 0, item: DEFAULT_THEME },
  ...THEMES.map(item => ({ id: item.id, name: item.name, type: 'theme' as const, price: 500, item })),
  // Boards
  { id: DEFAULT_BOARD_STYLE.id, name: DEFAULT_BOARD_STYLE.name, type: 'board', price: 0, item: DEFAULT_BOARD_STYLE },
  ...BOARD_STYLES.map(item => ({ id: item.id, name: item.name, type: 'board' as const, price: item.id === 'board_celestial' ? 900 : 800, item })),
  // Avatars
  { id: DEFAULT_AVATAR.id, name: DEFAULT_AVATAR.name, type: 'avatar', price: 0, item: DEFAULT_AVATAR },
  ...AVATARS.filter(a => a.id !== 'avatar_6').map(item => ({ id: item.id, name: item.name, type: 'avatar' as const, price: 300, item })),
  { id: 'avatar_6', name: 'Shadow', type: 'avatar', price: 500, item: AVATARS.find(a => a.id === 'avatar_6')! },
  // Pieces (Skins)
  { id: DEFAULT_PIECES_X.id, name: DEFAULT_PIECES_X.name, type: 'piece', price: 0, item: DEFAULT_PIECES_X },
  { id: DEFAULT_PIECES_O.id, name: DEFAULT_PIECES_O.name, type: 'piece', price: 0, item: DEFAULT_PIECES_O },
  ...PIECE_STYLES.filter(p => !['piece_dragon', 'piece_yin_yang', 'piece_atom', 'piece_biohazard', 'piece_leaf', 'piece_flower'].includes(p.id)).map(item => ({ id: item.id, name: item.name, type: 'piece' as const, price: 250, item })),
  { id: 'piece_dragon', name: 'Dragon', type: 'piece', price: 750, item: PIECE_STYLES.find(p => p.id === 'piece_dragon')! },
  { id: 'piece_yin_yang', name: 'Yin Yang', type: 'piece', price: 600, item: PIECE_STYLES.find(p => p.id === 'piece_yin_yang')! },
  { id: 'piece_atom', name: 'Atom', type: 'piece', price: 600, item: PIECE_STYLES.find(p => p.id === 'piece_atom')! },
  { id: 'piece_biohazard', name: 'Biohazard', type: 'piece', price: 600, item: PIECE_STYLES.find(p => p.id === 'piece_biohazard')! },
  { id: 'piece_leaf', name: 'Leaf', type: 'piece', price: 650, item: PIECE_STYLES.find(p => p.id === 'piece_leaf')! },
  { id: 'piece_flower', name: 'Flower', type: 'piece', price: 650, item: PIECE_STYLES.find(p => p.id === 'piece_flower')! },
  // Effects
  { id: DEFAULT_EFFECT.id, name: DEFAULT_EFFECT.name, type: 'effect', price: 0, item: DEFAULT_EFFECT },
  ...PIECE_EFFECTS.map(item => ({ id: item.id, name: item.name, type: 'effect' as const, price: 400, item })),
  // Victory Effects
  { id: DEFAULT_VICTORY_EFFECT.id, name: DEFAULT_VICTORY_EFFECT.name, type: 'victory', price: 0, item: DEFAULT_VICTORY_EFFECT },
  ...VICTORY_EFFECTS.filter(v => !['victory_ascension', 'victory_aurarise'].includes(v.id)).map(item => ({ id: item.id, name: item.name, type: 'victory' as const, price: 750, item })),
  { id: 'victory_ascension', name: 'Ascension', type: 'victory', price: 900, item: VICTORY_EFFECTS.find(v => v.id === 'victory_ascension')! },
  { id: 'victory_aurarise', name: 'Aura Rise', type: 'victory', price: 950, item: VICTORY_EFFECTS.find(v => v.id === 'victory_aurarise')! },
  // Boom Effects
  { id: DEFAULT_BOOM_EFFECT.id, name: DEFAULT_BOOM_EFFECT.name, type: 'boom', price: 0, item: DEFAULT_BOOM_EFFECT },
  ...BOOM_EFFECTS.filter(b => !['boom_void_collapse', 'boom_thunderclap'].includes(b.id)).map(item => ({ id: item.id, name: item.name, type: 'boom' as const, price: 1000, item })),
  { id: 'boom_void_collapse', name: 'Void Collapse', type: 'boom', price: 1200, item: BOOM_EFFECTS.find(b => b.id === 'boom_void_collapse')! },
  { id: 'boom_thunderclap', name: 'Thunderclap', type: 'boom', price: 1100, item: BOOM_EFFECTS.find(b => b.id === 'boom_thunderclap')! },
  // Emojis
  ...EMOJIS.map((item) => ({ id: item.id, name: item.name, type: 'emoji' as const, price: 10, item })),
  // Animated Emojis
  ...ANIMATED_EMOJIS.map((item) => ({ id: item.id, name: item.name, type: 'animated_emoji' as const, price: 20, item })),
];