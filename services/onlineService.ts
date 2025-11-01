import firebase from 'firebase/compat/app';
import 'firebase/compat/database';
import 'firebase/compat/firestore';
import { auth, db, rtdb } from '../firebaseConfig';
import { type User } from 'firebase/auth';
import type {
  UserProfile,
  OnlinePlayer,
  BoardState,
  Player,
  Invitation,
  OnlineGame,
  BoardMap,
  Avatar,
  Emoji,
  MatchHistoryEntry,
  Friend,
  ChatMessage,
  LockerItem,
  Notification,
  Cosmetic,
  PurchaseHistoryEntry,
  GiftHistoryEntry,
  AnimatedEmoji,
  PveMatchHistoryEntry,
} from '../types';
import {
  DEFAULT_THEME,
  DEFAULT_PIECES_X,
  DEFAULT_AVATAR,
  DEFAULT_EFFECT,
  DEFAULT_VICTORY_EFFECT,
  DEFAULT_BOOM_EFFECT,
  ALL_COSMETICS,
  BOARD_SIZE,
  WINNING_LENGTH,
  EMOJIS,
  INITIAL_GAME_TIME,
  TURN_TIME,
  DEFAULT_BOARD_STYLE,
} from '../constants';

const DEFAULT_EMOJI_IDS = ALL_COSMETICS.filter(
  (c) => c.type === 'emoji' && c.price === 0
).map((c) => c.id);

// --- Timestamp Formatting ---
const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

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
};

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
  const board: BoardState = Array(BOARD_SIZE)
    .fill(null)
    .map(() => Array(BOARD_SIZE).fill(null));
  for (const key in map) {
    const [r, c] = key.split('_').map(Number);
    board[r][c] = map[key];
  }
  return board;
};

export const getLastMove = (
  oldBoard: BoardState,
  newBoard: BoardState
): { row: number; col: number } | null => {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (oldBoard[r][c] === null && newBoard[r][c] !== null) {
        return { row: r, col: c };
      }
    }
  }
  return null;
};

