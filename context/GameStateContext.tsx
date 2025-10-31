import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback, useRef } from 'react';
// FIX: Added 'Player' to type imports to resolve 'Cannot find name' error.
import type { Cosmetic, GameTheme, PieceStyle, Avatar, PieceEffect, VictoryEffect, BoomEffect, UserProfile, CosmeticType, RankInfo, LockerItem, Friend, Notification, MatchHistoryEntry, PveMatchHistoryEntry, BoardStyle, PurchaseHistoryEntry, AnimatedEmoji, BoardState, BoardMap, Player } from '../types';
import { DEFAULT_THEME, DEFAULT_PIECES_X, DEFAULT_PIECES_O, DEFAULT_AVATAR, getXpForNextLevel, THEMES, PIECE_STYLES, AVATARS, PIECE_EFFECTS, VICTORY_EFFECTS, BOOM_EFFECTS, DEFAULT_EFFECT, DEFAULT_VICTORY_EFFECT, DEFAULT_BOOM_EFFECT, ALL_COSMETICS, MUSIC_TRACKS, COIN_REWARD, XP_REWARD, getRankFromCp, BOTS, DEFAULT_BOARD_STYLE, BOARD_STYLES, ANIMATED_EMOJIS } from '../constants';
import { useAuth } from './AuthContext';
import * as onlineService from '../services/onlineService';
import { db } from '../firebaseConfig';
// FIX: Firebase v9 modular imports are failing; switch to compat syntax which works with the existing `db` instance.
import 'firebase/compat/firestore';


const LOCAL_STORAGE_KEY = 'caroGameState_v9_guest'; // Renamed to avoid conflicts

interface GameState {
  coins: number;
  cp: number;
  playerName: string;
  pveWins: number;
  pveLosses: number;
  pveDraws: number;
  onlineWins: number;
  onlineLosses: number;
  onlineDraws: number;
  playerLevel: number;
  playerXp: number;
  ownedCosmeticIds: string[];
  emojiInventory: Record<string, number>;
  botStats: Record<string, { wins: number; losses: number; draws: number; }>;
  pveMatchHistory: PveMatchHistoryEntry[];
  purchaseHistory: PurchaseHistoryEntry[];
  activeTheme: GameTheme;
  activePieceX: PieceStyle;
  activePieceO: PieceStyle;
  activeAvatar: Avatar;
  activeEffect: PieceEffect;
  activeVictoryEffect: VictoryEffect;
  activeBoomEffect: BoomEffect;
  activeBoard: BoardStyle;
  isSoundOn: boolean;
  isMusicOn: boolean;
  soundVolume: number;
  musicVolume: number;
  activeMusicUrl: string;
  statusMessage?: string;
  toast: { id: number, message: string, type: 'success' | 'error', cosmeticId?: string } | null;
  friends: Friend[];
  notifications: Notification[];
  messageToast: Notification | null;
  // FIX: Add showThreats to the GameState interface.
  showThreats: boolean;
}

interface GameStateContextType {
  gameState: GameState;
  rankNotification: { type: 'up' | 'down', from: RankInfo, to: RankInfo } | null;
  clearRankNotification: () => void;
  setPlayerName: (name: string) => Promise<{success: boolean, message: string}>;
  applyGameResult: (result: 'win' | 'loss' | 'draw', opponentId: string, gameData: { id: string | null, isPVE: boolean, boardState?: BoardState | BoardMap, createdAt?: number, updatedAt?: number, opponentDetails?: { name: string, avatarUrl: string, level: number, cp?: number }, chatId?: string, duration?: number, winningLine?: { row: number, col: number }[] | null, opponentCp?: number, playerLevel?: number, playerXPieceId?: string, playerOPieceId?: string, playerMark?: Player }, cpChange?: number) => void;
  spendCoins: (amount: number) => boolean;
  purchaseCosmetic: (cosmetic: Cosmetic) => void;
  consumeEmoji: (emojiId: string) => void;
  equipTheme: (theme: GameTheme) => void;
  equipPiece: (piece: PieceStyle) => void;
  equipAvatar: (avatar: Avatar) => void;
  equipEffect: (effect: PieceEffect) => void;
  equipVictoryEffect: (effect: VictoryEffect) => void;
  equipBoomEffect: (effect: BoomEffect) => void;
  equipBoard: (board: BoardStyle) => void;
  toggleSound: () => void;
  toggleMusic: () => void;
  setSoundVolume: (volume: number) => void;
  setMusicVolume: (volume: number) => void;
  equipMusic: (musicUrl: string) => void;
  claimGift: (gift: LockerItem) => Promise<{success: boolean, message: string}>;
  setStatusMessage: (message: string) => void;
  showToast: (message: string, type?: 'success' | 'error', cosmeticId?: string) => void;
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  // FIX: Add toggleShowThreats to the context type.
  toggleShowThreats: () => void;
}

