// FIX: Corrected import statement for React hooks.
import React, { useState, useCallback, useEffect, useRef, useMemo, Suspense } from 'react';
import { GameStateProvider, useGameState } from './context/GameStateContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import type { BotProfile, Invitation, OnlineGame, Cosmetic, PieceStyle, Avatar, Emoji, GameTheme, PieceEffect, VictoryEffect, BoomEffect, Notification, AnimatedEmoji, BoardStyle } from './types';
import { useSound } from './hooks/useSound';
import * as onlineService from './services/onlineService';
import Modal from './components/Modal';
import RankChangeModal from './components/RankChangeModal';
import { ALL_COSMETICS } from './constants';

// Lazy-load major components for code-splitting
const MainMenu = React.lazy(() => import('./components/MainMenu'));
const GameScreen = React.lazy(() => import('./components/game/GameScreen'));
const Shop = React.lazy(() => import('./components/Shop'));
const Inventory = React.lazy(() => import('./components/Inventory'));
const AuthScreen = React.lazy(() => import('./components/AuthScreen'));
const OnlineLobby = React.lazy(() => import('./components/OnlineLobby'));
const VersusScreen = React.lazy(() => import('./components/game/VersusScreen'));


type View = 'menu' | 'pve_game' | 'shop' | 'inventory' | 'lobby' | 'online_game' | 'versus_game';
type Overlay = 'shop' | 'inventory' | null;

const ACTIVE_PVE_GAME_BOT_KEY = 'caroActivePveGame_bot';
const ACTIVE_PVE_GAME_STATE_KEY = 'caroGameState_inProgress';

// FIX: Moved IDLE_TIMEOUT_MS to a higher scope so it is accessible to resetIdleTimer.
const IDLE_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

const LoadingScreen: React.FC = () => (
    <div className="min-h-screen bg-slate-900 text-white p-4 flex flex-col items-center justify-center text-center">
        <h1 className="text-6xl md:text-8xl font-black text-white mb-2">
            Caro <span className="text-cyan-400">AI Arena</span>
        </h1>
        <p className="text-slate-400 text-xl mt-4">Loading...</p>
    </div>
);

const ItemPreview: React.FC<{ cosmetic: Cosmetic }> = React.memo(({ cosmetic }) => {
    switch (cosmetic.type) {
        case 'piece': { const PieceComp = (cosmetic.item as PieceStyle).component; return <PieceComp className="w-full h-full text-cyan-300" />; }
        case 'avatar': return <img src={(cosmetic.item as Avatar).url} alt={cosmetic.name} className="w-full h-full rounded-md object-cover bg-slate-700" />;
        case 'emoji': return <span className="text-3xl">{(cosmetic.item as Emoji).emoji}</span>
        case 'animated_emoji': return <img src={(cosmetic.item as AnimatedEmoji).url} alt={cosmetic.name} className="w-full h-full" />;
        case 'theme': {
            const theme = cosmetic.item as GameTheme;
            return (
                <div className={`w-full h-full rounded-md flex items-center justify-center p-1 bg-cover bg-center ${theme.boardBg}`} style={theme.boardBgImage ? { backgroundImage: `url(${theme.boardBgImage})` } : {}}>
                    <div className={`w-8 h-8 rounded-sm ${theme.cellBg} border ${theme.gridColor}`} />
                </div>
            );
        }
        case 'board': {
            const boardStyle = cosmetic.item as BoardStyle;
            return (
                <div className="w-full h-full rounded-md flex items-center justify-center p-1 border" style={{ backgroundColor: boardStyle.style.backgroundColor, borderColor: boardStyle.style.borderColor, boxShadow: boardStyle.style.boxShadow as string }}>
                    <div className="w-full h-full grid grid-cols-2 gap-px bg-slate-500/50 p-px">
                        {Array(4).fill(0).map((_, i) => <div key={i} className="bg-slate-800/50"></div>)}
                    </div>
                </div>
            )
        }
        case 'effect': { const PreviewComp = (cosmetic.item as PieceEffect).previewComponent; return <div className="w-full h-full flex items-center justify-center text-cyan-300"><PreviewComp /></div>; }
        case 'victory': { const PreviewComp = (cosmetic.item as VictoryEffect).previewComponent; return <div className="w-full h-full flex items-center justify-center text-cyan-300"><PreviewComp /></div>; }
        case 'boom': { const PreviewComp = (cosmetic.item as BoomEffect).previewComponent; return <div className="w-full h-full flex items-center justify-center text-cyan-300"><PreviewComp /></div>; }
        default: return <span className="text-3xl">🎁</span>;
    }
});