const checkWin = (
  board: BoardState,
  player: Player
): { row: number; col: number }[] | null => {
  const directions = [
    { r: 0, c: 1 },
    { r: 1, c: 0 },
    { r: 1, c: 1 },
    { r: 1, c: -1 },
  ];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === player) {
        for (const dir of directions) {
          const line = [];
          for (let i = 0; i < WINNING_LENGTH; i++) {
            const newR = r + i * dir.r;
            const newC = c + i * dir.c;
            if (
              newR >= 0 &&
              newR < BOARD_SIZE &&
              newC >= 0 &&
              newC < BOARD_SIZE &&
              board[newR][newC] === player
            ) {
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

export const getOwnedEmojis = (
  ownedIds: string[],
  inventory: Record<string, number>
): (Emoji | AnimatedEmoji)[] => {
  const ownedEmojiIds = new Set(
    ownedIds.filter(
      (id) => id.startsWith('emoji_') || id.startsWith('anim_emoji_')
    )
  );
  for (const emojiId in inventory) {
    if (inventory[emojiId] > 0) {
      ownedEmojiIds.add(emojiId);
    }
  }
  return ALL_COSMETICS.filter(
    (c) =>
      (c.type === 'emoji' || c.type === 'animated_emoji') &&
      ownedEmojiIds.has(c.id)
  ).map((c) => c.item) as (Emoji | AnimatedEmoji)[];
};

export const getRandomEmoji = (): Emoji => {
  // Select from a subset of non-negative emojis to avoid AI being toxic
  const safeEmojis = EMOJIS.filter(
    (e) => !['😠', '😭', '💀', '🤡'].includes(e.emoji)
  );
  return safeEmojis[Math.floor(Math.random() * safeEmojis.length)];
};

// --- User Profile Management ---
export const createUserProfile = async (
  user: User,
  name: string
): Promise<void> => {
  console.log(
    `[createUserProfile] Called for UID: ${user.uid}. Auth displayName: "${user.displayName}", name param: "${name}"`
  );
  const userRef = db.collection('users').doc(user.uid);
  const docSnap = await userRef.get();

  // If profile already exists, handle race condition
  if (docSnap.exists) {
    console.log(
      `[createUserProfile] Profile already exists. Checking for name update.`
    );
    const existingData = docSnap.data() as UserProfile;
    const newName = name.trim() || user.displayName; // Prioritize passed name

    if (
      existingData.name.startsWith('Player_') &&
      newName &&
      !newName.startsWith('Player_')
    ) {
      console.log(
        `[createUserProfile] Correcting default name "${existingData.name}" to "${newName}".`
      );
      await userRef.update({ name: newName });
    } else {
      console.log(
        `[createUserProfile] Existing name "${existingData.name}" is not default. No action taken.`
      );
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
    finalName =
      name.trim() ||
      user.displayName ||
      `Player_${Math.floor(1000 + Math.random() * 9000)}`;
  }

  console.log(
    `[createUserProfile] Final name for new profile: "${finalName}".`
  );

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
    ownedCosmeticIds: [
      DEFAULT_THEME.id,
      DEFAULT_PIECES_X.id,
      DEFAULT_AVATAR.id,
      DEFAULT_EFFECT.id,
      DEFAULT_VICTORY_EFFECT.id,
      DEFAULT_BOOM_EFFECT.id,
      DEFAULT_BOARD_STYLE.id,
      ...DEFAULT_EMOJI_IDS,
    ],
    emojiInventory: {
      emoji_wave: 10,
      emoji_think: 10,
    },
    botStats: {},
    activeThemeId: DEFAULT_THEME.id,
    activePieceId: DEFAULT_PIECES_X.id,
    activeAvatarId: DEFAULT_AVATAR.id,
    activeEffectId: DEFAULT_EFFECT.id,
    activeVictoryEffectId: DEFAULT_VICTORY_EFFECT.id,
    activeBoomEffectId: DEFAULT_BOOM_EFFECT.id,
    activeBoardId: DEFAULT_BOARD_STYLE.id,
    statusMessage: 'Available for a match!',
    showThreats: false,
  };
  await userRef.set(userProfile);
};

export const getUserProfile = async (
  uid: string
): Promise<UserProfile | null> => {
  const userRef = db.collection('users').doc(uid);
  const docSnap = await userRef.get();
  return docSnap.exists ? (docSnap.data() as UserProfile) : null;
};

export const updateUserProfile = async (
  uid: string,
  data: Partial<UserProfile>
): Promise<void> => {
  const userRef = db.collection('users').doc(uid);
  await userRef.set(data, { merge: true });
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
  const userRef = db.collection('users').doc(uid);

  try {
    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw 'Document does not exist!';
      }

      const userData = userDoc.data() as UserProfile;

      // Idempotency Check
      if (
        gameId &&
        Array.isArray(userData.processedGameIds) &&
        userData.processedGameIds.includes(gameId)
      ) {
        console.log(
          `[updateProfileWithGameResult] Game ${gameId} already processed. Skipping.`
        );
        return;
      }

      const updates: { [key: string]: any } = {
        level: newLevel,
        xp: newXp,
        coins: firebase.firestore.FieldValue.increment(coinsToAdd),
      };

      if (isPVE) {
        if (result === 'win')
          updates.pveWins = firebase.firestore.FieldValue.increment(1);
        else if (result === 'loss')
          updates.pveLosses = firebase.firestore.FieldValue.increment(1);
        else if (result === 'draw')
          updates.pveDraws = firebase.firestore.FieldValue.increment(1);

        if (opponentId) {
          const statToUpdate =
            result === 'win' ? 'wins' : result === 'loss' ? 'losses' : 'draws';
          // If bot stats object doesn't exist, we must create it. Otherwise, use atomic increment.
          if (!userData.botStats || !userData.botStats[opponentId]) {
            const newBotStats = { ...(userData.botStats || {}) };
            newBotStats[opponentId] = { wins: 0, losses: 0, draws: 0 };
            newBotStats[opponentId][statToUpdate] = 1;
            updates.botStats = newBotStats;
          } else {
            updates[`botStats.${opponentId}.${statToUpdate}`] =
              firebase.firestore.FieldValue.increment(1);
          }
        }
      } else {
        // Online
        if (result === 'win')
          updates.onlineWins = firebase.firestore.FieldValue.increment(1);
        else if (result === 'loss')
          updates.onlineLosses = firebase.firestore.FieldValue.increment(1);
        else if (result === 'draw')
          updates.onlineDraws = firebase.firestore.FieldValue.increment(1);

        if (cpChange !== 0) {
          const currentCp = userData.cp || 0;
          updates.cp = Math.max(0, currentCp + cpChange); // Can't use increment due to Math.max
        }
      }

      if (gameId) {
        updates.processedGameIds =
          firebase.firestore.FieldValue.arrayUnion(gameId); // Use arrayUnion for safer array updates
      }

      transaction.update(userRef, updates);
    });
  } catch (error) {
    console.error('Failed to update user profile after game:', error);
  }
};

export const updateAuthAndProfileName = async (user: User, name: string) => {
  await updateUserProfile(user.uid, { name });

  const onlineUserRef = db.collection('onlineUsers').doc(user.uid);
  try {
    const onlineUserSnap = await onlineUserRef.get();
    if (onlineUserSnap.exists) {
      await onlineUserRef.update({ name });
    }
  } catch (e) {
    console.warn(
      'Could not update online user name, document may not exist yet.'
    );
  }
};

export const isDisplayNameTaken = async (name: string): Promise<boolean> => {
  const usersCol = db.collection('users');
  const q = usersCol.where('name', '==', name.trim()).limit(1);
  const querySnapshot = await q.get();
  // FIX: `empty` is a boolean property, not a method.
  return !querySnapshot.empty;
};

export const updatePlayerName = async (
  user: User,
  newName: string
): Promise<{ success: boolean; message: string }> => {
  const trimmedName = newName.trim();
  if (trimmedName.length < 3 || trimmedName.length > 15) {
    return { success: false, message: 'Name must be 3-15 characters.' };
  }
  const isTaken = await isDisplayNameTaken(trimmedName);
  if (isTaken) {
    return { success: false, message: 'This name is already taken.' };
  }
  try {
    await updateAuthAndProfileName(user, trimmedName);
    return { success: true, message: 'Name updated successfully!' };
  } catch (error: any) {
    console.error('Error updating name:', error);
    return {
      success: false,
      message: error.message || 'Failed to update name.',
    };
  }
};

export const purchaseItemTransaction = async (
  uid: string,
  cosmetic: Cosmetic
): Promise<{ success: boolean; message: string }> => {
  const userRef = db.collection('users').doc(uid);
  try {
    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      // FIX: `exists` is a boolean property, not a method.
      if (!userDoc.exists) {
        throw new Error('User profile not found.');
      }
      const userData = userDoc.data() as UserProfile;

      if (userData.coins < cosmetic.price) {
        throw new Error('Not enough coins.');
      }

      const isConsumable =
        cosmetic.type === 'emoji' || cosmetic.type === 'animated_emoji';

      if (!isConsumable && userData.ownedCosmeticIds.includes(cosmetic.id)) {
        throw new Error('Item already owned.');
      }

      const updates: { [key: string]: any } = {
        coins: userData.coins - cosmetic.price,
      };

      if (isConsumable) {
        const newInventory = { ...userData.emojiInventory };
        newInventory[cosmetic.id] = (newInventory[cosmetic.id] || 0) + 1;
        updates.emojiInventory = newInventory;
      } else {
        updates.ownedCosmeticIds = firebase.firestore.FieldValue.arrayUnion(
          cosmetic.id
        );
        // Also equip the item upon purchase
        switch (cosmetic.type) {
          case 'theme':
            updates.activeThemeId = cosmetic.item.id;
            break;
          case 'piece':
            updates.activePieceId = cosmetic.item.id;
            break;
          case 'avatar':
            updates.activeAvatarId = cosmetic.item.id;
            break;
          case 'effect':
            updates.activeEffectId = cosmetic.item.id;
            break;
          case 'victory':
            updates.activeVictoryEffectId = cosmetic.item.id;
            break;
          case 'boom':
            updates.activeBoomEffectId = cosmetic.item.id;
            break;
          case 'board':
            updates.activeBoardId = cosmetic.item.id;
            break;
        }
      }

      transaction.update(userRef, updates);

      const historyRef = db.collection(`users/${uid}/purchaseHistory`).doc();
      transaction.set(historyRef, {
        cosmeticId: cosmetic.id,
        cosmeticName: cosmetic.name,
        price: cosmetic.price,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
    return { success: true, message: 'Purchase successful!' };
  } catch (error: any) {
    console.error('Purchase transaction failed: ', error);
    return { success: false, message: error.message || 'Purchase failed.' };
  }
};

// --- Presence System ---
export const setupPresenceSystem = async (
  user: User,
  level: number,
  avatarUrl: string,
  name: string,
  statusMessage?: string
) => {
  const uid = user.uid;
  const userStatusDatabaseRef = rtdb.ref(`/status/${uid}`);
  const userStatusFirestoreRef = db.collection('onlineUsers').doc(uid);

  const docSnap = await userStatusFirestoreRef.get();
  const currentStatus = docSnap.exists ? docSnap.data()?.status : 'idle';

  if (currentStatus === 'in_game' || currentStatus === 'in_queue') {
    rtdb.ref('.info/connected').on('value', (snapshot) => {
      if (snapshot.val() === false) return;
      userStatusDatabaseRef
        .onDisconnect()
        .set({
          state: 'offline',
          last_changed: firebase.database.ServerValue.TIMESTAMP,
        })
        .then(() => {
          userStatusDatabaseRef.set({
            state: 'online',
            last_changed: firebase.database.ServerValue.TIMESTAMP,
          });
        });
    });
    console.log(
      `Presence system: User is '${currentStatus}'. Preserving status.`
    );
    return;
  }

  const isOnlineForDatabase = {
    state: 'online',
    last_changed: firebase.database.ServerValue.TIMESTAMP,
  };
  const isOfflineForDatabase = {
    state: 'offline',
    last_changed: firebase.database.ServerValue.TIMESTAMP,
  };

  rtdb.ref('.info/connected').on('value', (snapshot) => {
    if (snapshot.val() === false) {
      return;
    }

    userStatusDatabaseRef
      .onDisconnect()
      .set(isOfflineForDatabase)
      .then(async () => {
        await userStatusDatabaseRef.set(isOnlineForDatabase);
        const userProfile = await getUserProfile(uid);
        const isOnlineForFirestore: OnlinePlayer = {
          uid,
          name,
          level,
          avatarUrl,
          status: 'idle',
          cp: userProfile?.cp || 0,
          statusMessage: statusMessage || 'Available for a match!',
        };
        await userStatusFirestoreRef.set(isOnlineForFirestore);
        console.log("Presence system: User status set to 'idle'.");
      });
  });
};

export const updateStatusMessage = async (uid: string, message: string) => {
  const onlineUserRef = db.collection('onlineUsers').doc(uid);
  const userProfileRef = db.collection('users').doc(uid);
  try {
    await onlineUserRef.update({ statusMessage: message });
    await userProfileRef.update({ statusMessage: message });
  } catch (e) {
    console.warn('Could not update status message, user might be offline.', e);
  }
};

export const goOffline = async (uid: string) => {
  const userStatusFirestoreRef = db.collection('onlineUsers').doc(uid);
  try {
    await userStatusFirestoreRef.delete();
  } catch (e) {
    console.error('Error deleting online user doc:', e);
  }

  const userStatusDatabaseRef = rtdb.ref(`/status/${uid}`);
  await userStatusDatabaseRef.set({
    state: 'offline',
    last_changed: firebase.database.ServerValue.TIMESTAMP,
  });
};

// --- Lobby & Matchmaking ---
export const getOnlinePlayers = (
  callback: (players: OnlinePlayer[]) => void
): (() => void) => {
  const onlineUsersCol = db.collection('onlineUsers');
  const statusRef = rtdb.ref('status');

  let onlineUsers: OnlinePlayer[] = [];
  let onlineStatuses: { [uid: string]: { state: string; last_changed: any } } =
    {};
  let unsubFirestore: (() => void) | null = null;

  // To prevent race conditions on initial load
  let firestoreLoaded = false;
  let rtdbLoaded = false;

  const updateAndCleanup = () => {
    // Wait for both listeners to fire at least once before processing
    if (!firestoreLoaded || !rtdbLoaded) return;

    const trulyOnlinePlayers: OnlinePlayer[] = [];
    const stalePlayerIds: string[] = [];

    onlineUsers.forEach((player) => {
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
  unsubFirestore = onlineUsersCol.onSnapshot(
    (snapshot) => {
      onlineUsers = snapshot.docs.map((doc) => doc.data() as OnlinePlayer);
      firestoreLoaded = true;
      updateAndCleanup();
    },
    (error) => console.error('Firestore listener error:', error)
  );

  const rtdbCallback = (snapshot: firebase.database.DataSnapshot) => {
    onlineStatuses = snapshot.val() || {};
    rtdbLoaded = true;
    updateAndCleanup();
  };
  statusRef.on('value', rtdbCallback, (error) =>
    console.error('RTDB listener error:', error)
  );

  // Return a function to unsubscribe from both listeners
  return () => {
    if (unsubFirestore) unsubFirestore();
    statusRef.off('value', rtdbCallback);
  };
};

export const getOnlineUser = async (
  uid: string
): Promise<OnlinePlayer | null> => {
  const docRef = db.collection('onlineUsers').doc(uid);
  const docSnap = await docRef.get();
  return docSnap.exists ? (docSnap.data() as OnlinePlayer) : null;
};

export const joinMatchmakingQueue = async (
  user: User
): Promise<string | null> => {
  const q = db
    .collection('matchmakingQueue')
    .where('uid', '!=', user.uid)
    .limit(1);
  const querySnapshot = await q.get();

  if (querySnapshot.empty) {
    await db
      .collection('matchmakingQueue')
      .doc(user.uid)
      .set({
        uid: user.uid,
        joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    await db
      .collection('onlineUsers')
      .doc(user.uid)
      .update({ status: 'in_queue' });
    return null;
  } else {
    const opponentDoc = querySnapshot.docs[0];
    const opponentUid = opponentDoc.id;
    const gameId = await createOnlineGame(user.uid, opponentUid);
    const batch = db.batch();
    batch.delete(db.collection('matchmakingQueue').doc(opponentDoc.id));
    batch.update(db.collection('onlineUsers').doc(user.uid), {
      status: 'in_game',
      gameId,
    });
    batch.update(db.collection('onlineUsers').doc(opponentUid), {
      status: 'in_game',
      gameId,
    });
    await batch.commit();
    return gameId;
  }
};

export const cancelMatchmaking = async (uid: string) => {
  if (!uid) return;
  try {
    await db.collection('matchmakingQueue').doc(uid).delete();
    await db.collection('onlineUsers').doc(uid).update({ status: 'idle' });
  } catch (e) {
    console.warn(
      'Could not cancel matchmaking, user might have already found a game.'
    );
  }
};

// --- Leaderboard & Match History ---
export const getLeaderboard = async (
  limitCount = 100
): Promise<OnlinePlayer[]> => {
  const q = db.collection('users').orderBy('cp', 'desc').limit(limitCount);
  const querySnapshot = await q.get();
  const leaderboardPlayers: OnlinePlayer[] = querySnapshot.docs.map((doc) => {
    const user = doc.data() as UserProfile;
    return {
      uid: user.uid,
      name: user.name,
      level: user.level,
      avatarUrl: (
        (ALL_COSMETICS.find((c) => c.id === user.activeAvatarId)
          ?.item as Avatar) || DEFAULT_AVATAR
      ).url,
      status: 'idle', // Status isn't relevant for a static leaderboard
      cp: user.cp,
    };
  });
  return leaderboardPlayers;
};

export const recordMatchHistory = async (
  uid: string,
  gameId: string,
  entry: Omit<MatchHistoryEntry, 'id'>
) => {
  const historyRef = db.collection(`users/${uid}/matchHistory`).doc(gameId);
  await historyRef.set({ id: gameId, ...entry });
};

export const getMatchHistory = async (
  uid: string
): Promise<MatchHistoryEntry[]> => {
  const historyCol = db.collection(`users/${uid}/matchHistory`);
  const q = historyCol.orderBy('timestamp', 'desc').limit(10);
  const querySnapshot = await q.get();
  return querySnapshot.docs.map((doc) => doc.data() as MatchHistoryEntry);
};

export const recordPveMatchHistory = async (
  uid: string,
  entry: PveMatchHistoryEntry
) => {
  const historyRef = db
    .collection(`users/${uid}/pveMatchHistory`)
    .doc(entry.id);
  await historyRef.set(entry);
};

export const getPveMatchHistory = async (
  uid: string
): Promise<PveMatchHistoryEntry[]> => {
  const historyCol = db.collection(`users/${uid}/pveMatchHistory`);
  const q = historyCol.orderBy('timestamp', 'desc').limit(50);
  const querySnapshot = await q.get();
  return querySnapshot.docs.map((doc) => doc.data() as PveMatchHistoryEntry);
};

// --- Invitations ---
export const sendInvitation = async (
  fromUser: User,
  fromName: string,
  toUid: string
) => {
  const invitationRef = db.collection('invitations').doc(toUid);
  await invitationRef.set({
    from: fromUser.uid,
    fromName: fromName,
    timestamp: Date.now(),
  });
};

export const listenForInvitations = (
  uid: string,
  callback: (invitation: Invitation | null) => void
): (() => void) => {
  return db
    .collection('invitations')
    .doc(uid)
    .onSnapshot((doc) => {
      callback(doc.exists ? (doc.data() as Invitation) : null);
    });
};

export const acceptInvitation = async (
  user: User,
  invitation: Invitation
): Promise<string | null> => {
  const gameId = await createOnlineGame(user.uid, invitation.from);
  const batch = db.batch();
  batch.update(db.collection('onlineUsers').doc(user.uid), {
    status: 'in_game',
    gameId,
  });
  batch.update(db.collection('onlineUsers').doc(invitation.from), {
    status: 'in_game',
    gameId,
  });
  batch.delete(db.collection('invitations').doc(user.uid));
  await batch.commit();
  return gameId;
};

export const declineInvitation = async (uid: string) => {
  await db.collection('invitations').doc(uid).delete();
};

// --- Game Logic ---
export const createOnlineGame = async (
  player1Uid: string,
  player2Uid: string
): Promise<string> => {
  const gameId = `game_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 7)}`;
  const gameRef = db.collection('games').doc(gameId);

  const [p1Profile, p2Profile] = await Promise.all([
    getUserProfile(player1Uid),
    getUserProfile(player2Uid),
  ]);

  // Randomize who goes first to ensure fairness.
  const players =
    Math.random() < 0.5
      ? { X: player1Uid, O: player2Uid }
      : { X: player2Uid, O: player1Uid };

  const gameData: OnlineGame = {
    id: gameId,
    players: players,
    playerDetails: {
      [player1Uid]: {
        name: p1Profile?.name || 'Player 1',
        avatarUrl: (p1Profile?.activeAvatarId
          ? (ALL_COSMETICS.find((c) => c.id === p1Profile.activeAvatarId)
              ?.item as Avatar)
          : DEFAULT_AVATAR
        ).url,
        level: p1Profile?.level || 1,
        pieceId: p1Profile?.activePieceId || DEFAULT_PIECES_X.id,
        cp: p1Profile?.cp || 0,
      },
      [player2Uid]: {
        name: p2Profile?.name || 'Player 2',
        avatarUrl: (p2Profile?.activeAvatarId
          ? (ALL_COSMETICS.find((c) => c.id === p2Profile.activeAvatarId)
              ?.item as Avatar)
          : DEFAULT_AVATAR
        ).url,
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
  await gameRef.set(gameData);
  return gameId;
};

export const sendOnlineEmote = async (
  gameId: string,
  uid: string,
  emoji: string
) => {
  const gameRef = db.collection('games').doc(gameId);
  try {
    await gameRef.update({
      emotes: { uid, emoji, timestamp: Date.now() },
    });
  } catch (error) {
    console.error('Failed to send emote:', error);
  }
};

export const getOnlineGame = async (
  gameId: string
): Promise<OnlineGame | null> => {
  const docRef = db.collection('games').doc(gameId);
  const docSnap = await docRef.get();
  return docSnap.exists ? (docSnap.data() as OnlineGame) : null;
};

export const listenForGameStart = (
  uid: string,
  callback: (playerData: OnlinePlayer | null) => void
): (() => void) => {
  return db
    .collection('onlineUsers')
    .doc(uid)
    .onSnapshot((doc) => {
      callback(doc.exists ? (doc.data() as OnlinePlayer) : null);
    });
};

export const getOnlineGameStream = (
  gameId: string,
  callback: (game: OnlineGame | null) => void
): (() => void) => {
  return db
    .collection('games')
    .doc(gameId)
    .onSnapshot((docSnap) => {
      callback(docSnap.exists ? (docSnap.data() as OnlineGame) : null);
    });
};

export const makeOnlineMove = async (
  gameId: string,
  row: number,
  col: number,
  player: Player
) => {
  const gameRef = db.collection('games').doc(gameId);
  try {
    await db.runTransaction(async (transaction) => {
      const gameDoc = await transaction.get(gameRef);
      if (!gameDoc.exists) return;

      const gameData = gameDoc.data() as OnlineGame;
      if (
        gameData.status !== 'in_progress' ||
        gameData.currentPlayer !== player
      )
        return;

      const currentBoard = mapToBoard(gameData.board);
      if (currentBoard[row][col] !== null) return;
      currentBoard[row][col] = player;

      const timeElapsed = Math.round(
        (Date.now() - gameData.turnStartedAt) / 1000
      );
      const newPlayerTimes = { ...gameData.playerTimes };
      newPlayerTimes[player] = Math.max(
        0,
        newPlayerTimes[player] - timeElapsed
      );

      const winningLine = checkWin(currentBoard, player);
      const isDraw =
        currentBoard.every((r) => r.every((c) => c !== null)) && !winningLine;

      const updateData: any = {
        board: boardToMap(currentBoard),
        currentPlayer: player === 'X' ? 'O' : 'X',
        updatedAt: Date.now(),
        status: winningLine || isDraw ? 'finished' : 'in_progress',
        winner: winningLine ? player : isDraw ? 'draw' : null,
        winningLine: winningLine || null,
        playerTimes: newPlayerTimes,
        turnStartedAt: Date.now(),
      };

      transaction.update(gameRef, updateData);
    });
  } catch (error) {
    console.error('Make move transaction failed:', error);
  }
};

export const claimTimeoutVictory = async (gameId: string, claimant: Player) => {
  const gameRef = db.collection('games').doc(gameId);
  try {
    await db.runTransaction(async (transaction) => {
      const gameDoc = await transaction.get(gameRef);
      if (!gameDoc.exists || gameDoc.data()?.status !== 'in_progress') return;

      const gameData = gameDoc.data() as OnlineGame;
      if (gameData.currentPlayer !== claimant) {
        const timeSinceLastMove = (Date.now() - gameData.turnStartedAt) / 1000;
        const totalTimeLeft =
          gameData.playerTimes[gameData.currentPlayer] - timeSinceLastMove;
        if (totalTimeLeft < 0) {
          console.log(`Player ${claimant} is claiming a timeout victory.`);
          transaction.update(gameRef, {
            status: 'finished',
            winner: claimant,
          });
        }
      }
    });
  } catch (e) {
    console.error('Error claiming timeout victory:', e);
  }
};

export const updatePlayerPieceSkin = async (
  gameId: string,
  uid: string,
  pieceId: string
) => {
  const gameRef = db.collection('games').doc(gameId);
  try {
    await gameRef.update({ [`playerDetails.${uid}.pieceId`]: pieceId });
  } catch (error) {
    console.log('Could not update piece skin (game may be over):', error);
  }
};

export const resignOnlineGame = async (
  gameId: string,
  resigningPlayer: Player
) => {
  const gameRef = db.collection('games').doc(gameId);
  try {
    await db.runTransaction(async (transaction) => {
      const gameDoc = await transaction.get(gameRef);
      if (!gameDoc.exists || gameDoc.data()?.status !== 'in_progress') {
        return; // Game already over or doesn't exist
      }
      transaction.update(gameRef, {
        status: 'finished',
        winner: resigningPlayer === 'X' ? 'O' : 'X',
      });
    });
  } catch (e) {
    console.error('Resignation transaction failed: ', e);
  }
};

export const returnToLobby = async (uid: string) => {
  const userStatusRef = db.collection('onlineUsers').doc(uid);
  try {
    const docSnap = await userStatusRef.get();
    if (docSnap.exists) {
      await userStatusRef.update({ status: 'idle', gameId: null });
    }
  } catch (e) {
    console.error('Failed to return user to lobby:', e);
  }
};

export const leaveOnlineGame = async (gameId: string, uid: string) => {
  await returnToLobby(uid);
};

export const cleanupOldGames = async (): Promise<void> => {
  const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;

  const finishedGamesQuery = db
    .collection('games')
    .where('status', '==', 'finished')
    .where('updatedAt', '<', thirtyMinutesAgo);

  const inactiveGamesQuery = db
    .collection('games')
    .where('status', '==', 'in_progress')
    .where('updatedAt', '<', thirtyMinutesAgo);

  try {
    const [finishedGamesSnapshot, inactiveGamesSnapshot] = await Promise.all([
      finishedGamesQuery.get(),
      inactiveGamesQuery.get(),
    ]);

    if (finishedGamesSnapshot.empty && inactiveGamesSnapshot.empty) {
      return;
    }

    const batch = db.batch();
    let count = 0;

    finishedGamesSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
      count++;
    });

    inactiveGamesSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
      count++;
    });

    if (count > 0) {
      await batch.commit();
      console.log(`Cleaned up ${count} old/inactive games.`);
    }
  } catch (error) {
    console.error('Error cleaning up old games:', error);
  }
};

// --- Chat ---
export const getChatId = (id1: string, id2: string): string => {
  return [id1, id2].sort().join('_');
};

export const sendMessage = async (
  chatId: string,
  senderId: string,
  senderName: string,
  text: string
): Promise<void> => {
  const messagesCol = db.collection(`chats/${chatId}/messages`);
  const messageDocRef = await messagesCol.add({
    senderId,
    text,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  });

  // Also create a notification for the recipient
  const recipientId = chatId.split('_').find((id) => id !== senderId);
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

    const notificationRef = db
      .collection(`users/${recipientId}/notifications`)
      .doc(messageDocRef.id);
    await notificationRef.set({
      type: 'message',
      text: notificationText,
      senderId,
      senderName,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      seen: false,
    });
  }
};

export const listenForMessages = (
  chatId: string,
  callback: (messages: ChatMessage[]) => void
): (() => void) => {
  const messagesCol = db.collection(`chats/${chatId}/messages`);
  const q = messagesCol.orderBy('timestamp', 'desc').limit(100);
  return q.onSnapshot((snapshot) => {
    const messages = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as ChatMessage)
    );
    callback(messages.reverse());
  });
};

export const listenForNewMessages = (
  chatId: string,
  currentUserId: string,
  callback: (message: ChatMessage) => void
): (() => void) => {
  const messagesCol = db.collection(`chats/${chatId}/messages`);
  const q = messagesCol.orderBy('timestamp', 'desc').limit(1);

  let isFirstLoad = true;

  return q.onSnapshot((snapshot) => {
    if (isFirstLoad) {
      isFirstLoad = false;
      return;
    }

    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const message = {
          id: change.doc.id,
          ...change.doc.data(),
        } as ChatMessage;
        if (message.senderId !== currentUserId) {
          callback(message);
        }
      }
    });
  });
};

// --- Notifications ---
export const listenForNotifications = (
  uid: string,
  callback: (notifications: Notification[]) => void
): (() => void) => {
  const notificationsCol = db.collection(`users/${uid}/notifications`);
  const q = notificationsCol.orderBy('timestamp', 'desc').limit(50);

  return q.onSnapshot((snapshot) => {
    const notifs = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as Notification)
    );
    callback(notifs);
  });
};

