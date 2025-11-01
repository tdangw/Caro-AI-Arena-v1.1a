import React, { useState, useMemo } from 'react';
import * as onlineService from '../../services/onlineService';
import { useAuth } from '../../context/AuthContext';
import type { Friend, Emoji, AnimatedEmoji } from '../../types';
import Modal from '../Modal';
import { getRankFromCp, ALL_COSMETICS } from '../../constants';
import { useGameState } from '../../context/GameStateContext';
import { useSound } from '../../hooks/useSound';

interface FriendsManagerProps {
    isOpen: boolean;
    onClose: () => void;
    onStartChat: (player: {uid: string, name: string}) => void;
    friends: Friend[];
    onInvite: (player: { uid: string; name: string }) => void;
}

const FriendsManager: React.FC<FriendsManagerProps> = ({ isOpen, onClose, onStartChat, friends, onInvite }) => {
    const { user } = useAuth();
    const { gameState, consumeEmoji } = useGameState();
    const { playSound } = useSound();
    const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');
    const [removingFriend, setRemovingFriend] = useState<Friend | null>(null);
    const [invitedFriends, setInvitedFriends] = useState<Set<string>>(new Set());
    const [teasingFriend, setTeasingFriend] = useState<Friend | null>(null);

    const ownedEmojis = useMemo(() => {
        const ownedEmojiItems: (Emoji | AnimatedEmoji)[] = [];
        const allEmojiCosmetics = ALL_COSMETICS.filter(c => c.type === 'emoji' || c.type === 'animated_emoji');

        for (const cosmetic of allEmojiCosmetics) {
            const isOwned = gameState.ownedCosmeticIds.includes(cosmetic.id);
            const inventoryCount = gameState.emojiInventory[cosmetic.id] || 0;
            if(isOwned || inventoryCount > 0) {
                ownedEmojiItems.push(cosmetic.item as Emoji | AnimatedEmoji);
            }
        }
        return ownedEmojiItems;
    }, [gameState.ownedCosmeticIds, gameState.emojiInventory]);
    
    const handleRespond = (friendUid: string, response: 'accept' | 'decline') => {
        if (!user) return;
        playSound('select');
        onlineService.respondToFriendRequest(user.uid, friendUid, response);
    };

    const confirmRemove = () => {
        if (!user || !removingFriend) return;
        playSound('confirm');
        onlineService.removeFriend(user.uid, removingFriend.uid);
        setRemovingFriend(null);
    }

    const handleInviteClick = (friend: Friend) => {
        playSound('select');
        onInvite(friend);
        setInvitedFriends(prev => new Set(prev).add(friend.uid));
        setTimeout(() => {
            setInvitedFriends(prev => {
                const newSet = new Set(prev);
                newSet.delete(friend.uid);
                return newSet;
            });
        }, 15000);
    };
    
    const handleSendTease = (emoji: Emoji | AnimatedEmoji) => {
        if (user && teasingFriend) {
            playSound('select');
            const emojiContent = 'emoji' in emoji ? emoji.emoji : emoji.url;
            onlineService.sendTeaseNotification(user.uid, gameState.playerName, teasingFriend.uid, emojiContent);

            const cosmetic = ALL_COSMETICS.find(c => c.id === emoji.id);
            if(cosmetic && cosmetic.price > 0) {
                consumeEmoji(emoji.id);
            }
            setTeasingFriend(null);
        }
    }

    const friendList = friends.filter(f => f.status === 'friends');
    const requestList = friends.filter(f => f.status === 'received');

    const renderFriendList = (list: Friend[]) => (
        <div className="space-y-2">
            {list.map(f => {
                const rank = getRankFromCp(0); // CP info is not available here, defaulting
                const isInvited = invitedFriends.has(f.uid);

                return (
                    <div key={f.uid} className="flex items-center justify-between bg-slate-800/50 p-2 rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <img src={f.avatarUrl} alt={f.name} className="w-10 h-10 rounded-full object-cover bg-slate-700"/>
                                 {f.onlineStatus && f.onlineStatus !== 'offline' && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-800"></span>}
                            </div>
                            <div>
                                <div className="flex items-baseline gap-2">
                                    <p className="font-semibold text-white">{f.name}</p>
                                    <p className="text-xs text-cyan-400">Lv. {f.level}</p>
                                </div>
                                <p className="text-xs text-slate-400 capitalize truncate italic" title={f.statusMessage}>
                                    {f.onlineStatus !== 'offline' && f.statusMessage ? `"${f.statusMessage}"` : `${rank.icon} ${rank.name} (${f.onlineStatus?.replace('_', ' ') || 'Offline'})`}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-1.5 items-center">
                            <button onClick={() => { onStartChat({uid: f.uid, name: f.name}); }} className="bg-blue-500 text-xs text-white font-bold px-2 py-1 rounded hover:bg-blue-400">Chat</button>
                            <button onClick={() => handleInviteClick(f)} disabled={f.onlineStatus !== 'idle' || isInvited} className="text-xs text-white font-bold px-2 py-1 rounded bg-purple-500 hover:bg-purple-400 disabled:bg-slate-600 disabled:cursor-not-allowed">{isInvited ? 'Invited' : 'Invite'}</button>
                            <button onClick={() => { playSound('select'); setTeasingFriend(f); }} className="bg-yellow-500 text-xs text-black font-bold px-2 py-1 rounded hover:bg-yellow-400">Tease</button>
                            <button onClick={() => setRemovingFriend(f)} className="text-slate-500 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-red-500/10">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                )
            })}
        </div>
    );
    
    const renderRequestList = (list: Friend[]) => (
         <div className="space-y-2">
            {list.map(f => (
                <div key={f.uid} className="flex items-center justify-between bg-slate-800/50 p-2 rounded-lg">
                    <div className="flex items-center gap-3">
                        <img src={f.avatarUrl} alt={f.name} className="w-10 h-10 rounded-full object-cover bg-slate-700"/>
                        <div>
                            <div className="flex items-baseline gap-2">
                                <p className="font-semibold text-white">{f.name}</p>
                                <p className="text-xs text-cyan-400">Lv. {f.level}</p>
                            </div>
                            <p className="text-xs text-slate-400">Wants to be friends</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => handleRespond(f.uid, 'accept')} className="bg-green-500 text-xs text-white font-bold px-2 py-1 rounded">Accept</button>
                        <button onClick={() => handleRespond(f.uid, 'decline')} className="bg-slate-600 text-xs text-white font-bold px-2 py-1 rounded">Decline</button>
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Friends" size="xl">
            <div className="flex border-b border-slate-700 mb-4">
                <button onClick={() => setActiveTab('friends')} className={`py-2 px-4 font-semibold ${activeTab === 'friends' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400'}`}>
                    Friends ({friendList.length})
                </button>
                <button onClick={() => setActiveTab('requests')} className={`py-2 px-4 font-semibold ${activeTab === 'requests' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400'}`}>
                    Requests ({requestList.length})
                </button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto pr-2 scrollbar-hide">
                {activeTab === 'friends' && (friendList.length > 0 ? renderFriendList(friendList) : <p className="text-slate-500 text-center py-8">Your friends list is empty.</p>)}
                {activeTab === 'requests' && (requestList.length > 0 ? renderRequestList(requestList) : <p className="text-slate-500 text-center py-8">No new friend requests.</p>)}
            </div>
            {removingFriend && (
                <Modal isOpen={!!removingFriend} onClose={() => setRemovingFriend(null)} title="Remove Friend">
                    <div className="text-center">
                        <p className="text-slate-300 mb-6">Are you sure you want to remove <strong className="text-white">{removingFriend.name}</strong> from your friends?</p>
                        <div className="flex justify-center gap-4">
                            <button onClick={() => setRemovingFriend(null)} className="bg-slate-600 hover:bg-slate-500 font-bold py-2 px-6 rounded-lg">Cancel</button>
                            <button onClick={confirmRemove} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-6 rounded-lg">Remove</button>
                        </div>
                    </div>
                </Modal>
            )}
            {teasingFriend && (
                <Modal isOpen={!!teasingFriend} onClose={() => setTeasingFriend(null)} title={`Tease ${teasingFriend.name}`}>
                     <div className="grid grid-cols-5 gap-2 max-h-60 overflow-y-auto p-2">
                        {ownedEmojis.map(e => {
                            const isAnimated = 'url' in e;
                            return (<button key={e.id} onClick={() => handleSendTease(e)} className="text-3xl w-14 h-14 flex items-center justify-center rounded-md hover:bg-slate-700/50 hover:scale-110 transition-all">{isAnimated ? <img src={e.url} alt={e.name} className="w-10 h-10" /> : e.emoji}</button>);
                        })}
                    </div>
                </Modal>
            )}
        </Modal>
    );
};

export default FriendsManager;