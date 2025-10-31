import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import * as onlineService from '../services/onlineService';
import type { OnlinePlayer, Friend, MatchHistoryEntry, ChatMessage, Notification, PieceStyle } from '../types';
import { useAuth } from '../context/AuthContext';
import { useSound } from '../hooks/useSound';
import Modal from './Modal';
import { SettingsModal } from './game/GameModals';
import { useGameState } from '../context/GameStateContext';
import { getRankFromCp, getXpForNextLevel, PRESET_STATUS_MESSAGES, ALL_COSMETICS, DEFAULT_PIECES_X, DEFAULT_PIECES_O } from '../constants';
import FriendsManager from './friends/FriendsManager';
import ChatBox from './chat/ChatBox';
import GameReviewModal from './game/GameReviewModal';

interface OnlineLobbyProps {
  onStartGame: (gameId: string) => void;
  onBack: () => void;
}

const Pagination: React.FC<{
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}> = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;

    const pageButtonClass = "px-3 py-1 text-sm rounded-md transition-colors ";
    const activeClass = "bg-cyan-500 text-black font-bold";
    const inactiveClass = "bg-slate-700 hover:bg-slate-600 text-white";

    const renderPageNumbers = () => {
        const pageNumbers = [];
        const maxPagesToShow = 5;

        if (totalPages <= maxPagesToShow) {
            for (let i = 1; i <= totalPages; i++) {
                pageNumbers.push(
                    <button key={i} onClick={() => onPageChange(i)} className={`${pageButtonClass} ${currentPage === i ? activeClass : inactiveClass}`}>
                        {i}
                    </button>
                );
            }
            return pageNumbers;
        }

        const pages = new Set<number>();
        pages.add(1);
        pages.add(totalPages);
        pages.add(currentPage);
        if (currentPage > 1) pages.add(currentPage - 1);
        if (currentPage < totalPages) pages.add(currentPage + 1);
        
        const sortedPages = Array.from(pages).sort((a, b) => a - b);
        
        let lastPage = 0;
        for (const page of sortedPages) {
            if (lastPage !== 0 && page > lastPage + 1) {
                pageNumbers.push(<span key={`ellipsis-${lastPage}`} className="px-2 text-slate-400">...</span>);
            }
            pageNumbers.push(
                <button key={page} onClick={() => onPageChange(page)} className={`${pageButtonClass} ${currentPage === page ? activeClass : inactiveClass}`}>
                    {page}
                </button>
            );
            lastPage = page;
        }
        
        return pageNumbers;
    };


    return (
        <div className="flex items-center justify-center gap-2 mt-4">
            <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1 text-sm rounded-md transition-colors bg-slate-700 hover:bg-slate-600 text-white disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed">
                &lt;
            </button>
            {renderPageNumbers()}
            <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="px-3 py-1 text-sm rounded-md transition-colors bg-slate-700 hover:bg-slate-600 text-white disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed">
                &gt;
            </button>
        </div>
    );
};

