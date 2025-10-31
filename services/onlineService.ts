import { auth, db, rtdb } from '../firebaseConfig';
import { onValue, ref, set, onDisconnect, serverTimestamp as rtdbServerTimestamp } from "firebase/database";
import { 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    setDoc, 
    updateDoc, 
    deleteDoc,
    writeBatch, 
    runTransaction, 
    onSnapshot, 
    query, 
    where, 
    limit, 
    orderBy,
    increment,
    arrayUnion,
    serverTimestamp as firestoreServerTimestamp,
    addDoc,
    arrayRemove
} from 'firebase/firestore';
import { type User } from 'firebase/auth';
import type { UserProfile, OnlinePlayer, BoardState, Player, Invitation, OnlineGame, BoardMap, Avatar, Emoji, MatchHistoryEntry, Friend, ChatMessage, LockerItem, Notification, Cosmetic, PurchaseHistoryEntry, GiftHistoryEntry, AnimatedEmoji, PveMatchHistoryEntry } from '../types';
import { DEFAULT_THEME, DEFAULT_PIECES_X, DEFAULT_AVATAR, DEFAULT_EFFECT, DEFAULT_VICTORY_EFFECT, DEFAULT_BOOM_EFFECT, ALL_COSMETICS, BOARD_SIZE, WINNING_LENGTH, EMOJIS, INITIAL_GAME_TIME, TURN_TIME, DEFAULT_BOARD_STYLE } from '../constants';

const DEFAULT_EMOJI_IDS = ALL_COSMETICS.filter(c => c.type === 'emoji' && c.price === 0).map(c => c.id);

// --- Timestamp Formatting ---
const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export const formatFullTimestamp = (timestamp: any): string => {
    if (!timestamp) return '';
    if (typeof timestamp === 'number') {
        return formatDate(new Date(timestamp));
    }
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        return formatDate(timestamp.toDate());
    }
    // Fallback for any other type
    try {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
            return formatDate(date);
        }
    } catch (e) {
        // ignore
    }
    return '';
}


// --- Board Conversion Utilities ---
export const boardToMap = (board: BoardState): BoardMap => {
    const map: BoardMap = {};
    for (let r = 0; r < board.length; r++) {
        for (let c = 0; c < board[r].length; c++) {
            if (board[r][c]) {
                map[`${r}_${c}`] = board[r][c] as Player;
            }
        }
    }
    return map;
};

export const mapToBoard = (map: BoardMap): BoardState => {
    const board: BoardState = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    for (const key in map) {
        const [r, c] = key.split('_').map(Number);
        board[r][c] = map[key];
    }
    return board;
};

export const getLastMove = (oldBoard: BoardState, newBoard: BoardState): { row: number, col: number } | null => {
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (oldBoard[r][c] === null && newBoard[r][c] !== null) {
                return { row: r, col: c };
            }
        }
    }
    return null;
};

const checkWin = (board: BoardState, player: Player): { row: number; col: number }[] | null => {
    const directions = [{ r: 0, c: 1 }, { r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: -1 }];
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === player) {
                for (const dir of directions) {
                    const line = [];
                    for (let i = 0; i < WINNING_LENGTH; i++) {
                        const newR = r + i * dir.r;
                        const newC = c + i * dir.c;
                        if (newR >= 0 && newR < BOARD_SIZE && newC >= 0 && newC < BOARD_SIZE && board[newR][newC] === player) {
                            line.push({ row: newR, col: newC });
                        } else {
                            break;
                        }
                    }
                    if (line.length === WINNING_LENGTH) return line;
                }
            }
        }
    }
    return null;
};

export const getOwnedEmojis = (ownedIds: string[], inventory: Record<string, number>): (Emoji | AnimatedEmoji)[] => {
    const ownedEmojiIds = new Set(ownedIds.filter(id => id.startsWith('emoji_') || id.startsWith('anim_emoji_')));
    for (const emojiId in inventory) {
        if (inventory[emojiId] > 0) {
            ownedEmojiIds.add(emojiId);
        }
    }
    return ALL_COSMETICS.filter(c => (c.type === 'emoji' || c.type === 'animated_emoji') && ownedEmojiIds.has(c.id)).map(c => c.item) as (Emoji | AnimatedEmoji)[];
};

export const getRandomEmoji = (): Emoji => {
    // Select from a subset of non-negative emojis to avoid AI being toxic
    const safeEmojis = EMOJIS.filter(e => !['😠', '😭', '💀', '🤡'].includes(e.emoji));
    return safeEmojis[Math.floor(Math.random() * safeEmojis.length)];
};