export const markNotificationAsSeen = async (
  uid: string,
  notificationId: string
): Promise<void> => {
  const notifRef = db
    .collection(`users/${uid}/notifications`)
    .doc(notificationId);
  await notifRef.update({ seen: true });
};

export const deleteNotification = async (
  uid: string,
  notificationId: string
): Promise<void> => {
  const notifRef = db
    .collection(`users/${uid}/notifications`)
    .doc(notificationId);
  await notifRef.delete();
};

export const sendTeaseNotification = async (
  fromUid: string,
  fromName: string,
  toUid: string,
  emoji: string
) => {
  const notificationRef = db.collection(`users/${toUid}/notifications`).doc();
  await notificationRef.set({
    type: 'tease',
    text: `teased you!`,
    senderId: fromUid,
    senderName: fromName,
    emoji: emoji,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    seen: false,
  });
};

// --- Friends ---
export const respondToFriendRequest = async (
  uid: string,
  friendUid: string,
  response: 'accept' | 'decline'
) => {
  const userFriendRef = db.collection(`users/${uid}/friends`).doc(friendUid);
  const friendUserRef = db.collection(`users/${friendUid}/friends`).doc(uid);

  const batch = db.batch();

  if (response === 'accept') {
    batch.update(userFriendRef, { status: 'friends' });
    batch.update(friendUserRef, { status: 'friends' });
  } else {
    // decline
    batch.delete(userFriendRef);
    batch.delete(friendUserRef);
  }
  await batch.commit();
};

