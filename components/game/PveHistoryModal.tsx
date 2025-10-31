import React, { useState } from 'react';
import Modal from '../Modal';
import { useGameState } from '../../context/GameStateContext';
import { formatFullTimestamp } from '../../services/onlineService';
import type { PveMatchHistoryEntry, PieceStyle } from '../../types';
import { useSound } from '../../hooks/useSound';
import GameReviewModal from './GameReviewModal';
import { getRankFromCp, ALL_COSMETICS, DEFAULT_PIECES_O, XP_REWARD } from '../../constants';

const PveHistoryModal: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    const { gameState } = useGameState();
    const [displayedCount, setDisplayedCount] = useState(10);
    const { playSound } = useSound();
    const [reviewingGame, setReviewingGame] = useState<PveMatchHistoryEntry | null>(null);

    const history = gameState.pveMatchHistory;

    const handleLoadMore = () => {
        setDisplayedCount(prev => prev + 10);
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="PVE Match History" size="xl">
            <div className="max-h-[60vh] overflow-y-auto pr-2 scrollbar-hide">
                {history.length === 0 ? <p className="text-slate-400 text-center py-8">No AI matches played yet.</p> :
                 <>
                    <div className="space-y-3">
                        {history.slice(0, displayedCount).map(entry => {
                            const duration = `${Math.floor(entry.duration / 60)}m ${entry.duration % 60}s`;
                            const rank = getRankFromCp(entry.opponentCp);
                            const xpGained = XP_REWARD[entry.result];

                            const opponentMark = 'O'; // In PVE, player is always X, bot is O
                            const opponentPieceId = entry.playerOPieceId;

                            const opponentPieceCosmetic = ALL_COSMETICS.find(c => c.id === opponentPieceId && c.type === 'piece');
                            const OpponentPiece = opponentPieceCosmetic
                                ? (opponentPieceCosmetic.item as PieceStyle).component
                                : DEFAULT_PIECES_O.component;

                            const moveCount = entry.boardState ? Object.values(entry.boardState).filter(p => p === opponentMark).length : 0;

                            return (
                                <div key={entry.id} className="bg-slate-800/50 p-3 rounded-lg mb-3 flex items-center justify-between gap-4">
                                    {/* Opponent Info (Left) */}
                                    <div className="flex items-center gap-3 w-2/5 min-w-0">
                                        <img src={entry.opponentAvatar} alt={entry.opponentName} className="w-12 h-12 rounded-full object-cover bg-slate-700 flex-shrink-0" />
                                        <div className="overflow-hidden">
                                            <div className="flex items-baseline gap-2">
                                                <p className="font-semibold text-white truncate">{entry.opponentName}</p>
                                                <p className="text-xs text-cyan-400">Lv. {entry.opponentLevel}</p>
                                            </div>
                                            <p className="text-xs text-slate-400 truncate flex items-center gap-2">
                                                <span>{rank.icon} {rank.name}</span>
                                                <span className={`w-4 h-4 text-pink-500`}><OpponentPiece /></span>
                                                {moveCount > 0 && <span className="text-slate-400 text-xs font-bold">{moveCount}</span>}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Result & Time Info (Center) */}
                                    <div className="text-center text-sm flex-grow">
                                        <div className="flex items-baseline justify-center gap-3">
                                            <span className={`font-bold text-base text-purple-400`}>
                                                +{xpGained} XP
                                            </span>
                                            <div className="flex items-center gap-1 text-slate-400 text-xs">
                                                <span>⏱️ {duration}</span>
                                            </div>
                                        </div>
                                        <div className="text-slate-400 text-xs mt-1">
                                            <p>{formatFullTimestamp(entry.timestamp)}</p>
                                        </div>
                                    </div>
                                    
                                    {/* Review Button (Right) */}
                                    <div className="flex flex-col gap-1 flex-shrink-0 w-16 items-end">
                                        <button onClick={() => { playSound('select'); setReviewingGame(entry); }} className="p-1.5 rounded-md text-xs bg-slate-700 hover:bg-slate-600 transition-colors w-full text-center" title="Review Game">Review</button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    {history.length > displayedCount && (
                        <div className="text-center mt-4">
                            <button onClick={handleLoadMore} className="bg-slate-700 text-slate-300 text-sm px-4 py-2 rounded-full hover:bg-slate-600 transition-colors">
                                Load More
                            </button>
                        </div>
                    )}
                 </>
                }
            </div>
            {reviewingGame && (
                <GameReviewModal
                    isOpen={!!reviewingGame}
                    onClose={() => setReviewingGame(null)}
                    game={reviewingGame}
                    playerProfile={gameState}
                />
            )}
        </Modal>
    );
};

export default PveHistoryModal;