// --- User Profile Management ---
export const createUserProfile = async (user: User, name: string): Promise<void> => {
    console.log(`[createUserProfile] Called for UID: ${user.uid}. Auth displayName: "${user.displayName}", name param: "${name}"`);
    const userRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(userRef);

    // If profile already exists, handle race condition
    if (docSnap.exists()) {
        console.log(`[createUserProfile] Profile already exists. Checking for name update.`);
        const existingData = docSnap.data() as UserProfile;
        const newName = name.trim() || user.displayName; // Prioritize passed name

        if (existingData.name.startsWith('Player_') && newName && !newName.startsWith('Player_')) {
            console.log(`[createUserProfile] Correcting default name "${existingData.name}" to "${newName}".`);
            await updateDoc(userRef, { name: newName });
        } else {
            console.log(`[createUserProfile] Existing name "${existingData.name}" is not default. No action taken.`);
        }
        return; // IMPORTANT: Exit after handling existing doc
    }
    
    // Profile does not exist, create it.
    console.log(`[createUserProfile] Profile does not exist. Creating new one.`);

    let finalName = name.trim();
    if (user.isAnonymous) {
        let isTaken = await isDisplayNameTaken(finalName);
        let attempts = 0;
        while (isTaken && attempts < 10) {
            finalName = `Player_${Math.floor(1000 + Math.random() * 9000)}`;
            isTaken = await isDisplayNameTaken(finalName);
            attempts++;
        }
        if (isTaken) {
            finalName = `User_${user.uid.substring(0, 5)}`;
        }
    } else {
        // For new registered users, prioritize the passed name.
        // Fallback to auth display name, then generate one if all else fails.
        finalName = name.trim() || user.displayName || `Player_${Math.floor(1000 + Math.random() * 9000)}`;
    }
    
    console.log(`[createUserProfile] Final name for new profile: "${finalName}".`);
    
    const userProfile: UserProfile = {
        uid: user.uid,
        name: finalName,
        email: user.email,
        isAnonymous: user.isAnonymous,
        level: 1,
        xp: 0,
        coins: 500,
        cp: 0,
        onlineWins: 0,
        onlineLosses: 0,
        onlineDraws: 0,
        pveWins: 0,
        pveLosses: 0,
        pveDraws: 0,
        ownedCosmeticIds: [DEFAULT_THEME.id, DEFAULT_PIECES_X.id, DEFAULT_AVATAR.id, DEFAULT_EFFECT.id, DEFAULT_VICTORY_EFFECT.id, DEFAULT_BOOM_EFFECT.id, DEFAULT_BOARD_STYLE.id, ...DEFAULT_EMOJI_IDS],
        emojiInventory: {
            'emoji_wave': 10,
            'emoji_think': 10,
        },
        botStats: {},
        activeThemeId: DEFAULT_THEME.id,
        activePieceId: DEFAULT_PIECES_X.id,
        activeAvatarId: DEFAULT_AVATAR.id,
        activeEffectId: DEFAULT_EFFECT.id,
        activeVictoryEffectId: DEFAULT_VICTORY_EFFECT.id,
        activeBoomEffectId: DEFAULT_BOOM_EFFECT.id,
        activeBoardId: DEFAULT_BOARD_STYLE.id,
        statusMessage: "Available for a match!",
    };
    await setDoc(userRef, userProfile);
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
    const userRef = doc(db, 'users', uid);
    const docSnap = await getDoc(userRef);
    return docSnap.exists() ? (docSnap.data() as UserProfile) : null;
};

export const updateUserProfile = async (uid: string, data: Partial<UserProfile>): Promise<void> => {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, data, { merge: true });
};

export const updateProfileWithGameResult = async (
    uid: string,
    result: 'win' | 'loss' | 'draw',
    isPVE: boolean,
    coinsToAdd: number,
    newLevel: number,
    newXp: number,
    cpChange: number,
    gameId: string | null,
    opponentId?: string
) => {
    const userRef = doc(db, 'users', uid);

    try {
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) {
                throw "Document does not exist!";
            }

            const userData = userDoc.data() as UserProfile;

            // Idempotency Check
            if (gameId && Array.isArray(userData.processedGameIds) && userData.processedGameIds.includes(gameId)) {
                console.log(`[updateProfileWithGameResult] Game ${gameId} already processed. Skipping.`);
                return;
            }

            const updates: { [key: string]: any } = {
                level: newLevel,
                xp: newXp,
                coins: increment(coinsToAdd),
            };

            if (isPVE) {
                if (result === 'win') updates.pveWins = increment(1);
                else if (result === 'loss') updates.pveLosses = increment(1);
                else if (result === 'draw') updates.pveDraws = increment(1);
                
                if (opponentId) {
                    const statToUpdate = result === 'win' ? 'wins' : result === 'loss' ? 'losses' : 'draws';
                    // If bot stats object doesn't exist, we must create it. Otherwise, use atomic increment.
                    if (!userData.botStats || !userData.botStats[opponentId]) {
                         const newBotStats = { ...(userData.botStats || {}) };
                         newBotStats[opponentId] = { wins: 0, losses: 0, draws: 0 };
                         newBotStats[opponentId][statToUpdate] = 1;
                         updates.botStats = newBotStats;
                    } else {
                        updates[`botStats.${opponentId}.${statToUpdate}`] = increment(1);
                    }
                }
            } else { // Online
                if (result === 'win') updates.onlineWins = increment(1);
                else if (result === 'loss') updates.onlineLosses = increment(1);
                else if (result === 'draw') updates.onlineDraws = increment(1);
                
                if (cpChange !== 0) {
                    const currentCp = userData.cp || 0;
                    updates.cp = Math.max(0, currentCp + cpChange); // Can't use increment due to Math.max
                }
            }
            
            if (gameId) {
                updates.processedGameIds = arrayUnion(gameId); // Use arrayUnion for safer array updates
            }
            
            transaction.update(userRef, updates);
        });
    } catch (error) {
        console.error("Failed to update user profile after game:", error);
    }
};