const GameStateContext = createContext<GameStateContextType | undefined>(undefined);

const sanitizeCosmetic = (cosmetic: any) => {
    if (!cosmetic) return null;
    const { component, previewComponent, decoratorComponent, ...rest } = cosmetic;
    return rest;
};

const createDefaultGameState = (): GameState => ({
  coins: 500,
  cp: 0,
  playerName: `Player_${Math.floor(1000 + Math.random() * 9000)}`,
  pveWins: 0,
  pveLosses: 0,
  pveDraws: 0,
  onlineWins: 0,
  onlineLosses: 0,
  onlineDraws: 0,
  playerLevel: 1,
  playerXp: 0,
  ownedCosmeticIds: [DEFAULT_THEME.id, DEFAULT_PIECES_X.id, DEFAULT_PIECES_O.id, DEFAULT_AVATAR.id, DEFAULT_EFFECT.id, DEFAULT_VICTORY_EFFECT.id, DEFAULT_BOOM_EFFECT.id, DEFAULT_BOARD_STYLE.id],
  emojiInventory: {
    'emoji_wave': 10,
    'emoji_think': 10,
    'anim_emoji_laugh': 5,
  },
  botStats: {},
  pveMatchHistory: [],
  purchaseHistory: [],
  activeTheme: DEFAULT_THEME,
  activePieceX: DEFAULT_PIECES_X,
  activePieceO: DEFAULT_PIECES_O,
  activeAvatar: DEFAULT_AVATAR,
  activeEffect: DEFAULT_EFFECT,
  activeVictoryEffect: DEFAULT_VICTORY_EFFECT,
  activeBoomEffect: DEFAULT_BOOM_EFFECT,
  activeBoard: DEFAULT_BOARD_STYLE,
  isSoundOn: true,
  isMusicOn: true,
  soundVolume: 1,
  musicVolume: 1,
  activeMusicUrl: MUSIC_TRACKS[0].url,
  statusMessage: "Available for a match!",
  toast: null,
  friends: [],
  notifications: [],
  messageToast: null,
  showThreats: false,
});

const loadGuestState = (): GameState => {
  try {
    const savedState = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedState) {
        const parsed = JSON.parse(savedState);
        
        // Re-hydrate all cosmetic items with their full definitions from constants
        const allPieces = [DEFAULT_PIECES_X, DEFAULT_PIECES_O, ...PIECE_STYLES];
        const allAvatars = [DEFAULT_AVATAR, ...AVATARS];
        const allEffects = [DEFAULT_EFFECT, ...PIECE_EFFECTS];
        const allVictoryEffects = [DEFAULT_VICTORY_EFFECT, ...VICTORY_EFFECTS];
        const allBoomEffects = [DEFAULT_BOOM_EFFECT, ...BOOM_EFFECTS];
        const allBoards = [DEFAULT_BOARD_STYLE, ...BOARD_STYLES];

        const activeTheme = THEMES.find(t => t.id === parsed.activeTheme?.id) || DEFAULT_THEME;
        const activePieceX = allPieces.find(p => p.id === parsed.activePieceX?.id) || DEFAULT_PIECES_X;
        const activePieceO = allPieces.find(p => p.id === parsed.activePieceO?.id) || DEFAULT_PIECES_O;
        const activeAvatar = allAvatars.find(a => a.id === parsed.activeAvatar?.id) || DEFAULT_AVATAR;
        const activeEffect = allEffects.find(e => e.id === parsed.activeEffect?.id) || DEFAULT_EFFECT;
        const activeVictory = allVictoryEffects.find(v => v.id === parsed.activeVictoryEffect?.id) || DEFAULT_VICTORY_EFFECT;
        const activeBoom = allBoomEffects.find(b => b.id === parsed.activeBoomEffect?.id) || DEFAULT_BOOM_EFFECT;
        const activeBoard = allBoards.find(b => b.id === parsed.activeBoard?.id) || DEFAULT_BOARD_STYLE;
        
        // Backward compatibility for old stats
        const pveWins = parsed.pveWins ?? parsed.wins ?? 0;
        const pveLosses = parsed.pveLosses ?? parsed.losses ?? 0;
        const pveDraws = parsed.pveDraws ?? parsed.draws ?? 0;

        return {
            ...createDefaultGameState(),
            ...parsed,
            pveWins,
            pveLosses,
            pveDraws,
            onlineWins: parsed.onlineWins ?? 0,
            onlineLosses: parsed.onlineLosses ?? 0,
            onlineDraws: parsed.onlineDraws ?? 0,
            cp: parsed.cp ?? 0,
            statusMessage: parsed.statusMessage || "Available for a match!",
            pveMatchHistory: parsed.pveMatchHistory || [],
            purchaseHistory: parsed.purchaseHistory || [],
            activeTheme,
            activePieceX,
            activePieceO,
            activeAvatar,
            activeEffect,
            activeVictoryEffect: activeVictory,
            activeBoomEffect: activeBoom,
            activeBoard,
            showThreats: parsed.showThreats ?? false,
        };
    }
  } catch (error) { console.error("Failed to parse guest state", error); }
  return createDefaultGameState();
}