const ToastNotification: React.FC<{ toast: { message: string; type?: 'success' | 'error', cosmeticId?: string } }> = ({ toast }) => {
    const { message, type = 'success', cosmeticId } = toast;
    const cosmetic = cosmeticId ? ALL_COSMETICS.find(c => c.id === cosmeticId) : null;
    
    const borderColor = type === 'success' ? 'border-cyan-500' : 'border-red-500';
    const icon = type === 'success' ? (
        <svg className="w-6 h-6 text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ) : (
        <svg className="w-6 h-6 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    );

    return (
        <div className={`fixed top-[50%] -translate-y-1/2 left-1/2 -translate-x-1/2 bg-slate-800/80 backdrop-blur-md border ${borderColor} shadow-lg rounded-xl p-3 w-full max-w-sm animate-toast-in-out z-[101] flex items-center gap-4`} style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)'}}>
            {icon}
            {cosmetic && (
                <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-slate-700/50 rounded-md p-1 border border-slate-600">
                    <ItemPreview cosmetic={cosmetic} />
                </div>
            )}
            <p className="text-sm text-white font-semibold flex-grow text-left">{message}</p>
            <style>{`
                @keyframes toast-in-out {
                    0% { transform: translate(-50%, 50%); opacity: 0; }
                    10%, 90% { transform: translate(-50%, -50%); opacity: 1; }
                    100% { transform: translate(-50%, -150%); opacity: 0; }
                }
                .animate-toast-in-out { animation: toast-in-out 4s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
            `}</style>
        </div>
    );
};

const MessageToast: React.FC<{ toast: Notification | null }> = ({ toast }) => {
    if (!toast) return null;

    const isGift = toast.type === 'gift';
    const cosmetic = toast.cosmeticId ? ALL_COSMETICS.find(c => c.id === toast.cosmeticId) : null;

    const messageText = useMemo(() => {
        if (!toast) return '';

        if (toast.type === 'tease' && toast.emoji) {
            const isUrl = toast.emoji.startsWith('assets/');
            return (
                <>
                    {` ${toast.text} `}
                    {isUrl ? <img src={toast.emoji} alt="emoji" className="inline-block w-5 h-5 align-middle" /> : <span className="align-middle">{toast.emoji}</span>}
                </>
            );
        }

        if (toast.type === 'message' && !toast.text.startsWith('reacted with')) {
            return ` says: "${toast.text}"`;
        }
        return ` ${toast.text}`;
    }, [toast]);

    return (
        <div className="fixed top-[122px] left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-sm border border-cyan-500/50 shadow-lg rounded-lg p-3 w-full max-w-sm animate-toast-fade z-[101] flex items-center">
            {isGift && cosmetic && (
                <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-slate-700/50 rounded-md p-1 border border-slate-600 mr-3">
                    <ItemPreview cosmetic={cosmetic} />
                </div>
            )}
            <p className="text-sm text-slate-200">
                <strong className="text-cyan-400">{toast.senderName}</strong>
                {messageText}
            </p>
            <style>{`
                @keyframes toast-fade {
                    0%, 100% { opacity: 0; }
                    10%, 90% { opacity: 1; }
                }
                .animate-toast-fade { animation: toast-fade 5s ease-in-out; }
            `}</style>
        </div>
    );
};