export const updateAuthAndProfileName = async (user: User, name: string) => {
    await updateUserProfile(user.uid, { name });

    const onlineUserRef = doc(db, 'onlineUsers', user.uid);
    try {
        const onlineUserSnap = await getDoc(onlineUserRef);
        if (onlineUserSnap.exists()) {
            await updateDoc(onlineUserRef, { name });
        }
    } catch(e) {
        console.warn("Could not update online user name, document may not exist yet.");
    }
};

export const isDisplayNameTaken = async (name: string): Promise<boolean> => {
    const usersCol = collection(db, "users");
    const q = query(usersCol, where("name", "==", name.trim()), limit(1));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
};

export const updatePlayerName = async (user: User, newName: string): Promise<{ success: boolean, message: string }> => {
    const trimmedName = newName.trim();
    if (trimmedName.length < 3 || trimmedName.length > 15) {
        return { success: false, message: "Name must be 3-15 characters." };
    }
    const isTaken = await isDisplayNameTaken(trimmedName);
    if (isTaken) {
        return { success: false, message: "This name is already taken." };
    }
    try {
        await updateAuthAndProfileName(user, trimmedName);
        return { success: true, message: "Name updated successfully!" };
    } catch (error: any) {
        console.error("Error updating name:", error);
        return { success: false, message: error.message || "Failed to update name." };
    }
}

export const purchaseItemTransaction = async (uid: string, cosmetic: Cosmetic): Promise<{success: boolean, message: string}> => {
    const userRef = doc(db, 'users', uid);
    try {
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) {
                throw new Error("User profile not found.");
            }
            const userData = userDoc.data() as UserProfile;

            if (userData.coins < cosmetic.price) {
                throw new Error("Not enough coins.");
            }

            const isConsumable = cosmetic.type === 'emoji' || cosmetic.type === 'animated_emoji';

            if (!isConsumable && userData.ownedCosmeticIds.includes(cosmetic.id)) {
                throw new Error("Item already owned.");
            }
            
            const updates: { [key: string]: any } = {
                coins: userData.coins - cosmetic.price,
            };

            if (isConsumable) {
                const newInventory = { ...userData.emojiInventory };
                newInventory[cosmetic.id] = (newInventory[cosmetic.id] || 0) + 1;
                updates.emojiInventory = newInventory;
            } else {
                updates.ownedCosmeticIds = arrayUnion(cosmetic.id);
                // Also equip the item upon purchase
                switch (cosmetic.type) {
                    case 'theme': updates.activeThemeId = cosmetic.item.id; break;
                    case 'piece': updates.activePieceId = cosmetic.item.id; break;
                    case 'avatar': updates.activeAvatarId = cosmetic.item.id; break;
                    case 'effect': updates.activeEffectId = cosmetic.item.id; break;
                    case 'victory': updates.activeVictoryEffectId = cosmetic.item.id; break;
                    case 'boom': updates.activeBoomEffectId = cosmetic.item.id; break;
                    case 'board': updates.activeBoardId = cosmetic.item.id; break;
                }
            }

            transaction.update(userRef, updates);
            
            const historyRef = doc(collection(db, `users/${uid}/purchaseHistory`));
            transaction.set(historyRef, {
                cosmeticId: cosmetic.id,
                cosmeticName: cosmetic.name,
                price: cosmetic.price,
                timestamp: firestoreServerTimestamp()
            });
        });
        return { success: true, message: 'Purchase successful!' };
    } catch (error: any) {
        console.error("Purchase transaction failed: ", error);
        return { success: false, message: error.message || "Purchase failed." };
    }
};

// --- Presence System ---
export const setupPresenceSystem = async (user: User, level: number, avatarUrl: string, name: string, statusMessage?: string) => {
    const uid = user.uid;
    const userStatusDatabaseRef = ref(rtdb, `/status/${uid}`);
    const userStatusFirestoreRef = doc(db, 'onlineUsers', uid);

    const docSnap = await getDoc(userStatusFirestoreRef);
    const currentStatus = docSnap.exists() ? docSnap.data()?.status : 'idle';

    if (currentStatus === 'in_game' || currentStatus === 'in_queue') {
        onValue(ref(rtdb, '.info/connected'), (snapshot) => {
            if (snapshot.val() === false) return;
            onDisconnect(userStatusDatabaseRef).set({ state: 'offline', last_changed: rtdbServerTimestamp() }).then(() => {
                set(userStatusDatabaseRef, { state: 'online', last_changed: rtdbServerTimestamp() });
            });
        });
        console.log(`Presence system: User is '${currentStatus}'. Preserving status.`);
        return;
    }

    const isOnlineForDatabase = { state: 'online', last_changed: rtdbServerTimestamp() };
    const isOfflineForDatabase = { state: 'offline', last_changed: rtdbServerTimestamp() };

    onValue(ref(rtdb, '.info/connected'), (snapshot) => {
        if (snapshot.val() === false) {
            return;
        }

        onDisconnect(userStatusDatabaseRef).set(isOfflineForDatabase).then(async () => {
            await set(userStatusDatabaseRef, isOnlineForDatabase);
            const userProfile = await getUserProfile(uid);
            const isOnlineForFirestore: OnlinePlayer = { uid, name, level, avatarUrl, status: 'idle', cp: userProfile?.cp || 0, statusMessage: statusMessage || "Available for a match!" };
            await setDoc(userStatusFirestoreRef, isOnlineForFirestore);
            console.log("Presence system: User status set to 'idle'.");
        });
    });
};