export const removeFriend = async (uid: string, friendUid: string) => {
  const batch = db.batch();
  batch.delete(db.collection(`users/${uid}/friends`).doc(friendUid));
  batch.delete(db.collection(`users/${friendUid}/friends`).doc(uid));
  await batch.commit();
};

export const listenForFriends = (
  uid: string,
  callback: (friends: Friend[]) => void
): (() => void) => {
  const friendsCol = db.collection(`users/${uid}/friends`);
  return friendsCol.onSnapshot((snapshot) => {
    const friendsData = snapshot.docs.map(
      (doc) => ({ ...doc.data(), uid: doc.id } as Friend)
    );
    callback(friendsData);
  });
};

export const getLocker = async (uid: string): Promise<LockerItem[]> => {
  const lockerCol = db.collection(`users/${uid}/locker`);
  const q = lockerCol.where('isClaimed', '==', false);
  const querySnapshot = await q.get();
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as LockerItem)
  );
};

export const listenForLocker = (
  uid: string,
  callback: (items: LockerItem[]) => void
): (() => void) => {
  const lockerCol = db.collection(`users/${uid}/locker`);
  const q = lockerCol.orderBy('receivedAt', 'desc');
  return q.onSnapshot((snapshot) => {
    const items = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as LockerItem)
    );
    callback(items);
  });
};