export const GameStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [gameState, setGameState] = useState<GameState>(loadGuestState);
  const [rankNotification, setRankNotification] = useState<{ type: 'up' | 'down', from: RankInfo, to: RankInfo } | null>(null);
  const loadedUserIdRef = useRef<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processedGameIdsRef = useRef(new Set<string>());

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success', cosmeticId?: string) => {
    if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
    }
    setGameState(prev => ({ ...prev, toast: { id: Date.now(), message, type, cosmeticId } }));
    toastTimerRef.current = setTimeout(() => {
        setGameState(prev => ({ ...prev, toast: null }));
        toastTimerRef.current = null;
    }, 4000);
  }, []);

  // Effect to load data from Firebase when user logs in
  useEffect(() => {
    let allUnsubscribers: (() => void)[] = [];

    if (user) {
        if (loadedUserIdRef.current === user.uid) {
            return;
        }
        loadedUserIdRef.current = user.uid;
        const isInitialLoadDoneRef = { current: false };

        // FIX: Use compat syntax for onSnapshot.
        const unsubProfile = db.collection('users').doc(user.uid).onSnapshot(async (doc) => {
            console.log("[GameStateContext] Profile snapshot received.");
            if (doc.exists) {
                const profile = doc.data() as UserProfile;
                const activeTheme = THEMES.find(t => t.id === profile.activeThemeId) || DEFAULT_THEME;
                const activePiece = PIECE_STYLES.find(p => p.id === profile.activePieceId) || DEFAULT_PIECES_X;
                const activeAvatar = AVATARS.find(a => a.id === profile.activeAvatarId) || DEFAULT_AVATAR;
                const activeEffect = PIECE_EFFECTS.find(e => e.id === profile.activeEffectId) || DEFAULT_EFFECT;
                const activeVictory = VICTORY_EFFECTS.find(v => v.id === profile.activeVictoryEffectId) || DEFAULT_VICTORY_EFFECT;
                const activeBoom = BOOM_EFFECTS.find(b => b.id === profile.activeBoomEffectId) || DEFAULT_BOOM_EFFECT;
                const allBoards = [DEFAULT_BOARD_STYLE, ...BOARD_STYLES];
                const activeBoard = allBoards.find(b => b.id === profile.activeBoardId) || DEFAULT_BOARD_STYLE;

                setGameState(prev => ({
                    ...prev,
                    playerName: profile.name,
                    coins: profile.coins,
                    cp: profile.cp ?? 0,
                    onlineWins: profile.onlineWins,
                    onlineLosses: profile.onlineLosses,
                    onlineDraws: profile.onlineDraws,
                    pveWins: profile.pveWins,
                    pveLosses: profile.pveLosses,
                    pveDraws: profile.pveDraws,
                    playerLevel: profile.level,
                    playerXp: profile.xp,
                    ownedCosmeticIds: profile.ownedCosmeticIds || [],
                    emojiInventory: profile.emojiInventory || {},
                    statusMessage: profile.statusMessage || "Available for a match!",
                    activeTheme,
                    activePieceX: activePiece,
                    activePieceO: activePiece,
                    activeAvatar,
                    activeEffect,
                    activeVictoryEffect: activeVictory,
                    activeBoomEffect: activeBoom,
                    activeBoard,
                    botStats: profile.botStats || {},
                    showThreats: profile.showThreats ?? false,
                }));

                if (!isInitialLoadDoneRef.current) {
                    isInitialLoadDoneRef.current = true;
                    const pveHistory = await onlineService.getPveMatchHistory(user.uid);
                    setGameState(prev => ({ ...prev, pveMatchHistory: pveHistory }));
                    await onlineService.setupPresenceSystem(user, profile.level, activeAvatar.url, profile.name, profile.statusMessage);
                }
            } else if (user.isAnonymous) {
                console.log("[GameStateContext] Creating profile for new guest user.");
                await onlineService.createUserProfile(user, `Player_${Math.floor(1000 + Math.random() * 9000)}`);
            } else {
                console.log("[GameStateContext] Waiting for new user profile to be created by AuthScreen...");
            }
        });
        allUnsubscribers.push(unsubProfile);

        const unsubFriends = onlineService.listenForFriends(user.uid, (friendsData) => {
            setGameState(prev => ({ ...prev, friends: friendsData }));
        });
        allUnsubscribers.push(unsubFriends);

        const unsubNotifications = onlineService.listenForNotifications(user.uid, (allNotifications) => {
            setGameState(prev => {
                const currentNotifications = prev.notifications;
                const newNotifications = allNotifications.filter(n => !currentNotifications.some(existing => existing.id === n.id));

                let latestToast: Notification | null = prev.messageToast;
                
                newNotifications.forEach(newNotif => {
                    const timestampValue = newNotif.timestamp;
                    const timestampInMillis = typeof timestampValue === 'number' ? timestampValue : timestampValue?.toMillis?.() || 0;
                    const isRecent = timestampInMillis > Date.now() - 15000;
                    const isFriend = prev.friends.some(f => f.uid === newNotif.senderId && f.status === 'friends');
                    
                    if (isRecent && ((newNotif.type === 'message' && isFriend) || newNotif.type === 'friend_request' || newNotif.type === 'gift')) {
                        latestToast = newNotif;
                    }
                });

                if (latestToast && latestToast !== prev.messageToast) {
                    if (messageToastTimerRef.current) clearTimeout(messageToastTimerRef.current);
                    messageToastTimerRef.current = setTimeout(() => {
                        setGameState(p => ({ ...p, messageToast: null }));
                    }, 5000);
                    return { ...prev, notifications: allNotifications, messageToast: latestToast };
                }

                return { ...prev, notifications: allNotifications };
            });
        });
        allUnsubscribers.push(unsubNotifications);

    } else {
        // User is logged out or a guest
        if (loadedUserIdRef.current) { // Was previously logged in, now logging out
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            processedGameIdsRef.current.clear();
        }
        setGameState(loadGuestState());
        loadedUserIdRef.current = null;
    }

    return () => {
        allUnsubscribers.forEach(unsub => unsub());
        loadedUserIdRef.current = null;
    };
  }, [user]);

  // Effect to save state for guests
  useEffect(() => {
    if (!user) {
        try {
            const stateToSave = { 
                ...gameState,
                toast: null,
                activeTheme: sanitizeCosmetic(gameState.activeTheme),
                activePieceX: sanitizeCosmetic(gameState.activePieceX),
                activePieceO: sanitizeCosmetic(gameState.activePieceO),
                activeAvatar: sanitizeCosmetic(gameState.activeAvatar),
                activeEffect: sanitizeCosmetic(gameState.activeEffect),
                activeVictoryEffect: sanitizeCosmetic(gameState.activeVictoryEffect),
                activeBoomEffect: sanitizeCosmetic(gameState.activeBoomEffect),
                activeBoard: sanitizeCosmetic(gameState.activeBoard),
            };
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateToSave));
        } catch (error) { console.error("Failed to save guest state", error); }
    }
  }, [gameState, user]);
  
  const equipCosmetic = useCallback((type: CosmeticType, item: any) => {
    setGameState(prev => {
      const updates: Partial<GameState> = {};
      const profileUpdates: Partial<UserProfile> = {};

      switch (type) {
        case 'theme':
          updates.activeTheme = item as GameTheme;
          profileUpdates.activeThemeId = item.id;
          break;
        case 'piece':
          updates.activePieceX = item as PieceStyle;
          profileUpdates.activePieceId = item.id;
          break;
        case 'avatar':
          updates.activeAvatar = item as Avatar;
          profileUpdates.activeAvatarId = item.id;
          break;
        case 'effect':
          updates.activeEffect = item as PieceEffect;
          profileUpdates.activeEffectId = item.id;
          break;
        case 'victory':
          updates.activeVictoryEffect = item as VictoryEffect;
          profileUpdates.activeVictoryEffectId = item.id;
          break;
        case 'boom':
          updates.activeBoomEffect = item as BoomEffect;
          profileUpdates.activeBoomEffectId = item.id;
          break;
        case 'board':
          updates.activeBoard = item as BoardStyle;
          profileUpdates.activeBoardId = item.id;
          break;
        default:
          break;
      }

      if (user && !user.isAnonymous && Object.keys(profileUpdates).length > 0) {
        onlineService.updateUserProfile(user.uid, profileUpdates);
      }
      
      return { ...prev, ...updates };
    });
  }, [user]);

  const setPlayerName = useCallback(async (name: string): Promise<{success: boolean, message: string}> => {
    const newName = name.trim();
    if (user && !user.isAnonymous) {
        if (gameState.coins < 100) {
            return { success: false, message: "Not enough coins!" };
        }
        const result = await onlineService.updatePlayerName(user, newName);
        if (result.success) {
            setGameState(prev => ({
                ...prev,
                coins: prev.coins - 100
            }));
        }
        return result;
    }
    return { success: false, message: "Guests cannot change their display name." };
  }, [user, gameState.coins]);

  const setStatusMessage = useCallback((message: string) => {
    const trimmedMessage = message.trim().slice(0, 45);
    setGameState(prev => ({...prev, statusMessage: trimmedMessage }));
    if (user) {
        onlineService.updateStatusMessage(user.uid, trimmedMessage);
    }
  }, [user]);

  const spendCoins = useCallback((amount: number): boolean => {
    if (gameState.coins < amount) return false;
    setGameState(prev => ({...prev, coins: prev.coins - amount}));
    return true;
  }, [gameState.coins]);
  
  const purchaseCosmetic = useCallback((cosmetic: Cosmetic) => {
    if (gameState.coins < cosmetic.price) {
        showToast("Not enough coins!", "error");
        return;
    }

    const isConsumable = (cosmetic.type === 'emoji' || cosmetic.type === 'animated_emoji') && cosmetic.price > 0;
    if (!isConsumable && gameState.ownedCosmeticIds.includes(cosmetic.id)) {
        showToast("You already own this item!", "error");
        return;
    }

    if (user && !user.isAnonymous) {
        // Logged-in user flow with transaction
        onlineService.purchaseItemTransaction(user.uid, cosmetic).then(result => {
            if (result.success) {
                showToast(`Successfully purchased ${cosmetic.name}!`, 'success', cosmetic.id);
            } else {
                showToast(result.message, "error");
            }
        });
    } else {
        // Guest user flow (single, atomic local state update)
        setGameState(prev => {
            const newState: GameState = { ...prev };

            // 1. Deduct coins
            newState.coins = prev.coins - cosmetic.price;

            // 2. Update inventory
            if (isConsumable) {
                const newInventory = { ...prev.emojiInventory };
                newInventory[cosmetic.id] = (newInventory[cosmetic.id] || 0) + 1;
                newState.emojiInventory = newInventory;
            } else {
                newState.ownedCosmeticIds = [...prev.ownedCosmeticIds, cosmetic.id];

                // 3. Equip the newly bought permanent item
                switch (cosmetic.type) {
                    case 'theme': newState.activeTheme = cosmetic.item as GameTheme; break;
                    case 'piece': newState.activePieceX = cosmetic.item as PieceStyle; break;
                    case 'avatar': newState.activeAvatar = cosmetic.item as Avatar; break;
                    case 'effect': newState.activeEffect = cosmetic.item as PieceEffect; break;
                    case 'victory': newState.activeVictoryEffect = cosmetic.item as VictoryEffect; break;
                    case 'boom': newState.activeBoomEffect = cosmetic.item as BoomEffect; break;
                    case 'board': newState.activeBoard = cosmetic.item as BoardStyle; break;
                }
            }

            // 4. Update purchase history for the guest
            const newEntry: PurchaseHistoryEntry = {
                id: `${Date.now()}-${cosmetic.id}`,
                cosmeticId: cosmetic.id,
                cosmeticName: cosmetic.name,
                price: cosmetic.price,
                timestamp: Date.now(),
            };
            newState.purchaseHistory = [newEntry, ...(prev.purchaseHistory || [])];
            
            return newState;
        });
        showToast(`Successfully purchased ${cosmetic.name}!`, 'success', cosmetic.id);
    }
  }, [gameState.coins, gameState.ownedCosmeticIds, gameState.emojiInventory, user, showToast]);

    const applyGameResult = useCallback((result: 'win' | 'loss' | 'draw', opponentId: string, gameData: { id: string | null, isPVE: boolean, boardState?: BoardState | BoardMap, createdAt?: number, updatedAt?: number, opponentDetails?: { name: string, avatarUrl: string, level: number, cp?: number }, chatId?: string, duration?: number, winningLine?: { row: number, col: number }[] | null, opponentCp?: number, playerLevel?: number, playerXPieceId?: string, playerOPieceId?: string, playerMark?: Player }, cpChange = 0) => {
        const gameId = gameData.id;
        if (gameId && processedGameIdsRef.current.has(gameId)) {
            console.log(`[applyGameResult] DUPLICATE call for game ID: ${gameId}. Skipping.`);
            return;
        }
        if (gameId) {
            processedGameIdsRef.current.add(gameId);
        }
    
        let sideEffectPayload: {
            coinsToAdd: number;
            newLevel: number;
            newXp: number;
            newCp: number;
            oldRank: RankInfo;
            newRank: RankInfo;
        } | null = null;
    
        setGameState(prev => {
            const xpToAdd = XP_REWARD[result];
            const coinsToAdd = COIN_REWARD[result];
    
            let newXp = prev.playerXp + xpToAdd;
            let newLevel = prev.playerLevel;
            let xpNeeded = getXpForNextLevel(newLevel);
    
            while (newXp >= xpNeeded) {
                newXp -= xpNeeded;
                newLevel++;
                xpNeeded = getXpForNextLevel(newLevel);
            }
    
            const isPVE = gameData.isPVE;
            const oldRank = getRankFromCp(prev.cp);
            const newCp = !isPVE ? Math.max(0, prev.cp + cpChange) : prev.cp;
            const newRank = getRankFromCp(newCp);
            
            let pveHistoryEntry: PveMatchHistoryEntry | null = null;
            if (isPVE) {
                const bot = BOTS.find(b => b.id === opponentId);
                if(bot && gameData.boardState) {
                    pveHistoryEntry = {
                        id: gameData.id || `${Date.now()}`,
                        opponentName: bot.name,
                        opponentAvatar: bot.avatar,
                        opponentLevel: bot.level,
                        result: result,
                        timestamp: Date.now(),
                        boardState: onlineService.boardToMap(gameData.boardState as BoardState),
                        duration: gameData.duration || 0,
                        winningLine: gameData.winningLine || null,
                        opponentCp: gameData.opponentCp,
                        playerLevel: gameData.playerLevel || prev.playerLevel,
                        playerXPieceId: gameData.playerXPieceId || DEFAULT_PIECES_X.id,
                        playerOPieceId: gameData.playerOPieceId || DEFAULT_PIECES_O.id,
                    };
                }
            }
    
            const newBotStats = { ...prev.botStats };
            if (isPVE) {
                if (!newBotStats[opponentId]) newBotStats[opponentId] = { wins: 0, losses: 0, draws: 0 };
                if (result === 'win') newBotStats[opponentId].wins++;
                else if (result === 'draw') newBotStats[opponentId].draws++;
                else newBotStats[opponentId].losses++;
            }
            
            sideEffectPayload = { coinsToAdd, newLevel, newXp, newCp, oldRank, newRank };
    
            return {
                ...prev,
                coins: prev.coins + coinsToAdd,
                playerXp: newXp,
                playerLevel: newLevel,
                pveWins: isPVE && result === 'win' ? prev.pveWins + 1 : prev.pveWins,
                pveLosses: isPVE && result === 'loss' ? prev.pveLosses + 1 : prev.pveLosses,
                pveDraws: isPVE && result === 'draw' ? prev.pveDraws + 1 : prev.pveDraws,
                onlineWins: !isPVE && result === 'win' ? prev.onlineWins + 1 : prev.onlineWins,
                onlineLosses: !isPVE && result === 'loss' ? prev.onlineLosses + 1 : prev.onlineLosses,
                onlineDraws: !isPVE && result === 'draw' ? prev.onlineDraws + 1 : prev.onlineDraws,
                cp: newCp,
                botStats: newBotStats,
                pveMatchHistory: pveHistoryEntry ? [pveHistoryEntry, ...prev.pveMatchHistory] : prev.pveMatchHistory,
            };
        });
        
        Promise.resolve().then(() => {
            if (sideEffectPayload) {
                if (sideEffectPayload.newRank.name !== sideEffectPayload.oldRank.name && !gameData.isPVE) {
                    setRankNotification({ type: cpChange > 0 ? 'up' : 'down', from: sideEffectPayload.oldRank, to: sideEffectPayload.newRank });
                }
        
                if (user && !user.isAnonymous) {
                    onlineService.updateProfileWithGameResult(
                        user.uid, result, gameData.isPVE, sideEffectPayload.coinsToAdd, 
                        sideEffectPayload.newLevel, sideEffectPayload.newXp, cpChange, gameData.id, opponentId
                    );
        
                    if (gameData.isPVE) {
                        const bot = BOTS.find(b => b.id === opponentId);
                         if(bot && gameData.boardState) {
                            const pveHistoryEntry: PveMatchHistoryEntry = {
                                id: gameData.id || `${Date.now()}`,
                                opponentName: bot.name,
                                opponentAvatar: bot.avatar,
                                opponentLevel: bot.level,
                                result: result,
                                timestamp: Date.now(),
                                boardState: onlineService.boardToMap(gameData.boardState as BoardState),
                                duration: gameData.duration || 0,
                                winningLine: gameData.winningLine || null,
                                opponentCp: gameData.opponentCp,
                                playerLevel: gameData.playerLevel || sideEffectPayload.newLevel,
                                playerXPieceId: gameData.playerXPieceId || DEFAULT_PIECES_X.id,
                                playerOPieceId: gameData.playerOPieceId || DEFAULT_PIECES_O.id,
                            };
                            onlineService.recordPveMatchHistory(user.uid, pveHistoryEntry);
                         }
                    } else if (!gameData.isPVE && gameData.id && gameData.opponentDetails) {
                        const historyEntry: MatchHistoryEntry = {
                            id: gameData.id,
                            opponentId: opponentId,
                            opponentName: gameData.opponentDetails.name,
                            opponentAvatarUrl: gameData.opponentDetails.avatarUrl,
                            opponentLevel: gameData.opponentDetails.level,
                            opponentCp: gameData.opponentDetails.cp,
                            result,
                            cpChange,
                            timestamp: Date.now(),
                            duration: Math.round(((gameData.updatedAt || Date.now()) - (gameData.createdAt || Date.now())) / 1000),
                            chatId: gameData.chatId || gameData.id || '',
                            boardState: gameData.boardState as BoardMap,
                            winningLine: gameData.winningLine,
                            playerLevel: gameData.playerLevel || sideEffectPayload.newLevel,
                            playerXPieceId: gameData.playerXPieceId || DEFAULT_PIECES_X.id,
                            playerOPieceId: gameData.playerOPieceId || DEFAULT_PIECES_O.id,
                            playerMark: gameData.playerMark,
                        };
                        onlineService.recordMatchHistory(user.uid, gameData.id, historyEntry);
                    }
                }
            }
        });
    }, [user, setRankNotification]);
  
  const consumeEmoji = useCallback((emojiId: string) => {
    setGameState(prev => {
        const newInventory = { ...prev.emojiInventory };
        if (newInventory[emojiId] > 0) {
            newInventory[emojiId] -= 1;
            if (newInventory[emojiId] === 0) delete newInventory[emojiId];
        }
        return { ...prev, emojiInventory: newInventory };
    });
  }, []);

  const toggleSound = useCallback(() => setGameState(prev => ({ ...prev, isSoundOn: !prev.isSoundOn })), []);
  const toggleMusic = useCallback(() => setGameState(prev => ({ ...prev, isMusicOn: !prev.isMusicOn })), []);
  const setSoundVolume = useCallback((volume: number) => setGameState(prev => ({...prev, soundVolume: volume})), []);
  const setMusicVolume = useCallback((volume: number) => setGameState(prev => ({...prev, musicVolume: volume})), []);
  const equipMusic = useCallback((musicUrl: string) => setGameState(prev => ({ ...prev, activeMusicUrl: musicUrl })), []);
  const clearRankNotification = useCallback(() => setRankNotification(null), []);
  
  // FIX: Add toggleShowThreats implementation.
  const toggleShowThreats = useCallback(() => {
    setGameState(prev => {
        const newShowThreats = !prev.showThreats;
        if (user) {
            onlineService.updateUserProfile(user.uid, { showThreats: newShowThreats });
        }
        return { ...prev, showThreats: newShowThreats };
    });
  }, [user]);

  const claimGift = useCallback(async (gift: LockerItem): Promise<{success: boolean, message: string}> => {
    if (!user) return { success: false, message: 'User not logged in' };
    
    const result = await onlineService.claimGift(user.uid, gift.id);
    
    if (result.success) {
        const cosmetic = ALL_COSMETICS.find(c => c.id === gift.cosmeticId);
        if (!cosmetic) {
            showToast(`Claimed an item from ${gift.fromName}.`, 'success');
            return result;
        }

        const isConsumable = cosmetic.type === 'emoji' || cosmetic.type === 'animated_emoji';
        const wasAlreadyOwned = !isConsumable && gameState.ownedCosmeticIds.includes(gift.cosmeticId);

        if (!wasAlreadyOwned) {
             setGameState(prev => {
                if (isConsumable) {
                    const newInventory = { ...prev.emojiInventory };
                    newInventory[cosmetic.id] = (newInventory[cosmetic.id] || 0) + 1;
                    return { ...prev, emojiInventory: newInventory };
                } else {
                    return {
                        ...prev,
                        ownedCosmeticIds: [...prev.ownedCosmeticIds, cosmetic.id],
                    };
                }
            });
        }
        
        if (wasAlreadyOwned) {
             showToast(`You already own ${cosmetic.name}. Gift claimed.`, 'success', gift.cosmeticId);
        } else {
            showToast(`You received ${cosmetic.name} from ${gift.fromName}!`, 'success', gift.cosmeticId);
        }

    } else {
         showToast(result.message, 'error');
    }

    return result;
}, [user, showToast, gameState.ownedCosmeticIds, gameState.emojiInventory]);

  const setNotifications = useCallback((action: React.SetStateAction<Notification[]>) => {
    setGameState(prev => {
        const newNotifications = typeof action === 'function' ? action(prev.notifications) : action;
        return { ...prev, notifications: newNotifications };
    });
  }, []);


  return (
    <GameStateContext.Provider value={{ 
        gameState, rankNotification, clearRankNotification, setPlayerName, applyGameResult, spendCoins, purchaseCosmetic, consumeEmoji, 
        equipTheme: (item) => equipCosmetic('theme', item),
        equipPiece: (item) => equipCosmetic('piece', item),
        equipAvatar: (item) => equipCosmetic('avatar', item),
        equipEffect: (item) => equipCosmetic('effect', item),
        equipVictoryEffect: (item) => equipCosmetic('victory', item),
        equipBoomEffect: (item) => equipCosmetic('boom', item),
        equipBoard: (item) => equipCosmetic('board', item),
        toggleSound, toggleMusic, setSoundVolume, setMusicVolume, equipMusic, claimGift, setStatusMessage,
        showToast,
        setNotifications,
        toggleShowThreats,
    }}>
      {children}
    </GameStateContext.Provider>
  );
};

export const useGameState = (): GameStateContextType => {
  const context = useContext(GameStateContext);
  if (!context) throw new Error('useGameState must be used within a GameStateProvider');
  return context;
};