export const updateStatusMessage = async (uid: string, message: string) => {
    const onlineUserRef = doc(db, 'onlineUsers', uid);
    const userProfileRef = doc(db, 'users', uid);
    try {
        await updateDoc(onlineUserRef, { statusMessage: message });
        await updateDoc(userProfileRef, { statusMessage: message });
    } catch (e) {
        console.warn("Could not update status message, user might be offline.", e);
    }
};


export const goOffline = async (uid: string) => {
    const userStatusFirestoreRef = doc(db, 'onlineUsers', uid);
    try {
        await deleteDoc(userStatusFirestoreRef);
    } catch(e) { console.error("Error deleting online user doc:", e); }

    const userStatusDatabaseRef = ref(rtdb, `/status/${uid}`);
    await set(userStatusDatabaseRef, {
        state: 'offline',
        last_changed: rtdbServerTimestamp(),
    });
};


// --- Lobby & Matchmaking ---
export const getOnlinePlayers = (callback: (players: OnlinePlayer[]) => void): (() => void) => {
    const onlineUsersCol = collection(db, "onlineUsers");
    const statusRef = ref(rtdb, 'status');

    let onlineUsers: OnlinePlayer[] = [];
    let onlineStatuses: { [uid: string]: { state: string, last_changed: any } } = {};
    let unsubFirestore: (() => void) | null = null;
    let unsubRtdb: (() => void) | null = null;
    
    // To prevent race conditions on initial load
    let firestoreLoaded = false;
    let rtdbLoaded = false;

    const updateAndCleanup = () => {
        // Wait for both listeners to fire at least once before processing
        if (!firestoreLoaded || !rtdbLoaded) return;

        const trulyOnlinePlayers: OnlinePlayer[] = [];
        const stalePlayerIds: string[] = [];

        onlineUsers.forEach(player => {
            const rtdbStatus = onlineStatuses[player.uid];
            // A user is considered online if they exist in Firestore and their RTDB status is 'online'.
            if (rtdbStatus && rtdbStatus.state === 'online') {
                trulyOnlinePlayers.push(player);
            } else {
                // If the user is in Firestore but their RTDB status is 'offline' or missing, they are stale.
                stalePlayerIds.push(player.uid);
            }
        });
        
        callback(trulyOnlinePlayers);
    };

    // Listener for Firestore's onlineUsers collection
    unsubFirestore = onSnapshot(onlineUsersCol, (snapshot) => {
        onlineUsers = snapshot.docs.map(doc => doc.data() as OnlinePlayer);
        firestoreLoaded = true;
        updateAndCleanup();
    }, (error) => console.error("Firestore listener error:", error));

    // Listener for RTDB's status node
    unsubRtdb = onValue(statusRef, (snapshot) => {
        onlineStatuses = snapshot.val() || {};
        rtdbLoaded = true;
        updateAndCleanup();
    }, (error) => console.error("RTDB listener error:", error));

    // Return a function to unsubscribe from both listeners
    return () => {
        if (unsubFirestore) unsubFirestore();
        if (unsubRtdb) unsubRtdb();
    };
};

export const getOnlineUser = async (uid: string): Promise<OnlinePlayer | null> => {
    const docRef = doc(db, 'onlineUsers', uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() as OnlinePlayer : null;
};

export const joinMatchmakingQueue = async (user: User): Promise<string | null> => {
    const q = query(collection(db, "matchmakingQueue"), where("uid", "!=", user.uid), limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        await setDoc(doc(db, "matchmakingQueue", user.uid), { uid: user.uid, joinedAt: firestoreServerTimestamp() });
        await updateDoc(doc(db, "onlineUsers", user.uid), { status: 'in_queue' });
        return null;
    } else {
        const opponentDoc = querySnapshot.docs[0];
        const opponentUid = opponentDoc.id;
        const gameId = await createOnlineGame(user.uid, opponentUid);
        const batch = writeBatch(db);
        batch.delete(doc(db, "matchmakingQueue", opponentDoc.id));
        batch.update(doc(db, "onlineUsers", user.uid), { status: 'in_game', gameId });
        batch.update(doc(db, "onlineUsers", opponentUid), { status: 'in_game', gameId });
        await batch.commit();
        return gameId;
    }
};

export const cancelMatchmaking = async (uid: string) => {
      if (!uid) return;
      try {
        await deleteDoc(doc(db, "matchmakingQueue", uid));
        await updateDoc(doc(db, "onlineUsers", uid), { status: 'idle' });
      } catch(e) {
        console.warn("Could not cancel matchmaking, user might have already found a game.");
      }
};

// --- Leaderboard & Match History ---
export const getLeaderboard = async (limitCount = 100): Promise<OnlinePlayer[]> => {
    const q = query(collection(db, "users"), orderBy("cp", "desc"), limit(limitCount));
    const querySnapshot = await getDocs(q);
    const leaderboardPlayers: OnlinePlayer[] = querySnapshot.docs.map(doc => {
        const user = doc.data() as UserProfile;
        return {
            uid: user.uid,
            name: user.name,
            level: user.level,
            avatarUrl: (ALL_COSMETICS.find(c => c.id === user.activeAvatarId)?.item as Avatar || DEFAULT_AVATAR).url,
            status: 'idle', // Status isn't relevant for a static leaderboard
            cp: user.cp
        };
    });
    return leaderboardPlayers;
};

export const recordMatchHistory = async (uid: string, gameId: string, entry: Omit<MatchHistoryEntry, 'id'>) => {
    const historyRef = doc(db, `users/${uid}/matchHistory`, gameId);
    await setDoc(historyRef, { id: gameId, ...entry });
};

export const getMatchHistory = async (uid: string): Promise<MatchHistoryEntry[]> => {
    const historyCol = collection(db, `users/${uid}/matchHistory`);
    const q = query(historyCol, orderBy("timestamp", "desc"), limit(10));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as MatchHistoryEntry);
};

