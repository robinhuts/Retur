import { Home, Package, PenLine, CreditCard } from 'lucide-react'

export default function Sidebar({ currentView, setCurrentView, markerCounts }) {
    const menus = [
        { id: 'pengiriman', label: 'Beranda', icon: Home },
        { id: 'retur', label: 'Retur', icon: Package },
        { id: 'belum-ttd', label: 'TTD', icon: PenLine, badge: markerCounts?.['belum-ttd'] || 0 },
        { id: 'sudah-bayar', label: 'Bayar', icon: CreditCard, badge: markerCounts?.['sudah-bayar'] || 0 },
    ]

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800/80 px-2 py-2 pb-6 flex items-center justify-around z-50 md:flex-col md:w-24 md:h-screen md:pb-4 md:pt-6 md:border-t-0 md:border-r md:border-r-slate-200/80 md:dark:border-r-slate-800/80">
            {menus.map((menu) => {
                const isActive = currentView === menu.id
                const Icon = menu.icon
                return (
                    <button
                        key={menu.id}
                        onClick={() => setCurrentView(menu.id)}
                        className={`relative flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all duration-200 ${isActive 
                            ? 'text-primary' 
                            : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                    >
                        <div className={`p-1.5 rounded-lg transition-all duration-200 ${isActive 
                            ? 'bg-primary/10' 
                            : ''
                        }`}>
                            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                        </div>
                        <span className={`text-[11px] font-semibold ${isActive ? 'text-primary' : ''}`}>{menu.label}</span>
                        {menu.badge > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full shrink-0 min-w-[1.25rem] text-center border-2 border-white dark:border-[#1a1a1a]">
                                {menu.badge}
                            </span>
                        )}
                    </button>
                )
            })}
        </nav>
    )
}