export const sendFriendRequest = async (fromUid: string, toUid: string) => {
  const fromProfile = await getUserProfile(fromUid);
  const toProfile = await getUserProfile(toUid);

  if (!fromProfile || !toProfile) {
    console.error('Could not find user profile for friend request.');
    return;
  }

  const batch = db.batch();
  const fromFriendRef = db.collection(`users/${fromUid}/friends`).doc(toUid);
  const toFriendRef = db.collection(`users/${toUid}/friends`).doc(fromUid);

  const friendDataForSender: Omit<Friend, 'onlineStatus'> = {
    uid: toUid,
    name: toProfile.name,
    avatarUrl: (
      (ALL_COSMETICS.find((c) => c.id === toProfile.activeAvatarId)
        ?.item as Avatar) || DEFAULT_AVATAR
    ).url,
    level: toProfile.level,
    status: 'pending',
  };
  const friendDataForReceiver: Omit<Friend, 'onlineStatus'> = {
    uid: fromUid,
    name: fromProfile.name,
    avatarUrl: (
      (ALL_COSMETICS.find((c) => c.id === fromProfile.activeAvatarId)
        ?.item as Avatar) || DEFAULT_AVATAR
    ).url,
    level: fromProfile.level,
    status: 'received',
  };

  batch.set(fromFriendRef, friendDataForSender);
  batch.set(toFriendRef, friendDataForReceiver);

  // Create a notification for the recipient
  const notificationRef = db.collection(`users/${toUid}/notifications`).doc();
  batch.set(notificationRef, {
    type: 'friend_request',
    text: `sent you a friend request.`,
    senderId: fromUid,
    senderName: fromProfile.name,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    seen: false,
  });

  await batch.commit();
};

