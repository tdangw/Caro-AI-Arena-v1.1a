import React, { useState, useEffect, useMemo } from 'react';
import type { Cosmetic, PieceStyle, Avatar, Emoji, GameTheme, PieceEffect, VictoryEffect, BoomEffect, Friend, UserProfile, BoardStyle, LockerItem, AnimatedEmoji } from '../types';
import { ALL_COSMETICS, getRankFromCp } from '../constants';
import { useGameState } from '../context/GameStateContext';
import Modal from './Modal';
import { useSound } from '../hooks/useSound';
import { useAuth } from '../context/AuthContext';
import PurchaseHistoryTab from './inventory/PurchaseHistoryTab';
// FIX: Corrected import casing for GiftHistoryTab.
import GiftHistoryTab from './inventory/GiftHistoryTab';
// FIX: Import 'onlineService' to resolve undefined errors.
import * as onlineService from '../services/onlineService';

type ShopCategory = 'Skins' | 'Avatars' | 'Emojis' | 'Themes' | 'Boards' | 'Effects' | 'Victory' | 'Booms' | 'Purchase History' | 'Gift History';

const GiftModal: React.FC<{
    item: Cosmetic;
    friends: Friend[];
    friendProfiles: Map<string, UserProfile>;
    isLoadingData: boolean;
    onClose: () => void;
    onGift: (friendUid: string, friendName: string) => Promise<boolean>;
}> = ({ item, friends, friendProfiles, isLoadingData, onClose, onGift }) => {
    const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);

    const { statusMessage, isActionDisabled } = useMemo(() => {
        if (!selectedFriend) {
            return { statusMessage: null, isActionDisabled: true };
        }
        if (isLoadingData) {
            return { statusMessage: "Verifying friend's inventory...", isActionDisabled: true };
        }

        const profile = friendProfiles.get(selectedFriend);
        const friendName = profile?.name || 'This friend';
        
        const isConsumable = item.type === 'emoji' || item.type === 'animated_emoji';

        // For non-consumable items, check ownership and pending gifts.
        if (!isConsumable) {
            if (profile?.ownedCosmeticIds.includes(item.id)) {
                return { statusMessage: `${friendName} already owns this item.`, isActionDisabled: true };
            }
            if (profile?.pendingGiftIds?.includes(item.id)) {
                return { statusMessage: `${friendName} has this gift pending claim.`, isActionDisabled: true };
            }
        }

        return { statusMessage: null, isActionDisabled: false };
    }, [selectedFriend, isLoadingData, friendProfiles, item]);


    const handleSendGift = async () => {
        const friend = friends.find(f => f.uid === selectedFriend);
        if (!friend) return;
        
        setIsSending(true);
        await onGift(friend.uid, friend.name);
        setIsSending(false);
    };

    const isButtonDisabled = isSending || isActionDisabled;
    const buttonText = isLoadingData && selectedFriend ? 'Checking...' : isSending ? 'Sending...' : 'Send Gift';

    return (
        <Modal isOpen={true} onClose={onClose} title={`Gift: ${item.name}`}>
            <div className="text-center">
                <p className="text-slate-300 mb-4">Select a friend to send this gift to.</p>

                <div className="max-h-60 overflow-y-auto space-y-2 mb-4 pr-2 text-left scrollbar-hide">
                    {friends.length === 0 ? (
                        <div className="text-center text-slate-400 p-4">You have no friends to send gifts to.</div>
                    ) : (
                        friends.map(friend => {
                            const profile = friendProfiles.get(friend.uid);
                            const rank = getRankFromCp(profile?.cp);
                            
                            return (
                                <button key={friend.uid} onClick={() => setSelectedFriend(friend.uid)} className={`w-full p-2 rounded-lg flex items-center gap-3 transition-colors ${selectedFriend === friend.uid ? 'bg-cyan-500/30 ring-2 ring-cyan-400' : 'bg-slate-700 hover:bg-slate-600'}`}>
                                    <img src={friend.avatarUrl} alt={friend.name} className="w-10 h-10 rounded-full" />
                                    <div className='text-left flex-grow'>
                                        <span className="font-semibold text-white">{friend.name}</span>
                                        <div className="text-xs text-slate-400">Lv. {friend.level} &bull; {rank.icon} {rank.name}</div>
                                    </div>
                                </button>
                            )
                        })
                    )}
                </div>
                
                 <div className='flex justify-center gap-4 mt-4'>
                    <button onClick={onClose} className="bg-slate-600 hover:bg-slate-500 font-bold py-2 px-6 rounded-lg transition-colors">Cancel</button>
                    <button onClick={handleSendGift} disabled={isButtonDisabled} className="bg-green-600 hover:bg-green-500 disabled:bg-slate-500 disabled:cursor-not-allowed text-white font-bold py-2 px-6 rounded-lg transition-colors w-32 flex items-center justify-center">
                        <span style={{ fontSize: '0.9rem' }}>{buttonText}</span>
                    </button>
                </div>
                
                <div className={`text-sm mt-3 h-5 transition-colors ${statusMessage?.includes('already') || statusMessage?.includes('pending') ? 'text-red-400' : 'text-slate-400'}`}>
                    {statusMessage && (
                        <span>{statusMessage}</span>
                    )}
                </div>
            </div>
        </Modal>
    )
}


