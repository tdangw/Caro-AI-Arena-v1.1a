import React, { useState, useMemo, useEffect } from 'react';
import type { BotProfile, Cosmetic, PieceStyle, PieceEffect, Avatar, GameTheme, Emoji, AnimatedEmoji, BoardStyle } from '../types';
import { useGameState } from '../context/GameStateContext';
import { BOTS, ALL_COSMETICS, getXpForNextLevel, getRankFromCp } from '../constants';
import { SettingsModal } from './game/GameModals';
import { useAuth } from '../context/AuthContext';
import { useSound } from '../hooks/useSound';
import Modal from './Modal';
import PveHistoryModal from './game/PveHistoryModal';

const FeaturedItem: React.FC<{onGoToShop: () => void, itemOffset?: number}> = ({onGoToShop, itemOffset = 0}) => {
    const { gameState } = useGameState();
    const { playSound } = useSound();
    
    const unownedItems = useMemo(() => {
        const potentialItems = ALL_COSMETICS.filter(c => !gameState.ownedCosmeticIds.includes(c.id) && c.price > 0);
        return potentialItems.length > 0 ? potentialItems : [ALL_COSMETICS.find(c => c.id === 'boom_rocket')!];
    }, [gameState.ownedCosmeticIds]);

    const [currentItemIndex, setCurrentItemIndex] = useState(() => (itemOffset % unownedItems.length));

    useEffect(() => {
        if (currentItemIndex >= unownedItems.length) {
            setCurrentItemIndex(0);
        }
    }, [unownedItems.length, currentItemIndex]);

    useEffect(() => {
        if (unownedItems.length <= 1) return;
        const timer = setInterval(() => {
            setCurrentItemIndex(prev => (prev + 1) % unownedItems.length);
        }, 5000 + itemOffset * 250);
        return () => clearInterval(timer);
    }, [unownedItems.length, itemOffset]);

    const featuredItem = unownedItems[currentItemIndex];
    if (!featuredItem) return null;

    const renderPreview = (cosmetic: Cosmetic) => {
      switch(cosmetic.type) {
          case 'piece': {
              const PieceComp = (cosmetic.item as PieceStyle).component;
              return <PieceComp className="w-14 h-14 text-cyan-300" />;
          }
          case 'effect': {
              const PreviewComp = (cosmetic.item as PieceEffect).previewComponent;
              return <div className="w-14 h-14 flex items-center justify-center text-cyan-300"><PreviewComp /></div>;
          }
           case 'theme': {
              const theme = cosmetic.item as GameTheme;
              return <div className={`w-14 h-14 rounded-md flex items-center justify-center p-2 ${theme.boardBg}`}><div className={`w-10 h-10 rounded ${theme.cellBg} border-2 ${theme.gridColor}`} /></div>;
          }
           case 'board': {
                const boardStyle = cosmetic.item as BoardStyle;
                return (
                    <div className="w-14 h-14 rounded-md flex items-center justify-center p-1 border-2" style={{ backgroundColor: boardStyle.style.backgroundColor, borderColor: boardStyle.style.borderColor, boxShadow: boardStyle.style.boxShadow as string }}>
                        <div className="w-full h-full grid grid-cols-2 gap-px bg-slate-500/50 p-px">
                            {Array(4).fill(0).map((_, i) => <div key={i} className="bg-slate-800/50"></div>)}
                        </div>
                    </div>
                )
          }
          case 'avatar': {
              return <img src={(cosmetic.item as Avatar).url} alt={cosmetic.name} className="w-14 h-14 rounded-full object-cover bg-slate-700" />;
          }
          case 'emoji': {
              return <span className="text-4xl">{(cosmetic.item as Emoji).emoji}</span>
          }
          case 'animated_emoji': {
              return <img src={(cosmetic.item as AnimatedEmoji).url} alt={cosmetic.name} className="w-14 h-14" />;
          }
          default: return null;
      }
    };

    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 w-full h-full flex flex-col items-center justify-center text-center">
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Featured Item</h3>
            <div className="w-20 h-20 flex items-center justify-center">{renderPreview(featuredItem)}</div>
            <p className="text-white font-semibold mt-1 text-sm h-10 flex items-center">{featuredItem.name}</p>
            <button onClick={() => { playSound('select'); onGoToShop(); }} className="mt-2 text-xs bg-yellow-500 text-black font-bold px-3 py-1 rounded-full hover:bg-yellow-400 transition-colors">
                Go to Shop
            </button>
        </div>
    );
}