export const sendGift = async (
  fromUid: string,
  fromName: string,
  toUid: string,
  cosmeticId: string
) => {
  const cosmetic = ALL_COSMETICS.find((c) => c.id === cosmeticId);
  if (!cosmetic) throw new Error(`Cosmetic with id ${cosmeticId} not found!`);

  const recipientRef = db.collection('users').doc(toUid);

  await db.runTransaction(async (transaction) => {
    const recipientDoc = await transaction.get(recipientRef);
    // FIX: `exists` is a boolean property, not a method.
    if (!recipientDoc.exists) throw new Error('Recipient user not found.');

    const recipientProfile = recipientDoc.data() as UserProfile;
    const isConsumable =
      cosmetic.type === 'emoji' || cosmetic.type === 'animated_emoji';

    if (!isConsumable) {
      if (recipientProfile.ownedCosmeticIds.includes(cosmeticId)) {
        throw new Error('Recipient already owns this item.');
      }
      if (recipientProfile.pendingGiftIds?.includes(cosmeticId)) {
        throw new Error('Recipient has this gift pending claim.');
      }
    }

    const lockerRef = db.collection(`users/${toUid}/locker`).doc();
    transaction.set(lockerRef, {
      cosmeticId,
      fromUid,
      fromName,
      receivedAt: firebase.firestore.FieldValue.serverTimestamp(),
      isClaimed: false,
    });

    if (!isConsumable) {
      transaction.update(recipientRef, {
        pendingGiftIds: firebase.firestore.FieldValue.arrayUnion(cosmeticId),
      });
    }

    const notificationRef = db.collection(`users/${toUid}/notifications`).doc();
    transaction.set(notificationRef, {
      type: 'gift',
      text: `sent you a gift: ${cosmetic.name}!`,
      senderId: fromUid,
      senderName: fromName,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      seen: false,
      cosmeticId: cosmeticId,
    });
  });
};

