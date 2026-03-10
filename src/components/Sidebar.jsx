import { PackageX, Truck, Map, PenLine, CircleDollarSign, History, PersonStanding, MessageSquare } from 'lucide-react'

export default function Sidebar({ currentView, setCurrentView, markerCounts }) {
    const menus = [
        { id: 'pengiriman', label: 'Beranda', icon: 'home' },
        { id: 'retur', label: 'Retur', icon: 'package_2' },
        { id: 'belum-ttd', label: 'TTD', icon: 'draw', badge: markerCounts?.['belum-ttd'] || 0 },
        { id: 'sudah-bayar', label: 'Bayar', icon: 'payments', badge: markerCounts?.['sudah-bayar'] || 0 },
    ]

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-background-dark border-t border-slate-200 dark:border-slate-800 px-4 py-2 pb-6 flex items-center justify-around z-50 md:flex-col md:w-24 md:h-screen md:pb-4 md:pt-6 md:border-t-0 md:border-r">
            {menus.map((menu) => {
                const isActive = currentView === menu.id
                return (
                    <button
                        key={menu.id}
                        onClick={() => setCurrentView(menu.id)}
                        className={`flex flex-col items-center gap-1 relative ${isActive ? 'text-primary' : 'text-slate-400 dark:text-slate-500'} hover:text-primary transition-colors`}
                    >
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                            {menu.icon}
                        </span>
                        <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{menu.label}</span>
                        {/* Badge count */}
                        {menu.badge > 0 && (
                            <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[0.65rem] font-bold px-1.5 py-0.5 rounded-full shrink-0 min-w-[1.25rem] text-center border-2 border-white">
                                {menu.badge}
                            </span>
                        )}
                    </button>
                )
            })}
        </nav>
    )
}
