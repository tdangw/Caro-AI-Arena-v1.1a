import type React from 'react';

export type Player = 'X' | 'O';
export type CellState = Player | null;
export type BoardState = CellState[][];
export type GameMode = 'pve' | 'online';

export type GameStatus = 'win' | 'draw' | 'in_progress';

export interface GameTheme {
  id: string;
  name: string;
  boardBg: string; // Fallback color
  boardBgImage?: string; // Image URL
  cellBg: string;
  gridColor: string;
  nameColor: string;
  decoratorComponent?: React.FC;
}

export interface BoardStyle {
  id: string;
  name: string;
  style: React.CSSProperties;
}

export interface PieceStyle {
  id: string;
  name: string;
  component: React.FC<{ className?: string }>;
}

export interface PieceEffect {
  id: string;
  name: string;
  component: React.FC<{ className?: string }>;
  previewComponent: React.FC;
}

export interface VictoryEffect {
  id: string;
  name: string;
  component: React.FC;
  previewComponent: React.FC;
}

export interface BoomEffect {
  id: string;
  name: string;
  component: React.FC<{ winnerCoords?: DOMRect, loserCoords?: DOMRect }>;
  previewComponent: React.FC;
}

export interface Avatar {
    id: string;
    name: string;
    url: string; // Changed from component to url for image path
}

export interface Emoji {
    id: string;
    name: string;
    emoji: string;
}

export interface AnimatedEmoji {
    id: string;
    name: string;
    url: string; // URL to the GIF
}

export type CosmeticType = 'theme' | 'piece' | 'avatar' | 'emoji' | 'animated_emoji' | 'effect' | 'victory' | 'boom' | 'board';

export interface Cosmetic {
  id: string;
  name: string;
  type: CosmeticType;
  price: number;
  item: GameTheme | PieceStyle | Avatar | Emoji | AnimatedEmoji | PieceEffect | VictoryEffect | BoomEffect | BoardStyle;
}

export interface BotProfile {
    id: string;
    name: string;
    avatar: string; // This is now an image URL
    level: number;
    skillLevel: 'easy' | 'medium' | 'hard';
    description: string;
    cp?: number;
}

export interface MusicTrack {
  id: string;
  name: string;
  url: string;
}

// --- Online Mode Types ---

export interface UserProfile {
    uid: string;
    name: string;
    email: string | null;
    isAnonymous: boolean;
    level: number;
    xp: number;
    coins: number;
    cp: number;
    onlineWins: number;
    onlineLosses: number;
    onlineDraws: number;
    pveWins: number;
    pveLosses: number;
    pveDraws: number;
    ownedCosmeticIds: string[];
    emojiInventory: Record<string, number>;
    activeThemeId: string;
    activePieceId: string;
    activeAvatarId: string;
    activeEffectId: string;
    activeVictoryEffectId: string;
    activeBoomEffectId: string;
    activeBoardId: string;
    statusMessage?: string;
    // FIX: Added missing 'pendingGiftIds' property. This is used to track gifts that have been sent to a user but not yet claimed.
    pendingGiftIds?: string[];
    botStats: Record<string, { wins: number; losses: number; draws: number; }>;
    processedGameIds?: string[];
}

export interface OnlinePlayer {
    uid: string;
    name: string;
    level: number;
    avatarUrl: string;
    status: 'idle' | 'in_game' | 'in_queue';
    gameId?: string | null;
    cp?: number;
    statusMessage?: string;
}

export interface Invitation {
    from: string;
    fromName: string;
    timestamp: number;
}

export type Notification = {
    id: string;
    type: 'message' | 'friend_request' | 'gift';
    text: string;
    senderId: string;
    senderName: string;
    timestamp: any;
    seen: boolean;
    cosmeticId?: string;
}

export type BoardMap = Record<string, Player>; // e.g. { "0_7": "X", "1_7": "O" }

export interface OnlineGame {
    id: string;
    players: {
        X: string; // UID of player X
        O: string; // UID of player O
    };
    playerDetails: {
        [uid: string]: {
            name: string;
            avatarUrl: string;
            level: number;
            pieceId: string;
            cp: number;
        }
    };
    board: BoardMap;
    currentPlayer: Player;
    status: 'in_progress' | 'finished';
    winner: Player | 'draw' | null;
    winningLine: { row: number; col: number }[] | null;
    createdAt: number;
    updatedAt: number;
    playerTimes: {
        X: number; // seconds remaining
        O: number;
    };
    turnStartedAt: number; // timestamp
    emotes?: {
        uid: string;
        emoji: string;
        timestamp: number;
    };
    leftGame?: {
        [uid: string]: boolean;
    };
    chatId: string;
}

export interface MatchHistoryEntry {
  id: string; // gameId
  opponentId: string;
  opponentName: string;
  opponentAvatarUrl: string;
  opponentLevel: number;
  opponentCp?: number;
  result: 'win' | 'loss' | 'draw';
  cpChange: number;
  timestamp: number;
  duration: number; // in seconds
  chatId: string;
  boardState?: BoardMap;
  winningLine?: { row: number; col: number }[] | null;
  playerLevel: number;
  playerXPieceId: string;
  playerOPieceId: string;
  playerMark?: Player;
}

export interface PveMatchHistoryEntry {
  id: string;
  opponentName: string;
  opponentAvatar: string;
  opponentLevel: number;
  result: 'win' | 'loss' | 'draw';
  timestamp: number;
  boardState: BoardMap;
  duration: number; // in seconds
  winningLine: { row: number; col: number }[] | null;
  opponentCp?: number;
  playerLevel: number;
  playerXPieceId: string;
  playerOPieceId: string;
}

export interface PurchaseHistoryEntry {
    id: string;
    cosmeticId: string;
    cosmeticName: string;
    price: number;
    timestamp: any;
}

export interface GiftHistoryEntry {
    id: string;
    cosmeticId: string;
    cosmeticName: string;
    recipientId: string;
    recipientName: string;
    timestamp: any;
}


export interface RankInfo {
  name: string;
  cpInTier: number;
  icon: string;
}

export type FriendStatus = 'pending' | 'received' | 'friends';

export interface Friend {
    uid: string;
    name: string;
    avatarUrl: string;
    level: number;
    status: FriendStatus;
    onlineStatus?: 'idle' | 'in_game' | 'in_queue' | 'offline';
    statusMessage?: string;
}

export interface ChatMessage {
    id: string;
    senderId: string;
    text: string;
    timestamp: any; // Firestore timestamp
}

export interface LockerItem {
    id: string;
    cosmeticId: string;
    fromUid: string;
    fromName: string;
    receivedAt: any; // Firestore timestamp
    isClaimed: boolean;
}