export const claimGift = async (
  uid: string,
  giftId: string
): Promise<{ success: boolean; message: string }> => {
  const giftRef = db.collection(`users/${uid}/locker`).doc(giftId);
  const userRef = db.collection(`users`).doc(uid);

  try {
    await db.runTransaction(async (transaction) => {
      const giftDoc = await transaction.get(giftRef);
      const userDoc = await transaction.get(userRef);

      // FIX: `exists` is a boolean property, not a method.
      if (!giftDoc.exists || !userDoc.exists)
        throw 'Gift or user does not exist!';

      const giftData = giftDoc.data() as LockerItem;
      if (giftData.isClaimed) return; // Already claimed, do nothing.

      const cosmetic = ALL_COSMETICS.find((c) => c.id === giftData.cosmeticId);
      if (!cosmetic) throw `Cosmetic with id ${giftData.cosmeticId} not found!`;

      const userData = userDoc.data() as UserProfile;
      const isOwned = userData.ownedCosmeticIds.includes(cosmetic.id);
      const isConsumable =
        cosmetic.type === 'emoji' || cosmetic.type === 'animated_emoji';

      if (!isOwned || isConsumable) {
        // Add the item to the user's inventory
        if (isConsumable) {
          const newInventory = { ...userData.emojiInventory };
          newInventory[cosmetic.id] = (newInventory[cosmetic.id] || 0) + 1;
          transaction.update(userRef, { emojiInventory: newInventory });
        } else {
          transaction.update(userRef, {
            ownedCosmeticIds: [...userData.ownedCosmeticIds, cosmetic.id],
          });
        }
      }
      // If item is already owned and not consumable, do nothing with inventory.

      // Mark the gift as claimed
      transaction.update(giftRef, { isClaimed: true });

      if (!isConsumable) {
        transaction.update(userRef, {
          pendingGiftIds: firebase.firestore.FieldValue.arrayRemove(
            cosmetic.id
          ),
        });
      }
    });
    return { success: true, message: 'Gift claimed!' };
  } catch (e) {
    console.error('Gift claim transaction failed: ', e);
    return { success: false, message: `Error: ${e}` };
  }
};

