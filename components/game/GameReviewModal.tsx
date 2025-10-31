import React, { useMemo } from 'react';
import Modal from '../Modal';
import type { PveMatchHistoryEntry, MatchHistoryEntry, BoardState, PieceStyle } from '../../types';
import { DEFAULT_PIECES_X, DEFAULT_PIECES_O, getRankFromCp, ALL_COSMETICS } from '../../constants';
import { mapToBoard } from '../../services/onlineService';

interface GameReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    game: PveMatchHistoryEntry | MatchHistoryEntry;
    playerProfile: { playerName: string; cp: number };
}

const GameReviewModal: React.FC<GameReviewModalProps> = ({ isOpen, onClose, game, playerProfile }) => {
    // Correctly determine which player was X and O, and what pieces they used.
    const { playerMark, opponentMark, PlayerPieceComponent, OpponentPieceComponent } = useMemo(() => {
        const isPve = 'opponentAvatar' in game;
        const pMark = isPve ? 'X' : (game as MatchHistoryEntry).playerMark || 'X';
        const oMark = pMark === 'X' ? 'O' : 'X';

        const playerPieceId = pMark === 'X' ? game.playerXPieceId : game.playerOPieceId;
        const opponentPieceId = oMark === 'X' ? game.playerXPieceId : game.playerOPieceId;

        const playerPieceCosmetic = ALL_COSMETICS.find(c => c.id === playerPieceId && c.type === 'piece');
        const opponentPieceCosmetic = ALL_COSMETICS.find(c => c.id === opponentPieceId && c.type === 'piece');

        const PlayerPiece = playerPieceCosmetic ? (playerPieceCosmetic.item as PieceStyle).component : (pMark === 'X' ? DEFAULT_PIECES_X.component : DEFAULT_PIECES_O.component);
        const OpponentPiece = opponentPieceCosmetic ? (opponentPieceCosmetic.item as PieceStyle).component : (oMark === 'X' ? DEFAULT_PIECES_X.component : DEFAULT_PIECES_O.component);
        
        return {
            playerMark: pMark,
            opponentMark: oMark,
            PlayerPieceComponent: PlayerPiece,
            OpponentPieceComponent: OpponentPiece
        };
    }, [game]);

    // This is for rendering the board, which is based on X and O marks, not player/opponent
    const PieceX_Component = useMemo(() => {
        const piece = ALL_COSMETICS.find(c => c.id === game.playerXPieceId && c.type === 'piece');
        return piece ? (piece.item as PieceStyle).component : DEFAULT_PIECES_X.component;
    }, [game.playerXPieceId]);

    const PieceO_Component = useMemo(() => {
        const piece = ALL_COSMETICS.find(c => c.id === game.playerOPieceId && c.type === 'piece');
        return piece ? (piece.item as PieceStyle).component : DEFAULT_PIECES_O.component;
    }, [game.playerOPieceId]);


    if (!game) return null;

    const isPve = 'opponentAvatar' in game;
    const board: BoardState = mapToBoard(game.boardState || {});

    const moveCountX = Object.values(game.boardState || {}).filter(p => p === 'X').length;
    const moveCountO = Object.values(game.boardState || {}).filter(p => p === 'O').length;
    const playerMoveCount = playerMark === 'X' ? moveCountX : moveCountO;
    const opponentMoveCount = opponentMark === 'X' ? moveCountX : moveCountO;

    const opponentName = isPve ? game.opponentName : (game as MatchHistoryEntry).opponentName;
    // This shows the player's *current* rank, as historical rank isn't stored.
    const playerRank = getRankFromCp(playerProfile.cp);
    const opponentRank = getRankFromCp(game.opponentCp);
    const playerLevel = game.playerLevel;
    const opponentLevel = game.opponentLevel;
    const gameIdToDisplay = isPve 
        ? `PVE ID: ${game.id.split('_').pop()?.substring(0, 6)}`
        : `Room: ${game.id.split('_').pop()?.substring(0, 6)}`;
    
    const titleNode = (
        <div className="flex items-baseline gap-2">
            <h2 className="text-xl font-bold text-cyan-400">Game Review</h2>
            {gameIdToDisplay && <p className="text-xs text-slate-500 font-mono">{gameIdToDisplay}</p>}
        </div>
    );


    const isWinningCell = (r: number, c: number) => {
        return game.winningLine?.some(cell => cell.row === r && cell.col === c);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg" title={titleNode}>
            <div className="flex flex-col text-white">
                <div className="flex justify-between items-center w-full mb-4">
                    {/* Player Info */}
                    <div className="text-left w-2/5">
                        <div className="flex items-baseline gap-2">
                            <h3 className="font-bold text-white text-lg truncate" title={playerProfile.playerName}>{playerProfile.playerName}</h3>
                            <p className="text-cyan-400 font-semibold text-sm">Lv. {playerLevel}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                           <p className="text-sm text-slate-400">{playerRank.icon} {playerRank.name}</p>
                           <div className="w-5 h-5 flex-shrink-0"><PlayerPieceComponent className={playerMark === 'X' ? 'text-cyan-400' : 'text-pink-500'} /></div>
                           {playerMoveCount > 0 && (
                                <span className="text-slate-400 text-xs font-bold">
                                    {playerMoveCount}
                                </span>
                           )}
                        </div>
                    </div>
                    
                    {/* Game Result */}
                    <div className="text-center w-1/5">
                        <p className={`text-lg font-bold ${game.result === 'win' ? 'text-green-400' : game.result === 'loss' ? 'text-red-400' : 'text-yellow-400'}`}>{game.result.toUpperCase()}</p>
                        <p className="text-xs text-slate-400">⏱️ {Math.floor(game.duration / 60)}m {game.duration % 60}s</p>
                    </div>

                    {/* Opponent Info */}
                    <div className="text-right w-2/5">
                        <div className="flex items-baseline gap-2 justify-end">
                            <p className="text-cyan-400 font-semibold text-sm">Lv. {opponentLevel}</p>
                            <h3 className="font-bold text-white text-lg truncate" title={opponentName}>{opponentName}</h3>
                        </div>
                         <div className="flex items-center justify-end gap-2 mt-1">
                           {opponentMoveCount > 0 && (
                                <span className="text-slate-400 text-xs font-bold">
                                    {opponentMoveCount}
                                </span>
                           )}
                           <div className="w-5 h-5 flex-shrink-0"><OpponentPieceComponent className={opponentMark === 'X' ? 'text-cyan-400' : 'text-pink-500'} /></div>
                           <p className="text-sm text-slate-400">{opponentRank.icon} {opponentRank.name}</p>
                        </div>
                    </div>
                </div>

                <div 
                    className="grid border-t border-l border-slate-600 bg-slate-900 w-full relative"
                    style={{ gridTemplateColumns: `repeat(${board.length}, minmax(0, 1fr))` }}
                >
                    {board.map((row, r) =>
                        row.map((cell, c) => (
                            <div key={`${r}-${c}`} className="relative aspect-square flex items-center justify-center border-r border-b border-slate-600">
                                {isWinningCell(r, c) && (
                                    <div className="absolute inset-0 bg-yellow-400/30 animate-pulse" style={{boxShadow: '0 0 10px #facc15'}}></div>
                                )}
                                {cell === 'X' && <PieceX_Component className="w-full h-full p-1 text-cyan-400" />}
                                {cell === 'O' && <PieceO_Component className="w-full h-full p-1 text-pink-500" />}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default GameReviewModal;