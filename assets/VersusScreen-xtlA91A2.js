import{r as c,j as e}from"./index-iVqpNyTX.js";const r=({player:t,align:s})=>{const a=s==="left"?"animate-slide-in-left":"animate-slide-in-right";return e.jsxs("div",{className:`flex flex-col items-center ${a}`,children:[e.jsx("img",{src:t.avatarUrl,alt:t.name,className:"w-32 h-32 rounded-full border-4 border-slate-600 bg-slate-800 object-cover mb-4"}),e.jsx("h3",{className:"text-2xl font-bold text-white",children:t.name}),e.jsxs("p",{className:"text-cyan-400",children:["Level ",t.level]})]})},d=({game:t,currentUserId:s,onGameStart:a})=>{c.useEffect(()=>{const o=setTimeout(()=>{a()},1500);return()=>clearTimeout(o)},[a]);const n=t.players.X===s?t.players.O:t.players.X,i=t.playerDetails[s],l=t.playerDetails[n];return!i||!l?e.jsx("div",{className:"min-h-screen bg-slate-900 text-white flex items-center justify-center",children:e.jsx("p",{children:"Loading player details..."})}):e.jsxs("div",{className:"min-h-screen bg-slate-900 text-white p-4 flex flex-col items-center justify-center relative overflow-hidden",children:[e.jsx("div",{className:"absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%2D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22%231e293b%22%20fill-opacity%3D%220.4%22%20fill-rule%3D%22evenodd%22%3E%3Cpath%20d%3D%22M0%2040L40%200H20L0%2020M40%2040V20L20%2040%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50"}),e.jsxs("div",{className:"w-full max-w-2xl flex items-center justify-around z-10",children:[e.jsx(r,{player:i,align:"left"}),e.jsx("div",{className:"animate-zoom-in-out",children:e.jsx("h2",{className:"text-6xl font-black text-red-500",style:{textShadow:"0 0 15px #ef4444"},children:"VS"})}),e.jsx(r,{player:l,align:"right"})]}),e.jsx("p",{className:"absolute bottom-10 text-slate-400 animate-pulse",children:"Match Starting..."}),e.jsx("style",{children:`
                @keyframes slide-in-left {
                    from { transform: translateX(-100vw); }
                    to { transform: translateX(0); }
                }
                .animate-slide-in-left { animation: slide-in-left 0.8s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
                
                @keyframes slide-in-right {
                    from { transform: translateX(100vw); }
                    to { transform: translateX(0); }
                }
                .animate-slide-in-right { animation: slide-in-right 0.8s cubic-bezier(0.25, 1, 0.5, 1) forwards; }

                @keyframes zoom-in-out {
                    0% { transform: scale(0.5); opacity: 0; }
                    50% { transform: scale(1.2); opacity: 1; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .animate-zoom-in-out { animation: zoom-in-out 1.2s ease-out forwards; animation-delay: 0.2s; }
            `})]})};export{d as default};