export const recordPurchase = async (uid: string, cosmetic: Cosmetic) => {
  const historyCol = db.collection(`users/${uid}/purchaseHistory`);
  await historyCol.add({
    cosmeticId: cosmetic.id,
    cosmeticName: cosmetic.name,
    price: cosmetic.price,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  });
};

export const getPurchaseHistory = async (
  uid: string
): Promise<PurchaseHistoryEntry[]> => {
  const historyCol = db.collection(`users/${uid}/purchaseHistory`);
  const q = historyCol.orderBy('timestamp', 'desc').limit(50);
  const querySnapshot = await q.get();
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as PurchaseHistoryEntry)
  );
};

export const recordGiftSent = async (
  uid: string,
  recipientId: string,
  recipientName: string,
  cosmetic: Cosmetic
) => {
  const historyCol = db.collection(`users/${uid}/giftHistory`);
  await historyCol.add({
    cosmeticId: cosmetic.id,
    cosmeticName: cosmetic.name,
    recipientId,
    recipientName,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  });
};

export const getGiftHistory = async (
  uid: string
): Promise<GiftHistoryEntry[]> => {
  const historyCol = db.collection(`users/${uid}/giftHistory`);
  const q = historyCol.orderBy('timestamp', 'desc').limit(50);
  const querySnapshot = await q.get();
  return querySnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as GiftHistoryEntry)
  );
};