const PlayerProfile: React.FC = () => {
    const { user } = useAuth();
    const { gameState, setPlayerName, showToast } = useGameState();
    const { playerName, playerLevel, playerXp, pveWins, pveLosses, pveDraws, activeAvatar, coins, cp } = gameState;
    const { playSound } = useSound();

    const [isEditingName, setIsEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(playerName);
    const [nameChangeError, setNameChangeError] = useState<string | null>(null);
    const [isConfirmingNameChange, setIsConfirmingNameChange] = useState(false);
    const [isSavingName, setIsSavingName] = useState(false);

    const handleNameEdit = () => {
        if (user?.isAnonymous) {
             setNameChangeError("Guests can't change their name.");
             setTimeout(() => setNameChangeError(null), 2000);
             return;
        }
        if (coins < 100) {
            setNameChangeError("Not enough coins! (100 needed)");
            setTimeout(() => setNameChangeError(null), 2000);
            return;
        }
        setIsEditingName(true);
    };

    const handleNameSubmit = () => {
        const newName = nameInput.trim();
        if (newName === playerName) {
            setIsEditingName(false);
            return;
        }
        if (newName && newName.length >= 3 && newName.length <= 15) {
            setIsConfirmingNameChange(true);
        } else {
            setNameChangeError("Name must be 3-15 characters.");
            setTimeout(() => setNameChangeError(null), 2000);
            setNameInput(playerName);
            setIsEditingName(false);
        }
    };
    
    const confirmNameChange = async () => {
        setIsSavingName(true);
        setNameChangeError(null);
        try {
            const result = await setPlayerName(nameInput.trim());
            
            if (result && result.success) {
                playSound('confirm');
                showToast('Name changed successfully!');
            } else if (result) {
                setNameChangeError(result.message);
                setTimeout(() => setNameChangeError(null), 3000);
            }
        } catch (error: any) {
            console.error("Failed to change name:", error);
            setNameChangeError(error.message || "An unexpected error occurred.");
            setTimeout(() => setNameChangeError(null), 3000);
        } finally {
            setIsSavingName(false);
            setIsConfirmingNameChange(false);
            setIsEditingName(false);
        }
    };
    
    const avatarUrl = activeAvatar.url;
    const xpForNextLevel = getXpForNextLevel(playerLevel);
    const xpPercentage = (playerXp / xpForNextLevel) * 100;
    
    const rank = getRankFromCp(cp);
    const isChallenger = rank.name === 'Thách Đấu';
    const cpPercentage = isChallenger ? 100 : (rank.cpInTier / 100) * 100;

    const totalGames = pveWins + pveLosses + pveDraws;
    const winRate = totalGames > 0 ? ((pveWins / totalGames) * 100).toFixed(2) : '0.00';

    return (
        <div className="group relative bg-slate-800/50 border border-slate-700 rounded-xl p-4 w-full h-full transition-all duration-300 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/10 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl transition-all duration-500 group-hover:scale-150"></div>
            <div className="relative z-10">
                <div className="flex items-center gap-4">
                    <img src={avatarUrl} alt="Player Avatar" className="w-16 h-16 rounded-full flex-shrink-0 border-2 border-slate-600 group-hover:border-cyan-400 transition-colors object-cover bg-slate-700" />
                    <div className="flex-grow text-left">
                        {isEditingName ? (
                            <input 
                                type="text" 
                                value={nameInput}
                                onChange={(e) => setNameInput(e.target.value)}
                                onBlur={handleNameSubmit}
                                onKeyPress={(e) => e.key === 'Enter' && handleNameSubmit()}
                                className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-lg font-bold w-full"
                                autoFocus
                                maxLength={15}
                            />
                        ) : (
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold text-white truncate">{playerName}</h2>
                                <button onClick={handleNameEdit} className="text-slate-400 hover:text-white transition-colors" title="Edit name (Costs 100 coins)">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg>
                                </button>
                            </div>
                        )}
                         <div className="flex items-center gap-4 mt-1">
                            <span className="font-semibold text-cyan-400 text-sm">Level {playerLevel}</span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-yellow-400 font-bold text-sm">{coins}</span>
                                <span className="text-yellow-400">💰</span>
                            </div>
                        </div>
                    </div>
                </div>
                 {nameChangeError && <p className="text-red-500 text-xs text-center absolute -bottom-2 left-1/2 -translate-x-1/2 w-full">{nameChangeError}</p>}
                
                <div className="mt-3 space-y-2">
                    <div>
                        <div className="flex justify-between items-baseline text-xs text-slate-400 mb-1 px-1">
                            <span className="font-semibold">XP</span>
                            <span>{playerXp} / {xpForNextLevel}</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                            <div className="bg-gradient-to-r from-cyan-400 to-blue-500 h-2 rounded-full transition-all duration-500 ease-out" style={{ width: `${xpPercentage}%` }}></div>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between items-baseline text-xs text-slate-400 mb-1 px-1">
                            <span className="font-semibold flex items-center gap-1.5">{rank.icon} {rank.name}</span>
                            <span>{isChallenger ? `${rank.cpInTier} CP` : `${rank.cpInTier} / 100`}</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                            <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500 ease-out" style={{ width: `${cpPercentage}%` }}></div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center mt-3">
                    <div className="transition-transform duration-200 hover:scale-110 p-1 rounded-lg">
                        <p className="text-green-400 font-bold text-sm">{pveWins}</p>
                        <p className="text-slate-400 text-[10px] leading-tight uppercase tracking-wider">Wins</p>
                    </div>
                    <div className="transition-transform duration-200 hover:scale-110 p-1 rounded-lg">
                        <p className="text-red-400 font-bold text-sm">{pveLosses}</p>
                        <p className="text-slate-400 text-[10px] leading-tight uppercase tracking-wider">Losses</p>
                    </div>
                    <div className="transition-transform duration-200 hover:scale-110 p-1 rounded-lg">
                        <p className="text-cyan-400 font-bold text-sm">{winRate}%</p>
                        <p className="text-slate-400 text-[10px] leading-tight uppercase tracking-wider">Win Rate</p>
                    </div>
                </div>
            </div>
             <Modal isOpen={isConfirmingNameChange} onClose={() => setIsConfirmingNameChange(false)} title="Confirm Name Change">
                <div className="text-center">
                    <p className="text-slate-300 mb-6">Are you sure you want to change your name to <strong className="text-white">{nameInput.trim()}</strong>? This will cost <strong className="text-yellow-400">100 💰</strong>.</p>
                    <div className="flex justify-center gap-4">
                        <button onClick={() => { playSound('select'); setIsConfirmingNameChange(false); setIsEditingName(false); }} className="bg-slate-600 hover:bg-slate-500 font-bold py-2 px-6 rounded-lg transition-colors">Cancel</button>
                        <button onClick={confirmNameChange} disabled={isSavingName} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-6 rounded-lg transition-colors disabled:bg-slate-500">
                            {isSavingName ? 'Saving...' : 'Confirm'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

const BotCard: React.FC<{
  bot: BotProfile;
  onChallenge: () => void;
  stats: { wins: number; losses: number; draws: number };
}> = ({ bot, onChallenge, stats }) => {
    const borderColorMap = {
        easy: 'border-green-500',
        medium: 'border-purple-500',
        hard: 'border-orange-500',
    };
    const borderColor = borderColorMap[bot.skillLevel];

    const totalGames = stats.wins + stats.losses + stats.draws;
    const winRate = totalGames > 0 ? ((stats.wins / totalGames) * 100).toFixed(2) : '0.00';


    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center transition-all duration-300 flex flex-col backdrop-blur-sm hover:border-cyan-400">
            <img src={bot.avatar} alt={bot.name} className={`w-16 h-16 rounded-full mx-auto mb-3 border-2 ${borderColor} object-cover bg-slate-700`}/>
            <h3 className="text-lg font-bold text-white mb-1">{bot.name}</h3>
            <p className="text-slate-400 text-xs mb-3 flex-grow">{bot.description}</p>
            
            <div className="grid grid-cols-3 gap-1 text-center mb-4 text-xs">
                <div>
                    <p className="font-bold text-green-400">{stats.wins}</p>
                    <p className="text-slate-500 tracking-wider text-[10px]">WINS</p>
                </div>
                <div>
                    <p className="font-bold text-red-400">{stats.losses}</p>
                    <p className="text-slate-500 tracking-wider text-[10px]">LOSSES</p>
                </div>
                <div>
                    <p className="font-bold text-cyan-400">{winRate}%</p>
                    <p className="text-slate-500 tracking-wider text-[10px]">WIN RATE</p>
                </div>
            </div>

            <button
                onClick={onChallenge}
                className="mt-auto w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-2 px-3 rounded-lg transition-all text-sm"
            >
                Challenge
            </button>
        </div>
    );
};


interface MainMenuProps {
  onStartGame: (bot: BotProfile) => void;
  onGoToShop: () => void;
  onGoToInventory: () => void;
  onGoToOnline: () => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onStartGame, onGoToShop, onGoToInventory, onGoToOnline }) => {
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [isPveHistoryOpen, setIsPveHistoryOpen] = useState(false);
  const { playSound } = useSound();
  const { user, logOut } = useAuth();
  const { gameState } = useGameState();

  const handleChallengeClick = (bot: BotProfile) => {
    playSound('select');
    onStartGame(bot);
  }

  const handleSettingsClick = () => {
    playSound('select');
    setIsSettingsModalOpen(true);
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-6 flex flex-col items-center justify-start overflow-y-auto relative pt-4 sm:pt-6 md:pt-8">
       <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22%231e293b%22%20fill-opacity%3D%220.4%22%20fill-rule%3D%22evenodd%22%3E%3Cpath%20d%3D%22M0%2040L40%200H20L0%2020M40%2040V20L20%2040%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50"></div>
       
       <div className="w-full max-w-5xl text-center z-10 flex flex-col items-center">
            <h1 className="text-5xl md:text-6xl font-black text-white mb-1">
                Caro <span className="text-cyan-400">AI Arena</span>
            </h1>
            <p className="text-slate-400 text-md mb-6 md:mb-8">Five in a row. Infinite possibilities.</p>
            
            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <PlayerProfile />
                <FeaturedItem onGoToShop={onGoToShop} itemOffset={0} />
            </div>

            <div className="w-full max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 md:mb-8">
                <button
                    onClick={onGoToShop}
                    className="w-full h-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold p-3 rounded-lg text-base transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center justify-center min-h-[60px] md:min-h-[70px]"
                >
                    Shop 🛒
                </button>
                <button
                    onClick={onGoToInventory}
                    className="w-full h-full bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-400 hover:to-blue-400 text-white font-bold p-3 rounded-lg text-base transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center justify-center min-h-[60px] md:min-h-[70px]"
                >
                    Inventory 🎒
                </button>
                <button
                    onClick={handleSettingsClick}
                    className="w-full h-full bg-slate-700 hover:bg-slate-600 text-white font-bold p-3 rounded-lg text-base transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center justify-center min-h-[60px] md:min-h-[70px]"
                >
                    Settings ⚙️
                </button>
                <button
                    onClick={onGoToOnline}
                    className="w-full h-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white font-bold p-3 rounded-lg text-base transition-all duration-300 shadow-lg flex items-center justify-center transform hover:scale-105 min-h-[60px] md:min-h-[70px]"
                >
                    Play Online 🌎
                </button>
            </div>

            <div className="w-full max-w-4xl">
                <div className="flex justify-between items-center w-full mb-4 px-2">
                    <div className="w-1/3 text-left">
                         <div className="author-text flex items-center gap-1.5">
                            <span className="author-name">Developed by: tdangw</span>
                            <span>&bull;</span>
                            <button
                                onClick={() => { playSound('select'); setIsVersionModalOpen(true); }}
                                className="version-button"
                            >
                                v1.1a
                            </button>
                        </div>
                    </div>
                    <h2 className="w-1/3 text-2xl font-bold text-center whitespace-nowrap">Choose Your Opponent</h2>
                    <div className="w-1/3 text-right">
                        <button 
                            onClick={() => { playSound('select'); setIsPveHistoryOpen(true); }}
                            className="text-sm font-medium text-slate-400 hover:text-cyan-400 transition-colors"
                        >
                            PVE History
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {BOTS.map(bot => {
                        const botStats = gameState.botStats[bot.id] || { wins: 0, losses: 0, draws: 0 };
                        return <BotCard key={bot.id} bot={bot} onChallenge={() => handleChallengeClick(bot)} stats={botStats} />
                    })}
                </div>
            </div>
       </div>

        <SettingsModal 
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
            onLogOut={user ? logOut : undefined}
        />
        
        <PveHistoryModal 
            isOpen={isPveHistoryOpen}
            onClose={() => setIsPveHistoryOpen(false)}
        />

        <Modal
            isOpen={isVersionModalOpen}
            onClose={() => setIsVersionModalOpen(false)}
            title="Thông tin phiên bản v1.1a"
            size="md"
        >
            <div className="text-slate-300 space-y-3">
                <ul className="list-disc list-inside space-y-2 text-left">
                    <li>
                        <strong>Đấu với AI:</strong> AI thông minh có nhiều cấp độ khó, phản ứng linh hoạt.
                    </li>
                    <li>
                        <strong>Chơi Online:</strong> Thách đấu với người chơi khác để leo lên mức Rank cao.
                    </li>
                    <li>
                        <strong>Bảng xếp hạng:</strong> hiện có 7 cấp bậc: Sắt → Đồng → Bạc → Vàng → Kim Cương → Cao thủ → Thách đấu.
                    </li>
                    <li>
                        <strong>Themes:</strong> 7 chủ đề: Summer, Spring, Autumn, Winter, Ice, Retro, Ruby, kèm hiệu ứng động (ánh sáng, sao băng, lá bay...).
                    </li>
                    <li>
                        Các nền đều được tinh chỉnh độ tương phản để hiển thị bàn cờ rõ nét.
                    </li>
                </ul>
                 <div className="pt-4 flex justify-center">
                    <button onClick={() => { playSound('select'); setIsVersionModalOpen(false); }} className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-2 px-4 rounded-lg transition-colors">
                        Đóng
                    </button>
                </div>
            </div>
        </Modal>
        <style>{`
            .author-text {
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
                font-size: 0.75rem; /* text-xs */
                line-height: 1rem;
                color: hsl(222, 14%, 45%); /* Darker slate-ish color */
                text-shadow: 1px 1px 1px hsl(222, 47%, 11%, 0.6); /* Inset shadow */
            }
            .author-name, .version-button {
                transition: all 0.3s ease;
            }
            .author-name:hover, .version-button:hover {
                color: hsl(215, 28%, 85%); /* Lighter slate */
                text-shadow: 0 0 6px hsl(215, 28%, 85%, 0.7), 0 0 10px hsl(188, 93%, 67%, 0.5); /* Glow effect */
            }
        `}</style>
    </div>
  );
};

export default MainMenu;
