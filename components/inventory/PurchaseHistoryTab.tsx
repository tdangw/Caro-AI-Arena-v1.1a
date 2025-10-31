import React, { useState, useEffect } from 'react';
import type { PurchaseHistoryEntry, Cosmetic, Avatar, PieceStyle, GameTheme, PieceEffect, VictoryEffect, BoomEffect, Emoji, BoardStyle, AnimatedEmoji } from '../../types';
import { useAuth } from '../../context/AuthContext';
import * as onlineService from '../../services/onlineService';
import { ALL_COSMETICS } from '../../constants';
import { useGameState } from '../../context/GameStateContext';

const allCosmeticsMap = new Map<string, Cosmetic>(ALL_COSMETICS.map(c => [c.id, c]));

const ItemPreview: React.FC<{cosmetic: Cosmetic}> = React.memo(({ cosmetic }) => {
    // This is a simplified preview component for history
    switch(cosmetic.type) {
        case 'piece': {
            const PieceComp = (cosmetic.item as PieceStyle).component;
            return <PieceComp className="w-full h-full text-cyan-300" />;
        }
        case 'avatar': {
            return <img src={(cosmetic.item as Avatar).url} alt={cosmetic.name} className="w-full h-full rounded-md object-cover bg-slate-700" />;
        }
        case 'emoji':
            return <span className="text-xl">{(cosmetic.item as Emoji).emoji}</span>
        case 'animated_emoji':
            return <img src={(cosmetic.item as AnimatedEmoji).url} alt={cosmetic.name} className="w-full h-full" />;
        case 'theme': {
            const theme = cosmetic.item as GameTheme;
            return <div className={`w-full h-full rounded-sm ${theme.boardBg}`} />;
        }
         case 'board': {
            const boardStyle = cosmetic.item as BoardStyle;
            return <div className="w-full h-full rounded-sm border-2" style={{ backgroundColor: boardStyle.style.backgroundColor, borderColor: boardStyle.style.borderColor }}/>;
        }
        case 'effect': {
            const PreviewComp = (cosmetic.item as PieceEffect).previewComponent;
            return <div className="w-full h-full flex items-center justify-center text-cyan-300 scale-50"><PreviewComp /></div>;
        }
        case 'victory': {
            const PreviewComp = (cosmetic.item as VictoryEffect).previewComponent;
            return <div className="w-full h-full flex items-center justify-center text-cyan-300 scale-50"><PreviewComp /></div>;
        }
        case 'boom': {
            const PreviewComp = (cosmetic.item as BoomEffect).previewComponent;
            return <div className="w-full h-full flex items-center justify-center text-cyan-300 scale-50"><PreviewComp /></div>;
        }
        default:
            return <span className="text-xl">🎁</span>;
    }
});


const PurchaseHistoryTab: React.FC = () => {
    const { user } = useAuth();
    const { gameState } = useGameState();
    const [history, setHistory] = useState<PurchaseHistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [displayedCount, setDisplayedCount] = useState(10);

    useEffect(() => {
        setLoading(true);
        if (user && !user.isAnonymous) {
            onlineService.getPurchaseHistory(user.uid).then(data => {
                setHistory(data);
                setLoading(false);
            });
        } else {
            // Guest user
            setHistory(gameState.purchaseHistory);
            setLoading(false);
        }
    }, [user, gameState.purchaseHistory]);

    if (loading) {
        return <div className="text-center text-slate-400 py-8">Loading history...</div>;
    }

    if (history.length === 0) {
        return (
            <div className="text-center py-16">
                <p className="text-slate-400 text-lg">No purchases made yet.</p>
                <p className="text-slate-500">Items you buy from the shop will appear here.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {history.slice(0, displayedCount).map(entry => {
                const cosmetic = allCosmeticsMap.get(entry.cosmeticId);
                return (
                    <div key={entry.id} className="bg-slate-800/50 p-3 rounded-lg flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            {cosmetic && (
                                <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-slate-700 rounded-md">
                                    <ItemPreview cosmetic={cosmetic} />
                                </div>
                            )}
                            <div>
                                <p className="font-semibold text-white">{entry.cosmeticName}</p>
                                <p className="text-xs text-slate-400">{onlineService.formatFullTimestamp(entry.timestamp)}</p>
                            </div>
                        </div>
                        <div className="font-semibold text-yellow-400 flex items-center gap-1.5">
                            <span>{entry.price}</span>
                            <span>💰</span>
                        </div>
                    </div>
                );
            })}
            {history.length > displayedCount && (
                <div className="text-center mt-4">
                    <button onClick={() => setDisplayedCount(prev => prev + 10)} className="bg-slate-700 text-slate-300 text-sm px-4 py-2 rounded-full hover:bg-slate-600 transition-colors">
                        Load More
                    </button>
                </div>
            )}
        </div>
    );
};

export default PurchaseHistoryTab;