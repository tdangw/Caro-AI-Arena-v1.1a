import React from 'react';
import type { Player, PieceStyle } from '../../types';
import { getRankFromCp } from '../../constants';

interface PlayerInfoProps {
  name: string;
  avatar: string;
  level: number;
  player: Player;
  align: 'left' | 'right';
  isCurrent: boolean;
  piece: PieceStyle;
  cp?: number;
  moveCount: number;
}

const PlayerInfo = React.forwardRef<HTMLDivElement, PlayerInfoProps>(({ name, avatar, level, player, align, isCurrent, piece, cp, moveCount }, ref) => {
  const PieceComponent = piece.component;
  const glowClass = isCurrent ? 'shadow-lg shadow-yellow-500/50' : '';
  const colorClass = player === 'X' ? 'text-cyan-400' : 'text-pink-500';

  const rank = getRankFromCp(cp);

  return (
    <div ref={ref} className={`flex items-center gap-3 relative ${align === 'right' ? 'flex-row-reverse' : ''}`}>
      <img src={avatar} alt={`${name}'s avatar`} className={`w-14 h-14 rounded-full transition-all duration-300 ${glowClass} bg-slate-700 object-cover border-2 border-slate-600`} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }} />
      <div className={`${align === 'right' ? 'text-right' : ''} text-shadow`}>
        <div className={`flex items-baseline gap-2 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
            <h3 className="font-bold text-white text-lg truncate">{name}</h3>
            <p className="text-cyan-400 font-semibold text-sm">Lv. {level}</p>
        </div>
        <div className={`flex items-center gap-2 text-sm mt-1 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
            {align === 'left' ? (
                <>
                    <p className="text-sm text-slate-300 font-semibold">{rank.icon} {rank.name}</p>
                    <div className={`w-4 h-4 ${colorClass}`}><PieceComponent /></div>
                    {moveCount > 0 && (
                        <span className="text-slate-400 text-xs font-bold">
                            {moveCount}
                        </span>
                    )}
                </>
            ) : (
                <>
                    {moveCount > 0 && (
                        <span className="text-slate-400 text-xs font-bold">
                            {moveCount}
                        </span>
                    )}
                    <div className={`w-4 h-4 ${colorClass}`}><PieceComponent /></div>
                    <p className="text-sm text-slate-300 font-semibold">{rank.icon} {rank.name}</p>
                </>
            )}
        </div>
      </div>
    </div>
  );
});

export default PlayerInfo;