const Shop: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { user } = useAuth();
  const { gameState, purchaseCosmetic, spendCoins, showToast } = useGameState();
  const { playSound } = useSound();
  const [activeTab, setActiveTab] = useState<ShopCategory>('Skins');
  const [confirmingPurchase, setConfirmingPurchase] = useState<Cosmetic | null>(null);
  const [giftingItem, setGiftingItem] = useState<Cosmetic | null>(null);
  
  const [giftFriends, setGiftFriends] = useState<Friend[]>([]);
  const [giftFriendProfiles, setGiftFriendProfiles] = useState<Map<string, UserProfile>>(new Map());
  const [isLoadingGiftFriends, setIsLoadingGiftFriends] = useState(false);

  const cosmeticTypeMap: Record<string, 'piece' | 'avatar' | 'emoji' | 'animated_emoji' | 'theme' | 'board' | 'effect' | 'victory' | 'boom' | 'purchase history' | 'gift history'> = {
    Skins: 'piece',
    Avatars: 'avatar',
    Emojis: 'emoji',
    Themes: 'theme',
    Boards: 'board',
    Effects: 'effect',
    Victory: 'victory',
    Booms: 'boom',
    'Purchase History': 'purchase history',
    'Gift History': 'gift history'
  };

  useEffect(() => {
    if (!user || !giftingItem) return;

    let unsubFriends: (() => void) | null = null;
    
    const fetchFriendsData = () => {
        setIsLoadingGiftFriends(true);
        unsubFriends = onlineService.listenForFriends(user.uid, async (allFriends) => {
            const acceptedFriends = allFriends.filter(f => f.status === 'friends');
            setGiftFriends(acceptedFriends);

            try {
                // Fetch profiles for all friends in parallel
                const friendProfilesPromises = acceptedFriends.map(f => onlineService.getUserProfile(f.uid));
                const allFriendProfiles = await Promise.all(friendProfilesPromises);

                const profileMap = new Map<string, UserProfile>();
                allFriendProfiles.forEach((profile, index) => {
                    const friendUid = acceptedFriends[index].uid;
                    if (profile) profileMap.set(friendUid, profile);
                });

                setGiftFriendProfiles(profileMap);

            } catch (error) {
                console.error("Failed to fetch friend profiles for gifting:", error);
            } finally {
                setIsLoadingGiftFriends(false);
            }
        });
    };

    fetchFriendsData();

    return () => {
        if (unsubFriends) unsubFriends();
    };
  }, [user, giftingItem]);


  const handlePurchase = (cosmetic: Cosmetic) => {
    playSound('confirm');
    purchaseCosmetic(cosmetic);
    setConfirmingPurchase(null);
  };

  const handleGiftPurchase = async (friendUid: string, friendName: string): Promise<boolean> => {
    if (!user || !giftingItem) return false;

    if (!spendCoins(giftingItem.price)) {
        showToast("Not enough coins!", "error");
        return false;
    }

    try {
        playSound('confirm');
        await onlineService.sendGift(user.uid, gameState.playerName || 'A Player', friendUid, giftingItem.id);
        
        await onlineService.recordGiftSent(user.uid, friendUid, friendName, giftingItem);
        showToast(`Gift sent to ${friendName}!`, 'success', giftingItem.id);
        
        setGiftingItem(null);
        return true;
    } catch (error: any) {
        console.error("Gifting transaction failed:", error);
        
        if (error.message?.includes("Recipient already owns this item")) {
            showToast(`${friendName} already owns this item.`, "error");
        } else if (error.message?.includes("Recipient has this gift pending claim")) {
            showToast(`${friendName} has this gift pending claim.`, "error");
        } else {
            showToast("Failed to send gift. Please try again.", "error");
        }
        
        // Refund coins if server-side transaction failed
        spendCoins(-giftingItem.price);
        setGiftingItem(null);
        return false;
    }
  };

  const handleConfirmClick = (cosmetic: Cosmetic) => {
    playSound('select');
    setConfirmingPurchase(cosmetic);
  }

  const handleGiftClick = (cosmetic: Cosmetic) => {
    if (!user || user.isAnonymous) return; // Guests can't gift
    playSound('select');
    setGiftingItem(cosmetic);
  }
  
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
    if (activeTab === 'Purchase History') {
        return <PurchaseHistoryTab />;
    }
    if (activeTab === 'Gift History') {
        return <GiftHistoryTab />;
    }
    const filteredCosmetics = ALL_COSMETICS.filter(c => {
        if (activeTab === 'Emojis') {
            return (c.type === 'emoji' || c.type === 'animated_emoji') && c.price > 0;
        }
        return c.type === cosmeticTypeMap[activeTab] && c.price > 0;
    });

    return (
       <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {filteredCosmetics.map(cosmetic => {
            const isOwned = gameState.ownedCosmeticIds.includes(cosmetic.id);
            const canAfford = gameState.coins >= cosmetic.price;
            const isConsumableEmoji = cosmetic.type === 'emoji' || cosmetic.type === 'animated_emoji';
            const ownedEmojiCount = gameState.emojiInventory[cosmetic.id] || 0;
            const isDefault = cosmetic.price === 0;

            return (
              <div key={cosmetic.id} className="relative bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-4 flex flex-col items-center text-center transition-all duration-300 hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-500/10">
                {isConsumableEmoji && ownedEmojiCount > 0 && (
                    <div className="absolute top-1 right-1 bg-blue-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-slate-800">
                        {ownedEmojiCount}
                    </div>
                )}
                <div className="h-24 w-24 mb-3 flex items-center justify-center bg-slate-900/70 rounded-lg p-2">
                    {renderItemPreview(cosmetic)}
                </div>
                 <h3 className="text-md font-semibold text-white mb-2 h-10 flex items-center justify-center">{cosmetic.name}</h3>

                <div className="w-full mt-auto flex items-center gap-2">
                    {isOwned && !isConsumableEmoji ? (
                         <button disabled className="flex-1 py-2 px-3 rounded-lg text-sm font-semibold bg-green-600/50 text-white cursor-not-allowed">
                            {isDefault ? 'Default' : 'Owned'}
                        </button>
                    ) : (
                        <button
                            onClick={() => handleConfirmClick(cosmetic)}
                            disabled={!canAfford || isDefault}
                            className={`flex-1 py-2 px-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-1 text-sm ${
                                isDefault
                                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                                : canAfford 
                                ? 'bg-cyan-500 hover:bg-cyan-400 text-black' 
                                : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                            }`}
                        >
                            <span>{cosmetic.price}</span>
                            <span className="text-yellow-800">💰</span>
                        </button>
                    )}
                    <button
                        onClick={() => handleGiftClick(cosmetic)}
                        disabled={!canAfford || user?.isAnonymous || isDefault}
                        className={`flex-1 py-2 px-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-1 text-sm ${
                            canAfford && !user?.isAnonymous && !isDefault
                            ? 'bg-pink-500 hover:bg-pink-400 text-white'
                            : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                        }`}
                    >
                        🎁
                    </button>
                </div>
              </div>
            );
          })}
        </div>
    );
  };