const SearchingModal: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
  const [timeLeft, setTimeLeft] = useState(30);
  const animationStartRef = useRef<number | null>(null);

  useEffect(() => {
    let animationFrameId: number;

    const animate = (timestamp: number) => {
        if (animationStartRef.current === null) {
            animationStartRef.current = timestamp;
        }
        const elapsed = timestamp - animationStartRef.current;
        const newTimeLeft = Math.max(0, 30 - elapsed / 1000);
        
        setTimeLeft(newTimeLeft);

        if (newTimeLeft > 0) {
            animationFrameId = requestAnimationFrame(animate);
        } else {
            onCancel();
        }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [onCancel]);

  const displayCountdown = Math.ceil(timeLeft);
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (timeLeft / 30) * circumference;

  return (
    <div className="fixed inset-0 bg-slate-900/90 flex flex-col items-center justify-center z-50 backdrop-blur-sm animate-fade-in">
      <div className="relative w-48 h-48 flex items-center justify-center">
        <svg className="w-full h-full" viewBox="0 0 140 140">
           <defs>
            <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FBBF24" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
            <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0ea5e9" />
            </linearGradient>
            <filter id="glow">
                <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
          </defs>
          <circle cx="70" cy="70" r="68" stroke="url(#goldGradient)" strokeWidth="2" fill="transparent" />
          <circle cx="70" cy="70" r="60" stroke="rgba(0,0,0,0.5)" strokeWidth="8" fill="transparent" />
          <circle
            cx="70"
            cy="70"
            r={60}
            stroke="url(#blueGradient)"
            strokeWidth="8"
            fill="transparent"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transform -rotate-90 origin-center"
            style={{ filter: 'url(#glow)'}}
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-white">
            <span className="text-5xl font-bold tracking-tighter" style={{ textShadow: '0 0 10px rgba(255,255,255,0.5)' }}>{displayCountdown}</span>
        </div>
      </div>
       <h2 className="text-3xl font-bold text-white mt-8" style={{ textShadow: '0 0 15px rgba(56, 189, 248, 0.5)'}}>
        Finding Opponent
      </h2>
      <button
        onClick={onCancel}
        className="mt-8 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-6 rounded-lg transition-colors"
      >
        Cancel
      </button>
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
      `}</style>
    </div>
  );
};

const Leaderboard: React.FC = () => {
    const [topPlayers, setTopPlayers] = useState<OnlinePlayer[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const playersPerPage = 10;

    useEffect(() => {
        onlineService.getLeaderboard(100).then(setTopPlayers);
    }, []);

    const totalPages = Math.ceil(topPlayers.length / playersPerPage);
    const displayedPlayers = topPlayers.slice((currentPage - 1) * playersPerPage, currentPage * playersPerPage);

    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 h-[75vh] flex flex-col">
            <h2 className="text-xl font-semibold text-white mb-4 text-left">Leaderboard 🏆</h2>
            <div className="flex-grow overflow-y-auto pr-2 scrollbar-hide">
                {displayedPlayers.map((p, index) => {
                    const rankIndex = (currentPage - 1) * playersPerPage + index;
                    const rank = getRankFromCp(p.cp);
                    const rankColor = rankIndex === 0 ? 'text-yellow-400' : rankIndex === 1 ? 'text-slate-300' : rankIndex === 2 ? 'text-orange-400' : 'text-slate-500';
                    return (
                        <div key={`${p.uid}-${rankIndex}`} className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-lg mb-2">
                            <span className={`text-lg font-bold w-6 text-center ${rankColor}`}>{rankIndex + 1}</span>
                            <img src={p.avatarUrl} alt={p.name} className="w-9 h-9 rounded-full object-cover bg-slate-700" />
                            <div className="flex-grow overflow-hidden">
                                 <div className="flex items-baseline gap-2">
                                    <p className="font-semibold text-white text-sm truncate">{p.name}</p>
                                    <p className="text-xs text-cyan-400">Lv. {p.level}</p>
                                </div>
                                <p className="text-slate-400 text-xs truncate">{rank.icon} {rank.name}</p>
                            </div>
                            <p className="text-cyan-400 text-sm font-semibold">{p.cp} CP</p>
                        </div>
                    );
                })}
            </div>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
    );
}

const MatchHistoryModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    userId: string;
    onViewChat: (entry: MatchHistoryEntry) => void;
}> = ({ isOpen, onClose, userId, onViewChat }) => {
    const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [reviewingGame, setReviewingGame] = useState<MatchHistoryEntry | null>(null);
    const { gameState } = useGameState();
    const { playSound } = useSound();

    useEffect(() => {
        if (isOpen && userId) {
            setLoading(true);
            onlineService.getMatchHistory(userId).then(data => {
                setHistory(data);
                setLoading(false);
            });
        }
    }, [isOpen, userId]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Match History" size="xl">
            <div className="max-h-[60vh] overflow-y-auto pr-2 scrollbar-hide">
                {loading ? <p className="text-slate-400">Loading history...</p> : 
                 history.length === 0 ? <p className="text-slate-400">No online matches played yet.</p> :
                 history.map(entry => {
                     const resultColor = entry.result === 'win' ? 'text-green-400' : entry.result === 'loss' ? 'text-red-500' : 'text-yellow-400';
                     const duration = `${Math.floor(entry.duration / 60)}m ${entry.duration % 60}s`;
                     const rank = getRankFromCp(entry.opponentCp);

                     const opponentMark = entry.playerMark === 'X' ? 'O' : 'X';
                     const opponentPieceId = opponentMark === 'X' ? entry.playerXPieceId : entry.playerOPieceId;
                 
                     const opponentPieceCosmetic = ALL_COSMETICS.find(c => c.id === opponentPieceId && c.type === 'piece');
                     const OpponentPiece = opponentPieceCosmetic 
                         ? (opponentPieceCosmetic.item as PieceStyle).component 
                         : (opponentMark === 'X' ? DEFAULT_PIECES_X.component : DEFAULT_PIECES_O.component);
                     
                     const moveCount = entry.boardState ? Object.values(entry.boardState).filter(p => p === opponentMark).length : 0;

                     return (
                        <div key={entry.id} className="bg-slate-800/50 p-3 rounded-lg mb-3 flex items-center justify-between gap-4">
                            {/* Opponent Info (Left) */}
                            <div className="flex items-center gap-3 w-2/5 min-w-0">
                                <img src={entry.opponentAvatarUrl} alt={entry.opponentName} className="w-12 h-12 rounded-full object-cover bg-slate-700 flex-shrink-0" />
                                <div className="overflow-hidden">
                                    <div className="flex items-baseline gap-2">
                                        <p className="font-semibold text-white truncate">{entry.opponentName}</p>
                                        <p className="text-xs text-cyan-400">Lv. {entry.opponentLevel}</p>
                                    </div>
                                    <p className="text-xs text-slate-400 truncate flex items-center gap-2" title={`Room: ${entry.id.split('_').pop()?.substring(0, 6)}`}>
                                        <span>{rank.icon} {rank.name}</span>
                                        {OpponentPiece && <span className={`w-4 h-4 ${opponentMark === 'X' ? 'text-cyan-400' : 'text-pink-500'}`}><OpponentPiece /></span>}
                                        {moveCount > 0 && <span className="text-slate-400 text-xs font-bold">{moveCount}</span>}
                                    </p>
                                </div>
                            </div>

                            {/* Result & Time Info (Center) */}
                            <div className="text-center text-sm flex-grow">
                                <div className="flex items-baseline justify-center gap-3">
                                    <span className={`font-bold text-base ${resultColor}`}>
                                        {entry.cpChange >= 0 ? `+${entry.cpChange}` : entry.cpChange} CP
                                    </span>
                                    <div className="flex items-center gap-1 text-slate-400 text-xs">
                                        <span>⏱️ {duration}</span>
                                    </div>
                                </div>
                                <div className="text-slate-400 text-xs mt-1">
                                    <p>{onlineService.formatFullTimestamp(entry.timestamp)}</p>
                                </div>
                            </div>
                            
                            {/* Chat/Review Buttons (Right) */}
                            <div className="flex flex-col gap-1 flex-shrink-0 w-16 items-end">
                                <button onClick={() => onViewChat(entry)} className="p-1.5 rounded-md text-xs bg-slate-700 hover:bg-slate-600 transition-colors w-full text-center" title="View Chat">Chat</button>
                                {entry.boardState && <button onClick={() => { playSound('select'); setReviewingGame(entry); }} className="p-1.5 rounded-md text-xs bg-slate-700 hover:bg-slate-600 transition-colors w-full text-center" title="Review Game">Review</button>}
                            </div>
                        </div>
                     )
                 })}
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
    )
}

const OnlineLobby: React.FC<OnlineLobbyProps> = ({ onStartGame, onBack }) => {
  const { user, logOut } = useAuth();
  const { gameState, setStatusMessage, setNotifications } = useGameState();
  const { friends, notifications } = gameState;
  const [players, setPlayers] = useState<OnlinePlayer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [statusInput, setStatusInput] = useState(gameState.statusMessage || '');
  const [chatTarget, setChatTarget] = useState<{uid: string, name: string, chatId?: string, isReadOnly?: boolean} | null>(null);
  const [invitedPlayers, setInvitedPlayers] = useState<Set<string>>(new Set());
  const [showNotifications, setShowNotifications] = useState(false);
  const [displayedNotifCount, setDisplayedNotifCount] = useState(10);
  const [onlinePlayersPage, setOnlinePlayersPage] = useState(1);
  const playersPerPage = 10;

  const { playSound } = useSound();
  
  const handleGameFound = useCallback((gameId: string) => {
    setIsSearching(false);
    onStartGame(gameId);
  }, [onStartGame]);

  // General listeners for players and self status
  useEffect(() => {
    if (!user) return;
    
    const unsubscribePlayers = onlineService.getOnlinePlayers((onlinePlayers) => {
      const otherPlayers = onlinePlayers.filter(p => p.uid !== user.uid);
      setPlayers(otherPlayers);
      // Reset to page 1 if the current page becomes empty and it's not the first page
      const totalPages = Math.ceil(otherPlayers.length / playersPerPage);
      if (onlinePlayersPage > totalPages) {
        setOnlinePlayersPage(Math.max(1, totalPages));
      }
    });

    const unsubscribeSelf = onlineService.listenForGameStart(user.uid, (playerData) => {
        if (isSearching && playerData?.status === 'in_game' && playerData.gameId) {
            handleGameFound(playerData.gameId);
        }
    });

    return () => {
      unsubscribePlayers();
      unsubscribeSelf();
    };
  }, [user, isSearching, handleGameFound, onlinePlayersPage]);
  
  const enrichedFriends: Friend[] = useMemo(() => {
    return friends.map(friend => {
        const onlineInfo = players.find(p => p.uid === friend.uid);
        return {
            ...friend,
            onlineStatus: onlineInfo ? onlineInfo.status : 'offline',
            statusMessage: onlineInfo ? onlineInfo.statusMessage : undefined,
        };
    });
  }, [friends, players]);

  const handleInvite = (player: OnlinePlayer) => {
    if (!user) return;
    playSound('select');
    onlineService.sendInvitation(user, gameState.playerName, player.uid);
    setInvitedPlayers(prev => new Set(prev).add(player.uid));
    setTimeout(() => {
        setInvitedPlayers(prev => {
            const newSet = new Set(prev);
            newSet.delete(player.uid);
            return newSet;
        });
    }, 15000);
  };
  
  const handleFindMatch = async () => {
    if (!user) return;
    setIsSearching(true);
    playSound('select');
    const gameId = await onlineService.joinMatchmakingQueue(user);
    if (gameId) handleGameFound(gameId);
  };

  const handleCancelSearch = () => {
      if (!user) return;
      playSound('select');
      onlineService.cancelMatchmaking(user.uid);
      setIsSearching(false);
  }

  const handleAddFriend = (player: OnlinePlayer) => {
    if (!user) return;
    playSound('select');
    onlineService.sendFriendRequest(user.uid, player.uid);
  }

  const handleStartChat = (player: {uid: string, name: string}) => {
    setChatTarget(player);
    setIsChatOpen(true);
    if (user) {
        notifications.forEach(n => {
            if(n.type === 'message' && n.senderId === player.uid && !n.seen) {
                onlineService.markNotificationAsSeen(user.uid, n.id);
            }
        });
    }
  }
  
  const getFriendshipStatus = (otherUid: string): 'friend' | 'pending' | 'received' | 'none' => {
      const friend = friends.find(f => f.uid === otherUid);
      if (!friend) return 'none';
      if (friend.status === 'friends') return 'friend';
      return friend.status;
  }

  const handleStatusSubmit = () => {
    setStatusMessage(statusInput);
    setIsEditingStatus(false);
  };

  const handlePresetStatusSelect = (message: string) => {
    setStatusInput(message);
    setStatusMessage(message);
    setIsEditingStatus(false);
  }
  
  const unseenNotifCount = notifications.filter(n => !n.seen).length;

  const handleToggleNotifications = () => {
      playSound('select');
      setShowNotifications(p => !p);
      if(!showNotifications) {
        setDisplayedNotifCount(10); // Reset count when opening
      }
  }

  const handleNotificationClick = (notification: Notification) => {
    if (user) onlineService.markNotificationAsSeen(user.uid, notification.id);
    if(notification.type === 'message') {
        handleStartChat({uid: notification.senderId, name: notification.senderName});
        setShowNotifications(false);
    } else if (notification.type === 'friend_request') {
        setIsFriendsOpen(true);
        setShowNotifications(false);
    }
  }

  const handleDeleteNotification = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (user) onlineService.deleteNotification(user.uid, id);
  }
  
  const handleViewHistoryChat = (entry: MatchHistoryEntry) => {
      playSound('select');
      setChatTarget({ uid: entry.opponentId, name: entry.opponentName, chatId: entry.chatId, isReadOnly: true });
      setIsChatOpen(true);
  };
  
  const { onlineWins, onlineLosses, cp, playerLevel, coins } = gameState;
  const totalGames = onlineWins + onlineLosses + (gameState.onlineDraws || 0);
  const winRate = totalGames > 0 ? ((onlineWins / totalGames) * 100).toFixed(2) : '0.00';
  const rank = getRankFromCp(cp);
  const isChallenger = rank.name === 'Thách Đấu';
  const cpPercentage = isChallenger ? 100 : (rank.cpInTier / 100) * 100;

  const totalOnlinePages = Math.ceil(players.length / playersPerPage);
  const displayedOnlinePlayers = players.slice((onlinePlayersPage - 1) * playersPerPage, onlinePlayersPage * playersPerPage);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-6 flex flex-col items-center justify-center relative">
      {isSearching && <SearchingModal onCancel={handleCancelSearch} />}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%2D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22%231e293b%22%20fill-opacity%3D%220.4%22%20fill-rule%3D%22evenodd%22%3E%3Cpath%20d%3D%22M0%2040L40%200H20L0%2020M40%2040V20L20%2040%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50"></div>

      <div className="w-full max-w-6xl z-10">
        <header className="flex justify-between items-center mb-6">
            <h1 className="text-4xl font-bold text-cyan-400">Online Lobby</h1>
             <div className="flex items-center gap-2">
                 <div className="relative">
                    <button onClick={handleToggleNotifications} className="bg-slate-700/80 p-2 rounded-full hover:bg-slate-600 transition-colors" aria-label="Notifications">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        {unseenNotifCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full border-2 border-slate-900 flex items-center justify-center">{unseenNotifCount}</span>}
                    </button>
                    {showNotifications && (
                        <div className="absolute top-12 right-0 w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-lg z-20 flex flex-col">
                           <div className="flex-grow p-2 max-h-80 overflow-y-auto scrollbar-hide">
                               {notifications.length > 0 ? notifications.slice(0, displayedNotifCount).map(n => {
                                    const isReaction = n.text.startsWith('reacted with');
                                    const messageContent = isReaction ? (
                                        <>{` `}{n.text}</>
                                    ) : (
                                        <> says: "{n.text}"</>
                                    );

                                   return (
                                        <div key={n.id} className={`relative group/notif text-sm p-2 rounded-md hover:bg-slate-800 cursor-pointer ${!n.seen ? 'bg-blue-900/30' : ''}`} onClick={() => handleNotificationClick(n)}>
                                            <button onClick={(e) => handleDeleteNotification(e, n.id)} className="absolute top-0 right-0 p-2 rounded-full text-slate-500 hover:text-white hover:bg-slate-700 hidden group-hover/notif:block" aria-label="Delete notification">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                            </button>
                                            <p><strong className="text-cyan-400">{n.senderName}</strong>{messageContent}</p>
                                            <time className="text-xs text-slate-500">{onlineService.formatFullTimestamp(n.timestamp)}</time>
                                        </div>
                                   );
                               }) : <p className="text-xs text-slate-500 p-4 text-center">No new notifications.</p>}
                           </div>
                            {notifications.length > displayedNotifCount && (
                                <button onClick={() => setDisplayedNotifCount(p => p + 10)} className="w-full text-center p-2 text-xs font-semibold text-cyan-400 hover:bg-slate-800 rounded-b-lg border-t border-slate-700">
                                    Load More
                                </button>
                            )}
                        </div>
                    )}
                </div>
                 <button onClick={() => { playSound('select'); setIsHistoryOpen(true); }} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">History</button>
                <button onClick={() => { playSound('select'); setIsFriendsOpen(true); }} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">Friends</button>
                <button onClick={onBack} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">Menu</button>
                <button onClick={() => { playSound('select'); setIsSettingsOpen(true); }} className="bg-slate-700/80 p-2 rounded-full hover:bg-slate-600 transition-colors" aria-label="Settings"><svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924-1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066 2.573c-.94-1.543.826 3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg></button>
            </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-[350px_1fr_350px] gap-6">
            <Leaderboard />
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 h-[75vh] flex flex-col">
                <h2 className="text-xl font-semibold text-white mb-4 text-left">Players Online ({players.length})</h2>
                <div className="flex-grow overflow-y-auto pr-2 scrollbar-hide">
                    {displayedOnlinePlayers.map(p => {
                        const friendship = getFriendshipStatus(p.uid);
                        const isInvited = invitedPlayers.has(p.uid);
                        const playerRank = getRankFromCp(p.cp);
                        const isCurrentUserGuest = user?.isAnonymous;
                        const isTargetPlayerGuest = p.name.startsWith('Player_');

                        return (
                            <div key={p.uid} className="bg-slate-900/50 p-3 rounded-lg mb-2">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 min-w-0">
                                        <img src={p.avatarUrl} alt={p.name} className="w-10 h-10 rounded-full object-cover bg-slate-700 flex-shrink-0" />
                                        <div className="min-w-0">
                                            <div className="flex items-baseline gap-2">
                                                <p className="font-semibold text-white text-left truncate">{p.name}</p>
                                                <p className="text-xs text-cyan-400 whitespace-nowrap">Lv. {p.level}</p>
                                            </div>
                                            <p className="text-slate-400 text-xs text-left">{playerRank.icon} {playerRank.name}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex flex-col items-end gap-1 flex-shrink-0">
                                        <p className={`text-sm font-semibold ${p.status === 'idle' ? 'text-green-400' : 'text-yellow-400'}`}>{p.status.replace('_', ' ')}</p>
                                        <div className="flex gap-1">
                                            <button onClick={() => handleStartChat(p)} className="text-xs text-white font-bold px-2 py-1 rounded bg-blue-500 hover:bg-blue-400">Chat</button>
                                            {friendship === 'none' && !isCurrentUserGuest && !isTargetPlayerGuest && <button onClick={() => handleAddFriend(p)} className="text-xs text-white font-bold px-2 py-1 rounded bg-green-500 hover:bg-green-400">Add</button>}
                                            {friendship === 'pending' && <button disabled className="text-xs text-slate-300 font-bold px-2 py-1 rounded bg-slate-600 cursor-not-allowed">Pending</button>}
                                            <button onClick={() => handleInvite(p)} disabled={p.status !== 'idle' || isInvited} className="text-xs text-white font-bold px-2 py-1 rounded bg-purple-500 hover:bg-purple-400 disabled:bg-slate-600 disabled:cursor-not-allowed">{isInvited ? 'Invited' : 'Invite'}</button>
                                        </div>
                                    </div>
                                </div>
                                {p.statusMessage && (
                                    <div className="mt-2">
                                        <p className="text-slate-400 text-xs text-left italic break-words">"{p.statusMessage}"</p>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
                <Pagination currentPage={onlinePlayersPage} totalPages={totalOnlinePages} onPageChange={setOnlinePlayersPage} />
            </div>
            <div className="flex flex-col gap-6">
                 <div className="relative bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <div className="absolute top-3 right-3">
                        <div className="relative group/status">
                            <button onClick={() => setIsEditingStatus(p => !p)} className="p-1 rounded-full hover:bg-slate-600"><svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg></button>
                            {isEditingStatus && (
                                <div className="absolute top-full right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-20 p-2">
                                    <form onSubmit={(e) => { e.preventDefault(); handleStatusSubmit(); }}>
                                        <input type="text" value={statusInput} onChange={(e) => setStatusInput(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-sm" maxLength={45} autoFocus/>
                                    </form>
                                    <div className="text-xs text-slate-400 my-2">Or select a preset:</div>
                                    <div className="space-y-1">
                                        {PRESET_STATUS_MESSAGES.map(msg => <button key={msg} onClick={() => handlePresetStatusSelect(msg)} className="w-full text-left text-sm p-1 rounded hover:bg-slate-700">{msg}</button>)}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <img src={gameState.activeAvatar.url} alt="Your Avatar" className="w-16 h-16 rounded-full flex-shrink-0 border-2 border-slate-600 object-cover bg-slate-700" />
                        <div className="flex-grow min-w-0">
                            <h2 className="text-xl font-bold text-white truncate pr-8">{gameState.playerName}</h2>
                            <div className="flex items-center gap-4 mt-1">
                                <span className="font-semibold text-cyan-400 text-sm">Level {playerLevel}</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-yellow-400 font-bold text-sm">{coins}</span><span className="text-yellow-400">💰</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 italic truncate mt-2 pr-8" title={gameState.statusMessage}>{gameState.statusMessage ? `"${gameState.statusMessage}"` : ''}</p>
                     <div className="mt-3 space-y-2">
                        <div>
                            <div className="flex justify-between items-baseline text-xs text-slate-400 mb-1 px-1"><span>{rank.icon} {rank.name}</span><span>{isChallenger ? `${rank.cpInTier} CP` : `${rank.cpInTier} / 100`}</span></div>
                            <div className="w-full bg-slate-700 rounded-full h-2"><div className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full" style={{ width: `${cpPercentage}%` }}></div></div>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center mt-3">
                        <div className="p-1"><p className="text-green-400 font-bold text-lg">{onlineWins}</p><p className="text-slate-400 text-[10px] leading-tight uppercase tracking-wider">Wins</p></div>
                        <div className="p-1"><p className="text-red-400 font-bold text-lg">{onlineLosses}</p><p className="text-slate-400 text-[10px] leading-tight uppercase tracking-wider">Losses</p></div>
                        <div className="p-1"><p className="text-cyan-400 font-bold text-lg">{winRate}%</p><p className="text-slate-400 text-[10px] leading-tight uppercase tracking-wider">Win Rate</p></div>
                    </div>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 flex flex-col justify-center items-center flex-grow">
                     <h2 className="text-2xl font-bold text-white mb-4">Matchmaking</h2>
                     <p className="text-slate-400 mb-6">Find a random opponent and jump right into a game.</p>
                     <button onClick={handleFindMatch} className="w-full bg-green-500 hover:bg-green-400 text-black font-bold py-3 px-4 rounded-lg transition-all text-lg mt-auto">Find Match</button>
                </div>
            </div>
        </div>
      </div>
      
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onLogOut={logOut} />
      {user && <MatchHistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} userId={user.uid} onViewChat={handleViewHistoryChat} />}
      {user && <FriendsManager isOpen={isFriendsOpen} onClose={() => setIsFriendsOpen(false)} onStartChat={handleStartChat} friends={enrichedFriends} />}
      {user && chatTarget && <ChatBox isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} chatId={chatTarget.chatId || onlineService.getChatId(user.uid, chatTarget.uid)} currentUserId={user.uid} senderName={gameState.playerName} recipientName={chatTarget.name} recipientId={chatTarget.uid} isReadOnly={!!chatTarget.isReadOnly} />}
    </div>
  );
};

export default OnlineLobby;
