import { useState, useEffect, useMemo, useRef } from 'react';
import * as onlineService from '../services/onlineService';
import type { OnlineGame, BoardState, Player } from '../types';
// FIX: Changed to Firebase v9 modular User type to match what AuthContext provides.
import type { User } from 'firebase/auth';
import { TURN_TIME, INITIAL_GAME_TIME } from '../constants';

// FIX: Removed unused opponentName parameter which caused a circular dependency in GameScreen.tsx.
export const useOnlineGame = (
  onlineGameId: string | null,
  // FIX: Changed User type to v9 modular User.
  user: User | null
) => {
  const [onlineGame, setOnlineGame] = useState<OnlineGame | null>(null);
  const [board, setBoard] = useState<BoardState>(() =>
    onlineService.mapToBoard({})
  );
  const [lastMove, setLastMove] = useState<{ row: number; col: number } | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const lastProcessedEmoteTimestampRef = useRef<number>(0);
  const [opponentEmote, setOpponentEmote] = useState<{
    key: number;
    emoji: string;
  } | null>(null);
  const [opponentChatMessage, setOpponentChatMessage] = useState<{key: number, text: string} | null>(null);
  const [turnTimeLeft, setTurnTimeLeft] = useState(TURN_TIME);
  const [activePlayerTime, setActivePlayerTime] = useState(INITIAL_GAME_TIME);
  const [hasNewMessage, setHasNewMessage] = useState(false);

  const playerMark = useMemo<Player>(() => {
    if (onlineGame && user) {
      return onlineGame.players.X === user.uid ? 'X' : 'O';
    }
    return 'X';
  }, [onlineGame, user]);

  // Main listener for game state from Firestore
  useEffect(() => {
    if (!onlineGameId || !user) {
      setIsLoading(false);
      setOnlineGame(null);
      return;
    }
    setIsLoading(true);

    const unsubscribe = onlineService.getOnlineGameStream(
      onlineGameId,
      (game) => {
        if (game) {
          setOnlineGame(game);

          // Emote handling
          if (game.emotes && user) {
            const { uid, emoji, timestamp } = game.emotes;
            if (
              uid !== user.uid &&
              timestamp > lastProcessedEmoteTimestampRef.current
            ) {
              lastProcessedEmoteTimestampRef.current = timestamp;
              setOpponentEmote({ key: timestamp, emoji });
            }
          }

          // Board update handling
          setBoard((prevBoard) => {
            const newBoard = onlineService.mapToBoard(game.board);
            if (JSON.stringify(prevBoard) !== JSON.stringify(newBoard)) {
              setLastMove(onlineService.getLastMove(prevBoard, newBoard));
            }
            return newBoard;
          });
        } else {
          setOnlineGame(null);
        }
        setIsLoading(false);
      }
    );

    let unsubscribeChat: (() => void) | null = null;
    if (onlineGameId && user) {
        const chatId = onlineGameId;
        unsubscribeChat = onlineService.listenForNewMessages(chatId, user.uid, (message) => {
            setHasNewMessage(true);
             if (message.text.startsWith('REACT:')) {
                const parts = message.text.split(':');
                if (parts.length === 3) {
                    const [, emoji] = parts;
                    setOpponentChatMessage({
                        key: message.timestamp?.toMillis() || Date.now(),
                        text: `reacted with ${emoji}`
                    });
                }
            } else {
                setOpponentChatMessage({ key: message.timestamp?.toMillis() || Date.now(), text: message.text });
            }
        });
    }

    return () => {
        unsubscribe();
        if (unsubscribeChat) unsubscribeChat();
    };
    // FIX: Removed opponentName from dependency array as it's not used inside the effect.
  }, [onlineGameId, user]);

  // Timer and timeout detection logic
  useEffect(() => {
    if (!onlineGame || onlineGame.status === 'finished') {
      setTurnTimeLeft(TURN_TIME);
      const lastPlayer = onlineGame?.currentPlayer || 'X';
      setActivePlayerTime(
        onlineGame?.playerTimes?.[lastPlayer] ?? INITIAL_GAME_TIME
      );
      return;
    }

    const timerId = setInterval(() => {
      if (!onlineGame || !user) return; // Add guard for safety
      
      const turnElapsed = (Date.now() - onlineGame.turnStartedAt) / 1000;
      const turnRemaining = TURN_TIME - turnElapsed;
      setTurnTimeLeft(turnRemaining);

      const currentPlayer = onlineGame.currentPlayer;
      const timeBank = onlineGame.playerTimes[currentPlayer];
      const remainingInBank = timeBank - turnElapsed;
      setActivePlayerTime(Math.max(0, remainingInBank));

      if (remainingInBank < -2) { // 2-second grace period
        // Self-timeout logic (I timed out)
        if (onlineGame.currentPlayer === playerMark) {
          onlineService.resignOnlineGame(onlineGame.id, playerMark);
        }
        // Opponent timeout claim logic (they timed out)
        else {
          onlineService.claimTimeoutVictory(onlineGame.id, playerMark);
        }
      }
    }, 500);

    return () => clearInterval(timerId);
  }, [onlineGame, playerMark, user]);

  return {
    // Game state
    board,
    currentPlayer: onlineGame?.currentPlayer || null,
    winner: onlineGame?.winner || null,
    isGameOver: onlineGame?.status === 'finished',
    winningLine: onlineGame?.winningLine || [],

    // Meta state
    isDecidingFirst: false,
    isLoading,
    onlineGameData: onlineGame,
    lastMove,
    opponentEmote,
    hasNewMessage,
    opponentChatMessage,

    // Info
    playerMark,
    gameId: onlineGame?.id || null,
    activePlayerTime,
    turnTimeLeft,

    // Actions
    makeMove: (row: number, col: number) => {
      if (onlineGameId) {
        onlineService.makeOnlineMove(onlineGameId, row, col, playerMark);
      }
    },
    resign: () => {
      if (onlineGameId) {
        onlineService.resignOnlineGame(onlineGameId, playerMark);
      }
    },
    sendEmote: (emoji: string) => {
      if (onlineGameId && user) {
        onlineService.sendOnlineEmote(onlineGameId, user.uid, emoji);
      }
    },
    resetNewMessageIndicator: () => setHasNewMessage(false),
    // No-op functions to match useGameLogic signature where not applicable
    beginGame: () => {},
    resetGameForRematch: () => {},
    undoMove: () => {},
    canUndo: false,
    moveHistory: [],
  };
};