import React, { useState } from 'react';
import * as onlineService from '../../services/onlineService';
import { useAuth } from '../../context/AuthContext';
import type { Friend } from '../../types';
import Modal from '../Modal';
import { getRankFromCp } from '../../constants';

interface FriendsManagerProps {
    isOpen: boolean;
    onClose: () => void;
    onStartChat: (player: {uid: string, name: string}) => void;
    friends: Friend[];
}

const FriendsManager: React.FC<FriendsManagerProps> = ({ isOpen, onClose, onStartChat, friends }) => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');
    
    const handleRespond = (friendUid: string, response: 'accept' | 'decline') => {
        if (!user) return;
        onlineService.respondToFriendRequest(user.uid, friendUid, response);
    };

    const handleRemove = (friendUid: string) => {
        if (!user) return;
        onlineService.removeFriend(user.uid, friendUid);
    }

    const friendList = friends.filter(f => f.status === 'friends');
    const requestList = friends.filter(f => f.status === 'received');

    const renderFriendList = (list: Friend[]) => (
        <div className="space-y-2">
            {list.map(f => {
                const rank = getRankFromCp(0); // CP info is not available here, defaulting
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
                        <div className="flex gap-2">
                            <button onClick={() => { onClose(); onStartChat({uid: f.uid, name: f.name}); }} className="bg-blue-500 text-xs text-white font-bold px-2 py-1 rounded">Chat</button>
                            <button onClick={() => handleRemove(f.uid)} className="bg-red-600 text-xs text-white font-bold px-2 py-1 rounded">Remove</button>
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
        <Modal isOpen={isOpen} onClose={onClose} title="Friends" size="md">
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
        </Modal>
    );
};

export default FriendsManager;