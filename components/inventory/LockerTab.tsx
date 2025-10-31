import React from 'react';
import type { LockerItem, Cosmetic, Avatar, PieceStyle, GameTheme, PieceEffect, VictoryEffect, BoomEffect, Emoji, AnimatedEmoji, BoardStyle } from '../../types';
import { ALL_COSMETICS } from '../../constants';
import { useSound } from '../../hooks/useSound';

interface LockerTabProps {
    gifts: LockerItem[];
    onClaim: (gift: LockerItem) => Promise<{success: boolean, message: string}>;
}

const allCosmeticsMap = new Map<string, Cosmetic>(ALL_COSMETICS.map(c => [c.id, c]));

const ItemPreview: React.FC<{cosmetic: Cosmetic}> = React.memo(({ cosmetic }) => {
    switch(cosmetic.type) {
        case 'piece': {
            const PieceComp = (cosmetic.item as PieceStyle).component;
            return <PieceComp className="w-full h-full text-cyan-300" />;
        }
        case 'avatar': {
            return <img src={(cosmetic.item as Avatar).url} alt={cosmetic.name} className="w-full h-full rounded-md object-cover bg-slate-700" />;
        }
        case 'emoji':
            return <span className="text-3xl">{(cosmetic.item as Emoji).emoji}</span>
        case 'animated_emoji':
            return <img src={(cosmetic.item as AnimatedEmoji).url} alt={cosmetic.name} className="w-full h-full" />;
        case 'theme': {
            const theme = cosmetic.item as GameTheme;
            return (
              <div 
                  className={`w-full h-full rounded-md flex items-center justify-center p-1 bg-cover bg-center ${theme.boardBg}`}
                  style={theme.boardBgImage ? { backgroundImage: `url(${theme.boardBgImage})` } : {}}
              >
                  <div className={`w-8 h-8 rounded-sm ${theme.cellBg} border ${theme.gridColor}`} />
              </div>);
        }
         case 'board': {
            const boardStyle = cosmetic.item as BoardStyle;
            return <div className="w-full h-full rounded-sm border-2" style={{ backgroundColor: boardStyle.style.backgroundColor, borderColor: boardStyle.style.borderColor }}/>;
        }
        case 'effect': {
            const PreviewComp = (cosmetic.item as PieceEffect).previewComponent;
            return <div className="w-full h-full flex items-center justify-center text-cyan-300"><PreviewComp /></div>;
        }
        case 'victory': {
            const PreviewComp = (cosmetic.item as VictoryEffect).previewComponent;
            return <div className="w-full h-full flex items-center justify-center text-cyan-300"><PreviewComp /></div>;
        }
        case 'boom': {
            const PreviewComp = (cosmetic.item as BoomEffect).previewComponent;
            return <div className="w-full h-full flex items-center justify-center text-cyan-300"><PreviewComp /></div>;
        }
        default:
            return <span className="text-3xl">🎁</span>;
    }
});

const LockerTab: React.FC<LockerTabProps> = ({ gifts, onClaim }) => {
    const unclaimedGifts = gifts.filter(g => !g.isClaimed);
    const { playSound } = useSound();

    if (unclaimedGifts.length === 0) {
        return (
            <div className="text-center py-16">
                <p className="text-slate-400 text-lg">Your locker is empty.</p>
                <p className="text-slate-500">Gifts you receive from friends will appear here.</p>
            </div>
        );
    }

    const handleClaimClick = (gift: LockerItem) => {
        playSound('confirm');
        onClaim(gift);
    }

    return (
        <div className="space-y-4">
            {unclaimedGifts.map(gift => {
                const cosmetic = allCosmeticsMap.get(gift.cosmeticId);
                if (!cosmetic) return null;
                return (
                    <div key={gift.id} className="bg-slate-800/50 p-3 rounded-lg flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-slate-700 rounded-md">
                               <ItemPreview cosmetic={cosmetic} />
                            </div>
                            <div>
                                <p className="font-semibold text-white">{cosmetic.name}</p>
                                <p className="text-xs text-slate-400">From: <span className="font-medium text-slate-300">{gift.fromName}</span></p>
                            </div>
                        </div>
                        <button 
                            onClick={() => handleClaimClick(gift)}
                            className="bg-green-500 text-black font-bold py-2 px-4 rounded-lg hover:bg-green-400 transition-colors"
                        >
                            Claim
                        </button>
                    </div>
                )
            })}
        </div>
    );
};

export default LockerTab;