// FIX: Added main component return statement and default export to fix errors.
  return (
    <div className="p-4 sm:p-8 h-screen bg-slate-900 text-white relative flex flex-col">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22%231e293b%22%20fill-opacity%3D%220.4%22%20fill-rule%3D%22evenodd%22%3E%3Cpath%20d%3D%22M0%2040L40%200H20L0%2020M40%2040V20L20%2040%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50"></div>
      <div className="max-w-6xl mx-auto relative z-10 w-full flex flex-col flex-grow overflow-hidden">
        <header className="flex-shrink-0">
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-baseline gap-4">
                    <h1 className="text-4xl font-bold text-cyan-400">Shop</h1>
                    <span className="text-yellow-400 font-bold text-lg flex items-center gap-1.5">
                        {gameState.coins} 💰
                    </span>
                </div>
              <button onClick={onBack} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                Back
              </button>
            </div>
        </header>

        <div className="flex-shrink-0 mb-8 border-b border-slate-700">
            <nav className="flex space-x-1 sm:space-x-2 md:space-x-4 overflow-x-auto pb-px scrollbar-hide">
                {(['Skins', 'Avatars', 'Emojis', 'Themes', 'Boards', 'Effects', 'Victory', 'Booms', 'Purchase History', 'Gift History'] as ShopCategory[]).map(tab => (
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
        {confirmingPurchase && (
            <Modal isOpen={!!confirmingPurchase} onClose={() => setConfirmingPurchase(null)} title="Confirm Purchase">
                <div className='text-center'>
                    <p className="text-slate-300 mb-6">Are you sure you want to buy <strong className='text-white'>{confirmingPurchase.name}</strong> for <strong className='text-yellow-400'>{confirmingPurchase.price} 💰</strong>?</p>
                    <div className='flex justify-center gap-4'>
                        <button onClick={() => { playSound('select'); setConfirmingPurchase(null); }} className="bg-slate-600 hover:bg-slate-500 font-bold py-2 px-6 rounded-lg transition-colors">Cancel</button>
                        <button onClick={() => handlePurchase(confirmingPurchase)} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-6 rounded-lg transition-colors">Confirm</button>
                    </div>
                </div>
            </Modal>
        )}

        {giftingItem && (
            <GiftModal
                item={giftingItem}
                friends={giftFriends}
                friendProfiles={giftFriendProfiles}
                isLoadingData={isLoadingGiftFriends}
                onClose={() => setGiftingItem(null)}
                onGift={handleGiftPurchase}
            />
        )}
    </div>
  );
};

export default Shop;