export const recordPveMatchHistory = async (uid: string, entry: PveMatchHistoryEntry) => {
    const historyRef = doc(db, `users/${uid}/pveMatchHistory`, entry.id);
    await setDoc(historyRef, entry);
};

export const getPveMatchHistory = async (uid: string): Promise<PveMatchHistoryEntry[]> => {
    const historyCol = collection(db, `users/${uid}/pveMatchHistory`);
    const q = query(historyCol, orderBy("timestamp", "desc"), limit(50));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as PveMatchHistoryEntry);
};

// --- Invitations ---
export const sendInvitation = async (fromUser: User, fromName: string, toUid: string) => {
    const invitationRef = doc(db, 'invitations', toUid);
    await setDoc(invitationRef, {
        from: fromUser.uid,
        fromName: fromName,
        timestamp: Date.now(),
    });
};

export const listenForInvitations = (uid: string, callback: (invitation: Invitation | null) => void): (() => void) => {
    return onSnapshot(doc(db, 'invitations', uid), (doc) => {
        callback(doc.exists() ? doc.data() as Invitation : null);
    });
};

export const acceptInvitation = async (user: User, invitation: Invitation): Promise<string | null> => {
    const gameId = await createOnlineGame(user.uid, invitation.from);
    const batch = writeBatch(db);
    batch.update(doc(db, "onlineUsers", user.uid), { status: 'in_game', gameId });
    batch.update(doc(db, "onlineUsers", invitation.from), { status: 'in_game', gameId });
    batch.delete(doc(db, "invitations", user.uid));
    await batch.commit();
    return gameId;
};

export const declineInvitation = async (uid: string) => {
    await deleteDoc(doc(db, "invitations", uid));
};

