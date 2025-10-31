import React, { useState, useEffect } from 'react';
import type { Cosmetic, PieceStyle, Avatar, Emoji, GameTheme, PieceEffect, VictoryEffect, BoomEffect, LockerItem, BoardStyle, AnimatedEmoji } from '../types';
import { ALL_COSMETICS, DEFAULT_PIECES_X, DEFAULT_PIECES_O, DEFAULT_AVATAR, DEFAULT_THEME, DEFAULT_EFFECT, PIECE_STYLES, AVATARS, EMOJIS, THEMES, PIECE_EFFECTS, DEFAULT_VICTORY_EFFECT, DEFAULT_BOOM_EFFECT, VICTORY_EFFECTS, BOOM_EFFECTS, DEFAULT_BOARD_STYLE, BOARD_STYLES, ANIMATED_EMOJIS } from '../constants';
import { useGameState } from '../context/GameStateContext';
import { useSound } from '../hooks/useSound';
import LockerTab from './inventory/LockerTab';
import * as onlineService from '../services/onlineService';
import { useAuth } from '../context/AuthContext';

type InventoryCategory = 'Skins' | 'Avatars' | 'Emojis' | 'Themes' | 'Boards' | 'Effects' | 'Victory' | 'Booms' | 'Locker';

const Inventory: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { user } = useAuth();
  const { gameState, equipPiece, equipAvatar, equipTheme, equipEffect, equipVictoryEffect, equipBoomEffect, equipBoard, claimGift } = useGameState();
  const { playSound } = useSound();
  const [activeTab, setActiveTab] = useState<InventoryCategory>('Skins');
  const [lockerItems, setLockerItems] = useState<LockerItem[]>([]);
  const [displayedCount, setDisplayedCount] = useState(10);

  useEffect(() => {
    setDisplayedCount(10); // Reset count when tab changes
  }, [activeTab]);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onlineService.listenForLocker(user.uid, setLockerItems);
    return () => unsubscribe();
  }, [user]);


  const cosmeticTypeMap: Record<string, 'piece' | 'avatar' | 'emoji' | 'animated_emoji' | 'theme' | 'effect' | 'victory' | 'boom' | 'board' | 'locker'> = {
    Skins: 'piece',
    Avatars: 'avatar',
    Emojis: 'emoji',
    Themes: 'theme',
    Boards: 'board',
    Effects: 'effect',
    Victory: 'victory',
    Booms: 'boom',
    Locker: 'locker',
  };

  const allPossibleCosmetics: Cosmetic[] = [
    ...PIECE_STYLES.map((p) => ({ id: p.id, name: p.name, type: 'piece' as const, price: 0, item: p })),
    ...AVATARS.map(a => ({ id: a.id, name: a.name, type: 'avatar' as const, price: 0, item: a})),
    ...EMOJIS.map(e => ({ id: e.id, name: e.name, type: 'emoji' as const, price: 0, item: e })),
    ...ANIMATED_EMOJIS.map(e => ({ id: e.id, name: e.name, type: 'animated_emoji' as const, price: 0, item: e })),
    ...THEMES.map(t => ({ id: t.id, name: t.name, type: 'theme' as const, price: 0, item: t })),
    ...BOARD_STYLES.map(b => ({ id: b.id, name: b.name, type: 'board' as const, price: 0, item: b })),
    ...PIECE_EFFECTS.map(e => ({ id: e.id, name: e.name, type: 'effect' as const, price: 0, item: e })),
    ...VICTORY_EFFECTS.map(e => ({ id: e.id, name: e.name, type: 'victory' as const, price: 0, item: e })),
    ...BOOM_EFFECTS.map(e => ({ id: e.id, name: e.name, type: 'boom' as const, price: 0, item: e })),
     { id: DEFAULT_PIECES_X.id, name: DEFAULT_PIECES_X.name, type: 'piece', price: 0, item: DEFAULT_PIECES_X },
     // FIX: Add the default 'O' piece to ensure it can be found and rendered in the inventory.
     { id: DEFAULT_PIECES_O.id, name: DEFAULT_PIECES_O.name, type: 'piece', price: 0, item: DEFAULT_PIECES_O },
     { id: DEFAULT_AVATAR.id, name: DEFAULT_AVATAR.name, type: 'avatar', price: 0, item: DEFAULT_AVATAR },
     { id: DEFAULT_THEME.id, name: DEFAULT_THEME.name, type: 'theme', price: 0, item: DEFAULT_THEME },
     { id: DEFAULT_BOARD_STYLE.id, name: DEFAULT_BOARD_STYLE.name, type: 'board', price: 0, item: DEFAULT_BOARD_STYLE },
     { id: DEFAULT_EFFECT.id, name: DEFAULT_EFFECT.name, type: 'effect', price: 0, item: DEFAULT_EFFECT },
     { id: DEFAULT_VICTORY_EFFECT.id, name: DEFAULT_VICTORY_EFFECT.name, type: 'victory', price: 0, item: DEFAULT_VICTORY_EFFECT },
     { id: DEFAULT_BOOM_EFFECT.id, name: DEFAULT_BOOM_EFFECT.name, type: 'boom', price: 0, item: DEFAULT_BOOM_EFFECT },
  ];
    
  const allItemsMap = new Map<string, Cosmetic>();
  allPossibleCosmetics.forEach(item => {
    if (!allItemsMap.has(item.id)) {
        allItemsMap.set(item.id, item)
    }
  });

  const ownedPermanentItems = gameState.ownedCosmeticIds
    .map(id => allItemsMap.get(id))
    .filter((c): c is Cosmetic => c !== undefined);
  
  const ownedConsumableItems = Object.keys(gameState.emojiInventory)
    .map(id => allItemsMap.get(id))
    .filter((c): c is Cosmetic => c !== undefined && (gameState.emojiInventory[c.id] || 0) > 0);
  
  const ownedItems = [...ownedPermanentItems, ...ownedConsumableItems];
  const uniqueOwnedItems = Array.from(new Map(ownedItems.map(item => [item.id, item])).values());

  const filteredCosmetics = uniqueOwnedItems.filter(c => {
    if (activeTab === 'Emojis') {
        return c.type === 'emoji' || c.type === 'animated_emoji';
    }
    return c.type === cosmeticTypeMap[activeTab as InventoryCategory]
  });


   const renderItemPreview = (cosmetic: Cosmetic) => {
      switch(cosmetic.type) {
          case 'piece': {
              const PieceComp = (cosmetic.item as PieceStyle).component;
              return <PieceComp className="w-16 h-16 text-cyan-300" />;
          }
          case 'avatar': {
              return <img src={(cosmetic.item as Avatar).url} alt={cosmetic.name} className="w-16 h-16 rounded-full object-cover bg-slate-700" />;
          }
          case 'emoji':
              return <span className="text-4xl">{(cosmetic.item as Emoji).emoji}</span>
          case 'animated_emoji':
              return <img src={(cosmetic.item as AnimatedEmoji).url} alt={cosmetic.name} className="w-16 h-16" />
          case 'theme': {
              const theme = cosmetic.item as GameTheme;
              return (
                <div 
                    className={`w-16 h-16 rounded-md flex items-center justify-center p-2 bg-cover bg-center ${theme.boardBg}`}
                    style={theme.boardBgImage ? { 
                        backgroundImage: `url(${theme.boardBgImage})`,
                    } : {}}
                >
                    <div className={`w-10 h-10 rounded ${theme.cellBg} border-2 ${theme.gridColor}`} />
                </div>);
          }
          case 'board': {
                const boardStyle = cosmetic.item as BoardStyle;
                return (
                    <div className="w-16 h-16 rounded-md flex items-center justify-center p-1 border-2" style={{ backgroundColor: boardStyle.style.backgroundColor, borderColor: boardStyle.style.borderColor, boxShadow: boardStyle.style.boxShadow as string }}>
                        <div className="w-full h-full grid grid-cols-3 gap-px bg-slate-500/50 p-px">
                            {Array(9).fill(0).map((_, i) => <div key={i} className="bg-slate-800/50"></div>)}
                        </div>
                    </div>
                )
          }
          case 'effect': {
              const PreviewComp = (cosmetic.item as PieceEffect).previewComponent;
              return <div className="w-16 h-16 flex items-center justify-center text-cyan-300"><PreviewComp /></div>;
          }
          case 'victory': {
              const PreviewComp = (cosmetic.item as VictoryEffect).previewComponent;
              return <div className="w-16 h-16 flex items-center justify-center text-cyan-300"><PreviewComp /></div>;
          }
          case 'boom': {
              const PreviewComp = (cosmetic.item as BoomEffect).previewComponent;
              return <div className="w-16 h-16 flex items-center justify-center text-cyan-300"><PreviewComp /></div>;
          }
          default:
              return null;
      }
  }
  
  const renderContent = () => {
    if (activeTab === 'Locker') {
        return <LockerTab gifts={lockerItems} onClaim={claimGift} />;
    }
    if (filteredCosmetics.length > 0) {
        return (
            <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {filteredCosmetics.slice(0, displayedCount).map(cosmetic => {
                        const isActive = cosmetic.type === 'piece' 
                            ? gameState.activePieceX.id === cosmetic.id
                            : cosmetic.type === 'avatar' 
                            ? gameState.activeAvatar.id === cosmetic.id
                            : cosmetic.type === 'theme'
                            ? gameState.activeTheme.id === cosmetic.id
                            : cosmetic.type === 'board'
                            ? gameState.activeBoard.id === cosmetic.id
                            : cosmetic.type === 'effect'
                            ? gameState.activeEffect.id === cosmetic.id
                            : cosmetic.type === 'victory'
                            ? gameState.activeVictoryEffect.id === cosmetic.id
                            : cosmetic.type === 'boom'
                            ? gameState.activeBoomEffect.id === cosmetic.id
                            : false;
                        
                        const isEmoji = cosmetic.type === 'emoji' || cosmetic.type === 'animated_emoji';
                        const ownedEmojiCount = gameState.emojiInventory[cosmetic.id] || 0;
                                        
                        const handleEquip = () => {
                            playSound('select');
                            if (cosmetic.type === 'piece') {
                                equipPiece(cosmetic.item as PieceStyle);
                            } else if (cosmetic.type === 'avatar') {
                                equipAvatar(cosmetic.item as Avatar);
                            } else if (cosmetic.type === 'theme') {
                                equipTheme(cosmetic.item as GameTheme);
                            } else if (cosmetic.type === 'board') {
                                equipBoard(cosmetic.item as BoardStyle);
                            } else if (cosmetic.type === 'effect') {
                                equipEffect(cosmetic.item as PieceEffect);
                            } else if (cosmetic.type === 'victory') {
                                equipVictoryEffect(cosmetic.item as VictoryEffect);
                            } else if (cosmetic.type === 'boom') {
                                equipBoomEffect(cosmetic.item as BoomEffect);
                            }
                        }

                        return (
                        <div key={cosmetic.id} className="relative bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-4 flex flex-col items-center text-center transition-all duration-300 hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-500/10">
                            {isEmoji && ownedEmojiCount > 0 && (
                                <div className="absolute top-1 right-1 bg-blue-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-slate-800">
                                    {ownedEmojiCount}
                                </div>
                            )}
                            <div className="h-24 w-24 mb-3 flex items-center justify-center bg-slate-900/70 rounded-lg p-2">
                                {renderItemPreview(cosmetic)}
                            </div>
                            <h3 className="text-md font-semibold text-white mb-2 h-10 flex items-center justify-center">{cosmetic.name}</h3>
                            
                            {isEmoji ? (
                                <div className="w-full mt-auto py-2 px-3 rounded-lg text-sm font-semibold bg-slate-600 text-slate-300 cursor-default flex items-center justify-center gap-2">
                                    <span>Quantity:</span>
                                    <span className="font-bold text-white">{ownedEmojiCount}</span>
                                </div>
                            ) : (
                                <button
                                    onClick={handleEquip}
                                    disabled={isActive}
                                    className={`w-full mt-auto py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                                        isActive 
                                        ? 'bg-green-500 text-white cursor-not-allowed' 
                                        : 'bg-cyan-500 hover:bg-cyan-400 text-black'
                                    }`}
                                >
                                    {isActive ? 'Equipped' : 'Equip'}
                                </button>
                            )}
                        </div>
                        );
                    })}
                </div>
                {filteredCosmetics.length > displayedCount && (
                    <div className="text-center mt-6">
                        <button onClick={() => setDisplayedCount(prev => prev + 10)} className="bg-slate-700 text-slate-300 text-sm px-4 py-2 rounded-full hover:bg-slate-600 transition-colors">
                            Load More
                        </button>
                    </div>
                )}
            </>
        );
    } else {
        return (
            <div className="text-center py-16">
                <p className="text-slate-400 text-lg">You don't own any items in this category yet.</p>
                <p className="text-slate-500">Visit the shop to get some!</p>
            </div>
        );
    }
  }

  return (
    <div className="p-4 sm:p-8 h-screen bg-slate-900 text-white relative flex flex-col">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22%231e293b%22%20fill-opacity%3D%220.4%22%20fill-rule%3D%22evenodd%22%3E%3Cpath%20d%3D%22M0%2040L40%200H20L0%2020M40%2040V20L20%2040%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50"></div>
      <div className="max-w-6xl mx-auto relative z-10 w-full flex flex-col flex-grow overflow-hidden">
        <header className="flex-shrink-0">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-4xl font-bold text-cyan-400">Inventory</h1>
              <button onClick={onBack} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                Back
              </button>
            </div>
        </header>

        <div className="flex-shrink-0 mb-8 border-b border-slate-700">
            <nav className="flex space-x-1 sm:space-x-2 md:space-x-4 overflow-x-auto pb-px scrollbar-hide">
                {(['Skins', 'Avatars', 'Emojis', 'Themes', 'Boards', 'Effects', 'Victory', 'Booms', 'Locker'] as InventoryCategory[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`py-2 px-3 text-base sm:text-lg font-semibold transition-colors whitespace-nowrap ${activeTab === tab ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-white'}`}
                    >
                        {tab}
                    </button>
                ))}
            </nav>
        </div>
        
        <main className="flex-grow overflow-y-auto pr-2 -mr-2 scrollbar-hide">
            {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Inventory;