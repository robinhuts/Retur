import { useState, useMemo } from 'react'
import MarkerCard from './MarkerCard'
import { buildPesanTagihCOD, buildPesanTTD, konversiTelp, formatRupiah } from '../utils'
import { Search, Package, Trash2, Send, Phone, ChevronDown, ChevronUp, CreditCard, Receipt } from 'lucide-react'

const MARKER_BELUM_TTD = 'belum-ttd'

export default function MarkerView({ packages, config, currentView, setCurrentView, onRemoveMarker, showToast }) {
    const [search, setSearch] = useState('')

    const filtered = useMemo(() => {
        if (!search.trim()) return packages
        const q = search.toLowerCase()
        return packages.filter(p =>
            (p.nama || '').toLowerCase().includes(q) ||
            (p.resi || '').toLowerCase().includes(q)
        )
    }, [packages, search])

    const groupedPackages = useMemo(() => {
        const groups = {}
        const result = []

        filtered.forEach(pkg => {
            const phoneStr = (pkg.telp && !pkg.telp.includes('*')) ? pkg.telp : ''
            const nameStr = pkg.nama ? pkg.nama.toLowerCase().trim() : ''
            const key = phoneStr || nameStr

            if (!key) {
                result.push([pkg])
                return
            }

            if (!groups[key]) {
                groups[key] = []
            }
            groups[key].push(pkg)
        })

        Object.values(groups).forEach(g => result.push(g))
        
        result.sort((a, b) => b.length - a.length)
        return result
    }, [filtered])

    const [expandedGroups, setExpandedGroups] = useState({})

    const toggleGroup = (idx) => {
        setExpandedGroups(prev => ({
            ...prev,
            [idx]: !prev[idx]
        }))
    }

    function handleKirimWAGroup(groupArray) {
        const pkgWithPhone = groupArray.find(p => p.telp) || groupArray[0]
        if (!pkgWithPhone.telp) { showToast('No. HP tidak tersedia', 'warn'); return }
        const pesan = config.markerType === MARKER_BELUM_TTD
            ? buildPesanTagihCOD(groupArray)
            : buildPesanTTD(groupArray)
        const nomor = konversiTelp(pkgWithPhone.telp)
        window.open(`https://wa.me/${nomor}?text=${encodeURIComponent(pesan)}`, '_blank', 'noopener,noreferrer')
        showToast('WhatsApp sedang dibuka...', 'info')
    }

    return (
        <div className="flex flex-col">
            <div className="flex px-4 gap-6 overflow-x-auto no-scrollbar border-b border-slate-200 dark:border-slate-800 -mx-4 mb-4">
                <button
                    onClick={() => setCurrentView('pengiriman')}
                    className={`flex flex-col items-center justify-center border-b-2 py-3 transition-colors ${currentView === 'pengiriman' ? 'border-primary' : 'border-transparent'}`}
                >
                    <p className={`text-sm ${currentView === 'pengiriman' ? 'font-bold text-primary' : 'font-semibold opacity-60 text-slate-500'}`}>Semua</p>
                </button>
                <button
                    onClick={() => setCurrentView('belum-ttd')}
                    className={`flex flex-col items-center justify-center border-b-2 py-3 transition-colors ${currentView === 'belum-ttd' ? 'border-primary' : 'border-transparent'}`}
                >
                    <p className={`text-sm ${currentView === 'belum-ttd' ? 'font-bold text-primary' : 'font-semibold opacity-60 text-slate-500 whitespace-nowrap'}`}>Diantar (Blm Bayar)</p>
                </button>
                <button
                    onClick={() => setCurrentView('sudah-bayar')}
                    className={`flex flex-col items-center justify-center border-b-2 py-3 transition-colors ${currentView === 'sudah-bayar' ? 'border-primary' : 'border-transparent'}`}
                >
                    <p className={`text-sm ${currentView === 'sudah-bayar' ? 'font-bold text-primary' : 'font-semibold opacity-60 text-slate-500 whitespace-nowrap'}`}>Bayar (Blm Diantar)</p>
                </button>
            </div>

            <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Daftar Paket ({packages.length})</h3>
                <span className="text-xs font-semibold px-2.5 py-1 bg-primary/10 text-primary rounded-full uppercase tracking-wider">
                    {config.markerType === MARKER_BELUM_TTD ? 'Perlu TTD Segera' : 'Perlu Input WA'}
                </span>
            </div>

            <div className="relative mb-4">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search size={18} />
                </div>
                <input
                    type="text"
                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-slate-400 shadow-sm"
                    placeholder="Cari nama atau resi..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {packages.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <Package size={32} className="text-slate-300 dark:text-slate-600" />
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 font-semibold">{config.emptyText}</p>
                    <p className="text-slate-400 text-sm max-w-xs leading-relaxed">{config.emptyHint}</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="py-8 text-center text-slate-400 italic">Paket tidak ditemukan.</div>
            ) : (
                <div className="space-y-4">
                    {groupedPackages.map((group, idx) => {
                        const isExpanded = expandedGroups[idx] || false
                        const totalNominal = group.reduce((sum, pkg) => sum + (Number(pkg.nominal) || 0), 0)
                        
                        return (
                            <div key={`group-${idx}`} className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-2 shadow-inner">
                                <div 
                                    onClick={() => toggleGroup(idx)}
                                    role="button"
                                    tabIndex={0}
                                    className="px-2 pt-1 pb-1 flex justify-between items-center w-full text-left cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-lg transition-colors"
                                >
                                    <span className="flex flex-col">
                                        <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                            <Package size={14} className="text-primary" /> 
                                            {group[0].nama || 'Pelanggan'} 
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-medium ml-5">{group.length} Paket</span>
                                    </span>
                                    <div className="flex items-center gap-3">
                                        {totalNominal > 0 && (
                                            <span className="text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
                                                Rp {formatRupiah(totalNominal)}
                                            </span>
                                        )}
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (window.confirm(`Hapus ${group.length} paket untuk ${group[0].nama || 'pelanggan ini'}?`)) {
                                                    group.forEach(pkg => onRemoveMarker(pkg.resi))
                                                }
                                            }}
                                            className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                                            title="Hapus semua penanda paket ini"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                        {isExpanded ? (
                                            <ChevronUp size={20} className="text-slate-400" />
                                        ) : (
                                            <ChevronDown size={20} className="text-slate-400" />
                                        )}
                                    </div>
                                </div>
                                
                                {isExpanded && (
                                    <div className="flex flex-col gap-2 mt-2 animate-in slide-in-from-top-2 duration-200">
                                        {group.map(pkg => (
                                            <MarkerCard
                                                key={pkg.resi}
                                                pkg={pkg}
                                                isBelumTtd={config.markerType === MARKER_BELUM_TTD}
                                                onRemove={() => onRemoveMarker(pkg.resi)}
                                            />
                                        ))}
                                        
                                        <div className="mt-3 flex gap-3">
                                            <button 
                                                onClick={() => handleKirimWAGroup(group)}
                                                disabled={!group.some(p => p.telp)}
                                                className={`flex-1 font-bold py-3 text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm ${group.some(p => p.telp) ? 'bg-primary text-white active:scale-[0.98] shadow-lg shadow-primary/25 hover:bg-primary-dark' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'}`}
                                            >
                                                {config.markerType === MARKER_BELUM_TTD ? <CreditCard size={18} /> : <Receipt size={18} />}
                                                <span>{config.markerType === MARKER_BELUM_TTD ? 'Tagih Pembayaran (WA)' : 'Konfirmasi via WA'}</span>
                                            </button>
                                            <button
                                                disabled={!group.some(p => p.telp)}
                                                onClick={() => {
                                                    const p = group.find(x => x.telp);
                                                    if(p) window.open(`tel:${konversiTelp(p.telp)}`, '_self');
                                                }}
                                                className={`size-12 shrink-0 rounded-xl flex items-center justify-center transition-all ${group.some(p => p.telp) ? 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 active:scale-95' : 'bg-slate-100 dark:bg-slate-800/50 text-slate-300 cursor-not-allowed border border-slate-200 dark:border-slate-700'}`}
                                            >
                                                <Phone size={20} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