// --- Game Logic ---
export const createOnlineGame = async (player1Uid: string, player2Uid: string): Promise<string> => {
    const gameId = `game_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const gameRef = doc(db, 'games', gameId);

    const [p1Profile, p2Profile] = await Promise.all([
        getUserProfile(player1Uid),
        getUserProfile(player2Uid)
    ]);

    // Randomize who goes first to ensure fairness.
    const players = Math.random() < 0.5 
        ? { X: player1Uid, O: player2Uid } 
        : { X: player2Uid, O: player1Uid };

    const gameData: OnlineGame = {
        id: gameId,
        players: players,
        playerDetails: {
            [player1Uid]: { 
                name: p1Profile?.name || 'Player 1', 
                avatarUrl: (p1Profile?.activeAvatarId ? ALL_COSMETICS.find(c => c.id === p1Profile.activeAvatarId)?.item as Avatar : DEFAULT_AVATAR).url, 
                level: p1Profile?.level || 1,
                pieceId: p1Profile?.activePieceId || DEFAULT_PIECES_X.id,
                cp: p1Profile?.cp || 0,
            },
            [player2Uid]: { 
                name: p2Profile?.name || 'Player 2', 
                avatarUrl: (p2Profile?.activeAvatarId ? ALL_COSMETICS.find(c => c.id === p2Profile.activeAvatarId)?.item as Avatar : DEFAULT_AVATAR).url, 
                level: p2Profile?.level || 1,
                pieceId: p2Profile?.activePieceId || DEFAULT_PIECES_X.id,
                cp: p2Profile?.cp || 0,
            },
        },
        board: {},
        currentPlayer: 'X',
        status: 'in_progress',
        winner: null,
        winningLine: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        playerTimes: { X: INITIAL_GAME_TIME, O: INITIAL_GAME_TIME },
        turnStartedAt: Date.now(),
        chatId: gameId,
    };
    await setDoc(gameRef, gameData);
    return gameId;
};

export const sendOnlineEmote = async (gameId: string, uid: string, emoji: string) => {
    const gameRef = doc(db, 'games', gameId);
    try {
        await updateDoc(gameRef, {
            emotes: { uid, emoji, timestamp: Date.now() }
        });
    } catch (error) { console.error("Failed to send emote:", error); }
};

export const getOnlineGame = async (gameId: string): Promise<OnlineGame | null> => {
    const docRef = doc(db, 'games', gameId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() as OnlineGame : null;
};

export const listenForGameStart = (uid: string, callback: (playerData: OnlinePlayer | null) => void): (() => void) => {
    return onSnapshot(doc(db, 'onlineUsers', uid), (doc) => {
        callback(doc.exists() ? doc.data() as OnlinePlayer : null);
    });
};

export const getOnlineGameStream = (gameId: string, callback: (game: OnlineGame | null) => void): (() => void) => {
    return onSnapshot(doc(db, 'games', gameId), (docSnap) => {
        callback(docSnap.exists() ? docSnap.data() as OnlineGame : null);
    });
};

export const makeOnlineMove = async (gameId: string, row: number, col: number, player: Player) => {
    const gameRef = doc(db, 'games', gameId);
    try {
        await runTransaction(db, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists()) return;

            const gameData = gameDoc.data() as OnlineGame;
            if (gameData.status !== 'in_progress' || gameData.currentPlayer !== player) return;
            
            const currentBoard = mapToBoard(gameData.board);
            if (currentBoard[row][col] !== null) return;
            currentBoard[row][col] = player;

            const timeElapsed = Math.round((Date.now() - gameData.turnStartedAt) / 1000);
            const newPlayerTimes = { ...gameData.playerTimes };
            newPlayerTimes[player] = Math.max(0, newPlayerTimes[player] - timeElapsed);

            const winningLine = checkWin(currentBoard, player);
            const isDraw = currentBoard.every(r => r.every(c => c !== null)) && !winningLine;

            const updateData: any = {
                board: boardToMap(currentBoard),
                currentPlayer: player === 'X' ? 'O' : 'X',
                updatedAt: Date.now(),
                status: (winningLine || isDraw) ? 'finished' : 'in_progress',
                winner: winningLine ? player : isDraw ? 'draw' : null,
                winningLine: winningLine || null,
                playerTimes: newPlayerTimes,
                turnStartedAt: Date.now(),
            };

            transaction.update(gameRef, updateData);
        });
    } catch (error) {
        console.error("Make move transaction failed:", error);
    }
};

export const claimTimeoutVictory = async (gameId: string, claimant: Player) => {
    const gameRef = doc(db, 'games', gameId);
    try {
        await runTransaction(db, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists() || gameDoc.data()?.status !== 'in_progress') return;
            
            const gameData = gameDoc.data() as OnlineGame;
            if (gameData.currentPlayer !== claimant) {
                const timeSinceLastMove = (Date.now() - gameData.turnStartedAt) / 1000;
                const totalTimeLeft = gameData.playerTimes[gameData.currentPlayer] - timeSinceLastMove;
                if (totalTimeLeft < 0) {
                    console.log(`Player ${claimant} is claiming a timeout victory.`);
                    transaction.update(gameRef, {
                        status: 'finished',
                        winner: claimant,
                    });
                }
            }
        });
    } catch (e) { console.error("Error claiming timeout victory:", e); }
};

export const updatePlayerPieceSkin = async (gameId: string, uid: string, pieceId: string) => {
    const gameRef = doc(db, 'games', gameId);
    try {
        await updateDoc(gameRef, { [`playerDetails.${uid}.pieceId`]: pieceId });
    } catch (error) {
        console.log("Could not update piece skin (game may be over):", error);
    }
};

export const resignOnlineGame = async (gameId: string, resigningPlayer: Player) => {
    const gameRef = doc(db, 'games', gameId);
    try {
        await runTransaction(db, async (transaction) => {
            const gameDoc = await transaction.get(gameRef);
            if (!gameDoc.exists() || gameDoc.data()?.status !== 'in_progress') {
                return; // Game already over or doesn't exist
            }
            transaction.update(gameRef, {
                status: 'finished',
                winner: resigningPlayer === 'X' ? 'O' : 'X',
            });
        });
    } catch (e) {
        console.error("Resignation transaction failed: ", e);
    }
};

export const returnToLobby = async (uid: string) => {
    const userStatusRef = doc(db, 'onlineUsers', uid);
    try {
        const docSnap = await getDoc(userStatusRef);
        if (docSnap.exists()) {
            await updateDoc(userStatusRef, { status: 'idle', gameId: null });
        }
    } catch (e) {
        console.error("Failed to return user to lobby:", e);
    }
};

export const leaveOnlineGame = async (gameId: string, uid: string) => {
    await returnToLobby(uid);
};

export const cleanupOldGames = async (): Promise<void> => {
    const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
    
    const finishedGamesQuery = query(collection(db, 'games'), 
        where('status', '==', 'finished'), 
        where('updatedAt', '<', thirtyMinutesAgo)
    );

    const inactiveGamesQuery = query(collection(db, 'games'),
        where('status', '==', 'in_progress'),
        where('updatedAt', '<', thirtyMinutesAgo)
    );

    try {
        const [finishedGamesSnapshot, inactiveGamesSnapshot] = await Promise.all([
            getDocs(finishedGamesQuery),
            getDocs(inactiveGamesQuery)
        ]);

        if (finishedGamesSnapshot.empty && inactiveGamesSnapshot.empty) {
            return;
        }
        
        const batch = writeBatch(db);
        let count = 0;

        finishedGamesSnapshot.forEach(doc => {
            batch.delete(doc.ref);
            count++;
        });

        inactiveGamesSnapshot.forEach(doc => {
            batch.delete(doc.ref);
            count++;
        });

        if (count > 0) {
            await batch.commit();
            console.log(`Cleaned up ${count} old/inactive games.`);
        }

    } catch (error) {
        console.error("Error cleaning up old games:", error);
    }
};

// --- Chat ---
export const getChatId = (id1: string, id2: string): string => {
    return [id1, id2].sort().join('_');
};

export const sendMessage = async (chatId: string, senderId: string, senderName: string, text: string): Promise<void> => {
    const messagesCol = collection(db, `chats/${chatId}/messages`);
    const messageDocRef = await addDoc(messagesCol, {
        senderId,
        text,
        timestamp: firestoreServerTimestamp()
    });

    // Also create a notification for the recipient
    const recipientId = chatId.split('_').find(id => id !== senderId);
    if (recipientId) {
        let notificationText = text;
        if (text.startsWith('REACT:')) {
            const [, emoji] = text.split(':');
            if (emoji) {
                notificationText = `reacted with ${emoji}`;
            } else {
                 return; // Don't notify for invalid reactions
            }
        }
        
        const notificationRef = doc(db, `users/${recipientId}/notifications`, messageDocRef.id);
        await setDoc(notificationRef, {
             type: 'message',
             text: notificationText,
             senderId,
             senderName,
             timestamp: firestoreServerTimestamp(),
             seen: false
        });
    }
};

export const listenForMessages = (chatId: string, callback: (messages: ChatMessage[]) => void): (() => void) => {
    const messagesCol = collection(db, `chats/${chatId}/messages`);
    const q = query(messagesCol, orderBy("timestamp", "desc"), limit(100));
    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
        callback(messages.reverse());
    });
};

export const listenForNewMessages = (chatId: string, currentUserId: string, callback: (message: ChatMessage) => void): (() => void) => {
    const messagesCol = collection(db, `chats/${chatId}/messages`);
    const q = query(messagesCol, orderBy("timestamp", "desc"), limit(1));
    
    let isFirstLoad = true;
    
    return onSnapshot(q, (snapshot) => {
        if (isFirstLoad) {
            isFirstLoad = false;
            return;
        }

        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const message = { id: change.doc.id, ...change.doc.data() } as ChatMessage;
                if (message.senderId !== currentUserId) {
                    callback(message);
                }
            }
        });
    });
};

// --- Notifications ---
export const listenForNotifications = (uid: string, callback: (notifications: Notification[]) => void): (() => void) => {
    const notificationsCol = collection(db, `users/${uid}/notifications`);
    const q = query(notificationsCol, orderBy("timestamp", "desc"), limit(50));
    
    return onSnapshot(q, (snapshot) => {
        const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
        callback(notifs);
    });
};

export const markNotificationAsSeen = async (uid: string, notificationId: string): Promise<void> => {
    const notifRef = doc(db, `users/${uid}/notifications`, notificationId);
    await updateDoc(notifRef, { seen: true });
};

export const deleteNotification = async (uid: string, notificationId: string): Promise<void> => {
    const notifRef = doc(db, `users/${uid}/notifications`, notificationId);
    await deleteDoc(notifRef);
};


// --- Friends ---
export const respondToFriendRequest = async (uid: string, friendUid: string, response: 'accept' | 'decline') => {
    const userFriendRef = doc(db, `users/${uid}/friends`, friendUid);
    const friendUserRef = doc(db, `users/${friendUid}/friends`, uid);
    
    const batch = writeBatch(db);

    if (response === 'accept') {
        batch.update(userFriendRef, { status: 'friends' });
        batch.update(friendUserRef, { status: 'friends' });
    } else { // decline
        batch.delete(userFriendRef);
        batch.delete(friendUserRef);
    }
    await batch.commit();
};

export const removeFriend = async (uid: string, friendUid: string) => {
    const batch = writeBatch(db);
    batch.delete(doc(db, `users/${uid}/friends`, friendUid));
    batch.delete(doc(db, `users/${friendUid}/friends`, uid));
    await batch.commit();
};

export const listenForFriends = (uid: string, callback: (friends: Friend[]) => void): (() => void) => {
    const friendsCol = collection(db, `users/${uid}/friends`);
    return onSnapshot(friendsCol, (snapshot) => {
        const friendsData = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as Friend));
        callback(friendsData);
    });
};

export const getLocker = async (uid: string): Promise<LockerItem[]> => {
    const lockerCol = collection(db, `users/${uid}/locker`);
    const q = query(lockerCol, where("isClaimed", "==", false));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LockerItem));
};

export const listenForLocker = (uid: string, callback: (items: LockerItem[]) => void): (() => void) => {
    const lockerCol = collection(db, `users/${uid}/locker`);
    const q = query(lockerCol, orderBy("receivedAt", "desc"));
    return onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LockerItem));
        callback(items);
    });
};

export const sendFriendRequest = async (fromUid: string, toUid: string) => {
    const fromProfile = await getUserProfile(fromUid);
    const toProfile = await getUserProfile(toUid);

    if (!fromProfile || !toProfile) {
        console.error("Could not find user profile for friend request.");
        return;
    }

    const batch = writeBatch(db);
    const fromFriendRef = doc(db, `users/${fromUid}/friends`, toUid);
    const toFriendRef = doc(db, `users/${toUid}/friends`, fromUid);

    const friendDataForSender: Omit<Friend, 'onlineStatus'> = {
        uid: toUid,
        name: toProfile.name,
        avatarUrl: (ALL_COSMETICS.find(c => c.id === toProfile.activeAvatarId)?.item as Avatar || DEFAULT_AVATAR).url,
        level: toProfile.level,
        status: 'pending'
    };
     const friendDataForReceiver: Omit<Friend, 'onlineStatus'> = {
        uid: fromUid,
        name: fromProfile.name,
        avatarUrl: (ALL_COSMETICS.find(c => c.id === fromProfile.activeAvatarId)?.item as Avatar || DEFAULT_AVATAR).url,
        level: fromProfile.level,
        status: 'received'
    };

    batch.set(fromFriendRef, friendDataForSender);
    batch.set(toFriendRef, friendDataForReceiver);
    
    // Create a notification for the recipient
    const notificationRef = doc(collection(db, `users/${toUid}/notifications`));
    batch.set(notificationRef, {
        type: 'friend_request',
        text: `sent you a friend request.`,
        senderId: fromUid,
        senderName: fromProfile.name,
        timestamp: firestoreServerTimestamp(),
        seen: false
    });

    await batch.commit();
};

export const sendGift = async (fromUid: string, fromName: string, toUid: string, cosmeticId: string) => {
    const cosmetic = ALL_COSMETICS.find(c => c.id === cosmeticId);
    if (!cosmetic) throw new Error(`Cosmetic with id ${cosmeticId} not found!`);

    const recipientRef = doc(db, 'users', toUid);

    await runTransaction(db, async (transaction) => {
        const recipientDoc = await transaction.get(recipientRef);
        if (!recipientDoc.exists()) throw new Error("Recipient user not found.");
        
        const recipientProfile = recipientDoc.data() as UserProfile;
        const isConsumable = cosmetic.type === 'emoji' || cosmetic.type === 'animated_emoji';

        if (!isConsumable) {
            if (recipientProfile.ownedCosmeticIds.includes(cosmeticId)) {
                throw new Error("Recipient already owns this item.");
            }
            if (recipientProfile.pendingGiftIds?.includes(cosmeticId)) {
                throw new Error("Recipient has this gift pending claim.");
            }
        }

        const lockerRef = doc(collection(db, `users/${toUid}/locker`));
        transaction.set(lockerRef, {
            cosmeticId, fromUid, fromName,
            receivedAt: firestoreServerTimestamp(),
            isClaimed: false
        });

        if (!isConsumable) {
            transaction.update(recipientRef, {
                pendingGiftIds: arrayUnion(cosmeticId)
            });
        }

        const notificationRef = doc(collection(db, `users/${toUid}/notifications`));
        transaction.set(notificationRef, {
            type: 'gift', text: `sent you a gift: ${cosmetic.name}!`,
            senderId: fromUid, senderName: fromName,
            timestamp: firestoreServerTimestamp(), seen: false, cosmeticId: cosmeticId,
        });
    });
};

export const claimGift = async (uid: string, giftId: string): Promise<{success: boolean, message: string}> => {
    const giftRef = doc(db, `users/${uid}/locker`, giftId);
    const userRef = doc(db, `users`, uid);

    try {
        await runTransaction(db, async (transaction) => {
            const giftDoc = await transaction.get(giftRef);
            const userDoc = await transaction.get(userRef);

            if (!giftDoc.exists() || !userDoc.exists()) throw "Gift or user does not exist!";
            
            const giftData = giftDoc.data() as LockerItem;
            if (giftData.isClaimed) return; // Already claimed, do nothing.

            const cosmetic = ALL_COSMETICS.find(c => c.id === giftData.cosmeticId);
            if (!cosmetic) throw `Cosmetic with id ${giftData.cosmeticId} not found!`;

            const userData = userDoc.data() as UserProfile;
            const isOwned = userData.ownedCosmeticIds.includes(cosmetic.id);
            const isConsumable = cosmetic.type === 'emoji' || cosmetic.type === 'animated_emoji';

            if (!isOwned || isConsumable) {
                // Add the item to the user's inventory
                if (isConsumable) {
                    const newInventory = { ...userData.emojiInventory };
                    newInventory[cosmetic.id] = (newInventory[cosmetic.id] || 0) + 1;
                    transaction.update(userRef, { emojiInventory: newInventory });
                } else {
                    transaction.update(userRef, { ownedCosmeticIds: [...userData.ownedCosmeticIds, cosmetic.id] });
                }
            } 
            // If item is already owned and not consumable, do nothing with inventory.
            
            // Mark the gift as claimed
            transaction.update(giftRef, { isClaimed: true });

            if (!isConsumable) {
                transaction.update(userRef, {
                    pendingGiftIds: arrayRemove(cosmetic.id)
                });
            }
        });
        return { success: true, message: 'Gift claimed!' };
    } catch (e) {
        console.error("Gift claim transaction failed: ", e);
        return { success: false, message: `Error: ${e}` };
    }
};

export const recordPurchase = async (uid: string, cosmetic: Cosmetic) => {
    const historyCol = collection(db, `users/${uid}/purchaseHistory`);
    await addDoc(historyCol, {
        cosmeticId: cosmetic.id,
        cosmeticName: cosmetic.name,
        price: cosmetic.price,
        timestamp: firestoreServerTimestamp()
    });
};

export const getPurchaseHistory = async (uid: string): Promise<PurchaseHistoryEntry[]> => {
    const historyCol = collection(db, `users/${uid}/purchaseHistory`);
    const q = query(historyCol, orderBy("timestamp", "desc"), limit(50));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseHistoryEntry));
};

export const recordGiftSent = async (uid: string, recipientId: string, recipientName: string, cosmetic: Cosmetic) => {
    const historyCol = collection(db, `users/${uid}/giftHistory`);
    await addDoc(historyCol, {
        cosmeticId: cosmetic.id,
        cosmeticName: cosmetic.name,
        recipientId,
        recipientName,
        timestamp: firestoreServerTimestamp()
    });
};

export const getGiftHistory = async (uid: string): Promise<GiftHistoryEntry[]> => {
    const historyCol = collection(db, `users/${uid}/giftHistory`);
    const q = query(historyCol, orderBy("timestamp", "desc"), limit(50));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GiftHistoryEntry));
};