const AppContent: React.FC = () => {
    const { user, logOut } = useAuth();
    const [view, setView] = useState<View>('menu');
    const [activeBot, setActiveBot] = useState<BotProfile | null>(null);
    const [activeOnlineGameId, setActiveOnlineGameId] = useState<string | null>(null);
    const [versusGame, setVersusGame] = useState<OnlineGame | null>(null);
    const [overlay, setOverlay] = useState<Overlay | null>(null);
    const [isRejoining, setIsRejoining] = useState(true);

    const { gameState, rankNotification, clearRankNotification } = useGameState();
    const { playSound, playMusic, stopMusic } = useSound();

    // --- Global Invitation State ---
    const [invitation, setInvitation] = useState<Invitation | null>(null);
    const [inviteCountdown, setInviteCountdown] = useState(10);

    // --- Refs for state management during transitions ---
    const isExitingOnlineGameRef = useRef(false);
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleLogout = useCallback(() => {
        if (user) { 
            console.log("User has been idle for 24 hours. Logging out.");
            logOut();
        }
    }, [user, logOut]);

    const resetIdleTimer = useCallback(() => {
        if (idleTimerRef.current) {
            clearTimeout(idleTimerRef.current);
        }
        idleTimerRef.current = setTimeout(handleLogout, IDLE_TIMEOUT_MS);
    }, [handleLogout]);

    useEffect(() => {
        if (!user) {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            return;
        }

        const activityEvents: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
        
        resetIdleTimer();

        activityEvents.forEach(event => {
            window.addEventListener(event, resetIdleTimer);
        });

        return () => {
            if (idleTimerRef.current) {
                clearTimeout(idleTimerRef.current);
            }
            activityEvents.forEach(event => {
                window.removeEventListener(event, resetIdleTimer);
            });
        };
    }, [resetIdleTimer, user]);


    // Run once on initial load to check for and rejoin any active games.
    useEffect(() => {
        const rejoinActiveGame = async () => {
            if (user) {
                const player = await onlineService.getOnlineUser(user.uid);
                if (player?.status === 'in_game' && player.gameId) {
                    console.log(`Rejoining active online game: ${player.gameId}`);
                    onStartOnlineGame(player.gameId); // Use the main function to handle state transition
                    setIsRejoining(false);
                    return; 
                }
            }

            try {
                const savedBot = localStorage.getItem(ACTIVE_PVE_GAME_BOT_KEY);
                const savedGameState = localStorage.getItem(ACTIVE_PVE_GAME_STATE_KEY);
                if (savedBot && savedGameState) {
                    const botProfile = JSON.parse(savedBot);
                    setActiveBot(botProfile);
                    setView('pve_game');
                    setIsRejoining(false);
                    return;
                }
            } catch {
                localStorage.removeItem(ACTIVE_PVE_GAME_BOT_KEY);
                localStorage.removeItem(ACTIVE_PVE_GAME_STATE_KEY);
            }
            
            setView('menu');
            setIsRejoining(false);
        };
        
        rejoinActiveGame();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);


    useEffect(() => {
        if (view === 'menu' || view === 'pve_game' || view === 'lobby' || view === 'online_game') {
            playMusic();
        } else {
            stopMusic();
        }
    }, [view, playMusic, stopMusic]);
    
    // Global listener for invitations
    useEffect(() => {
        if (!user) return;
        const unsubscribe = onlineService.listenForInvitations(user.uid, (inv) => {
          if(inv) playSound('select');
          setInvitation(inv);
        });
        return () => unsubscribe();
    }, [user, playSound]);

    const handleDeclineInvite = useCallback(() => {
        if (!user) return;
        playSound('select');
        onlineService.declineInvitation(user.uid);
        setInvitation(null);
    }, [user, playSound]);

    useEffect(() => {
        if (invitation) {
            setInviteCountdown(10);
            const timerId = setInterval(() => {
                setInviteCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(timerId);
                        handleDeclineInvite();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timerId);
        }
    }, [invitation, handleDeclineInvite]);
    
    const handleAcceptInvite = async () => {
        if (!user || !invitation) return;
        const gameId = await onlineService.acceptInvitation(user, invitation);
        if (gameId) {
            onStartOnlineGame(gameId);
        }
        setInvitation(null);
    };

    const handleStartPVEGame = useCallback((bot: BotProfile) => {
        try {
            playSound('select');
            localStorage.setItem(ACTIVE_PVE_GAME_BOT_KEY, JSON.stringify(bot));
            setActiveBot(bot);
            setView('pve_game');
        } catch (error) {
            console.error("Failed to save active bot:", error);
        }
    }, [playSound]);

    const handleGoToShop = useCallback(() => { playSound('select'); setView('shop'); }, [playSound]);
    const handleGoToInventory = useCallback(() => { playSound('select'); setView('inventory'); }, [playSound]);

    const handleBackToMenu = useCallback(() => {
        playSound('select');
        setView('menu');
        setActiveBot(null);
        setOverlay(null);
        setActiveOnlineGameId(null);
        setVersusGame(null);
    }, [playSound]);

    const handleGoToOnline = () => {
        playSound('select');
        setView('lobby');
    };
    
    // FIX: Wrapped onStartOnlineGame in useCallback to prevent it from being recreated
    // on every render. This stabilizes the reference passed to OnlineLobby and prevents
    // unnecessary re-running of useEffects that depend on it.
    const onStartOnlineGame = useCallback(async (gameId: string) => {
        const game = await onlineService.getOnlineGame(gameId);
        if (game) {
            isExitingOnlineGameRef.current = false;
            setVersusGame(game);
            setActiveOnlineGameId(gameId);
            setView('versus_game');
            playSound('confirm');
        } else {
            console.error(`Failed to start game: Game data for ${gameId} not found.`);
            if (user) onlineService.returnToLobby(user.uid);
            setView('lobby');
        }
    }, [user, setView, setVersusGame, setActiveOnlineGameId, playSound]);
    
    const handleOpenShopOverlay = () => { playSound('select'); setOverlay('shop'); };
    const handleOpenInventoryOverlay = () => { playSound('select'); setOverlay('inventory'); };
    const handleCloseOverlay = () => { playSound('select'); setOverlay(null); };

    const handleGameEnd = useCallback(() => {
        if (view === 'online_game' || view === 'versus_game') {
            isExitingOnlineGameRef.current = true; // Activate the lock
            if (user) {
                onlineService.returnToLobby(user.uid);
            }
            setView('lobby');
            setActiveOnlineGameId(null); // Clear the ID to unmount GameScreen
            setVersusGame(null);
        } else {
            handleBackToMenu();
        }
    }, [view, handleBackToMenu, user]);

    if (isRejoining) {
        return <LoadingScreen />;
    }
    
    const renderView = () => {
        switch (view) {
            case 'lobby':
                return <OnlineLobby onStartGame={onStartOnlineGame} onBack={handleBackToMenu} />;
            case 'versus_game':
                if (!versusGame || !user) {
                    setView('lobby');
                    return <LoadingScreen/>;
                }
                return <VersusScreen game={versusGame} currentUserId={user.uid} onGameStart={() => setView('online_game')} />;
            case 'online_game':
                if (!activeOnlineGameId || !user) {
                    setView('lobby');
                    return <LoadingScreen/>;
                }
                return <GameScreen 
                            key={activeOnlineGameId}
                            gameMode="online"
                            onlineGameId={activeOnlineGameId}
                            onExit={handleGameEnd} 
                            theme={gameState.activeTheme} 
                            pieces={{ X: gameState.activePieceX, O: gameState.activePieceO }}
                            playerInfo={{name: gameState.playerName, level: gameState.playerLevel, avatar: gameState.activeAvatar, xp: gameState.playerXp, wins: gameState.onlineWins, losses: gameState.onlineLosses}}
                            activeEffect={gameState.activeEffect}
                            activeVictoryEffect={gameState.activeVictoryEffect}
                            activeBoomEffect={gameState.activeBoomEffect}
                            // FIX: Pass the activeBoard prop to GameScreen.
                            activeBoard={gameState.activeBoard}
                            isPaused={!!overlay}
                            onOpenShop={handleOpenShopOverlay}
                            onOpenInventory={handleOpenInventoryOverlay}
                        />;
            case 'pve_game':
                if (!activeBot) {
                    handleBackToMenu();
                    return null;
                }
                return <GameScreen 
                            key={activeBot.id}
                            gameMode="pve"
                            bot={activeBot} 
                            onExit={handleGameEnd} 
                            theme={gameState.activeTheme} 
                            pieces={{ X: gameState.activePieceX, O: gameState.activePieceO }}
                            playerInfo={{name: gameState.playerName, level: gameState.playerLevel, avatar: gameState.activeAvatar, xp: gameState.playerXp, wins: gameState.pveWins, losses: gameState.pveLosses}}
                            activeEffect={gameState.activeEffect}
                            activeVictoryEffect={gameState.activeVictoryEffect}
                            activeBoomEffect={gameState.activeBoomEffect}
                            // FIX: Pass the activeBoard prop to GameScreen.
                            activeBoard={gameState.activeBoard}
                            isPaused={!!overlay}
                            onOpenShop={handleOpenShopOverlay}
                            onOpenInventory={handleOpenInventoryOverlay}
                        />;
            case 'shop':
                return <Shop onBack={handleBackToMenu} />;
            case 'inventory':
                return <Inventory onBack={handleBackToMenu} />;
            case 'menu':
            default:
                return <MainMenu 
                            onStartGame={handleStartPVEGame}
                            onGoToShop={handleGoToShop} 
                            onGoToInventory={handleGoToInventory}
                            onGoToOnline={handleGoToOnline}
                        />;
        }
    };

    return (
        <div className="bg-slate-900 relative animate-app-fade-in">
            <Suspense fallback={<LoadingScreen />}>
                {renderView()}
                {overlay && (
                    <div className="fixed inset-0 z-50 bg-black/70 p-4 sm:p-8 overflow-y-auto">
                        {overlay === 'shop' && <Shop onBack={handleCloseOverlay} />}
                        {overlay === 'inventory' && <Inventory onBack={handleCloseOverlay} />}
                    </div>
                )}
            </Suspense>

            <Modal isOpen={!!invitation} title="Incoming Challenge!">
                {invitation && (
                    <div className='text-center'>
                        <p className="text-slate-300 mb-6"><strong className='text-white'>{invitation.fromName}</strong> has challenged you to a match! <span className="text-slate-400">({inviteCountdown}s)</span></p>
                        <div className='flex justify-center gap-4'>
                            <button onClick={handleDeclineInvite} className="bg-red-600 hover:bg-red-500 font-bold py-2 px-6 rounded-lg transition-colors">Decline</button>
                            <button onClick={handleAcceptInvite} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-6 rounded-lg transition-colors">Accept</button>
                        </div>
                    </div>
                )}
            </Modal>
            
            <RankChangeModal notification={rankNotification} onClose={clearRankNotification} />
            
            {gameState.toast && <ToastNotification key={gameState.toast.id} toast={gameState.toast} />}
            <MessageToast toast={gameState.messageToast} />

            <style>{`
                @keyframes app-fade-in {
                    from { opacity: 0; transform: scale(0.97); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-app-fade-in { animation: app-fade-in 0.6s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
            `}</style>
        </div>
    );
}

const AppController: React.FC = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return <LoadingScreen />;
    }

    return (
        <Suspense fallback={<LoadingScreen />}>
            {user ? <AppContent /> : <AuthScreen />}
        </Suspense>
    );
}


export default function App() {
    return (
        <AuthProvider>
            <GameStateProvider>
                <AppController />
            </GameStateProvider>
        </AuthProvider>
    );
}
