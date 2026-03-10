import React, { useState, useMemo } from 'react'
import { formatRupiah, konversiTelp, buildPesanPengiriman } from '../utils'

const MARKER_BELUM_TTD = 'belum-ttd'
const MARKER_SUDAH_BAYAR = 'sudah-bayar'

function SkeletonCard() {
    return (
        <div className="w-full text-left bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 flex flex-col gap-2 pointer-events-none shadow-sm">
            <div className="rounded-md bg-slate-200 dark:bg-slate-700 animate-pulse h-4 mb-2 w-[30%]" />
            <div className="rounded-md bg-slate-200 dark:bg-slate-700 animate-pulse h-5 mb-2 w-[60%]" />
            <div className="rounded-md bg-slate-200 dark:bg-slate-700 animate-pulse h-4 mb-2 w-[40%]" />
        </div>
    )
}

function PackageCard({ pkg, isSelected, currentMarker, currentView, onSelect, onToggleMarker }) {
    const borderClass = isSelected
        ? 'border-green-500 shadow-[0_4px_20px_rgba(34,197,94,0.15)] ring-1 ring-green-500/30'
        : currentMarker === MARKER_BELUM_TTD
            ? 'border-yellow-400 bg-yellow-50/30'
            : currentMarker === MARKER_SUDAH_BAYAR
                ? 'border-teal-400 bg-teal-50/30'
                : 'border-slate-100 dark:border-slate-700 hover:border-primary/30'



    return (
        <div 
            className={`bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border transition-all active:scale-[0.99] cursor-pointer ${borderClass}`} 
            onClick={() => onSelect(pkg)}
        >
            <div className="flex justify-between items-start mb-3">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded">
                            {pkg.resi || '—'}
                        </span>
                    </div>
                    <h3 className="text-base font-bold mt-1 max-w-[180px] truncate">{pkg.nama || 'Tanpa Nama'}</h3>
                </div>

                <div className="text-right">
                    {pkg.nominal && pkg.nominal !== '0' ? (
                        <>
                            <p className="text-[10px] text-slate-400 font-medium">COD Amount</p>
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Rp {formatRupiah(pkg.nominal)}</p>
                        </>
                    ) : (
                        <>
                            <p className="text-[10px] text-slate-400 font-medium">Layanan</p>
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{pkg.type || 'Reguler'}</p>
                        </>
                    )}
                </div>
            </div>

            <div className="flex items-start gap-2 mb-4">
                <span className="material-symbols-outlined text-slate-400 text-lg shrink-0 mt-0.5">location_on</span>
                <p className="text-xs text-slate-500 leading-relaxed font-medium line-clamp-2">
                    {pkg.address || pkg.carrier || 'Alamat tidak tersedia'}
                </p>
            </div>

            {currentView === 'retur' ? (
                <div className="flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); }} className="flex-1 py-2 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-1 border border-slate-200 dark:border-slate-600 active:scale-95 transition-transform">
                        <span className="material-symbols-outlined text-[16px]">map</span> Lihat Map
                    </button>
                    <button className={`flex-1 py-2 rounded-lg text-white text-xs font-semibold flex items-center justify-center gap-1 active:scale-95 transition-transform ${isSelected ? 'bg-green-500' : 'bg-primary shadow-md shadow-primary/20'}`}>
                        <span className="material-symbols-outlined text-[16px]">{isSelected ? 'check_circle' : 'swipe_up'}</span> {isSelected ? 'Terpilih' : 'Pilih'}
                    </button>
                </div>
            ) : (
                <div className="flex flex-col gap-2 border-t border-slate-100 dark:border-slate-700 pt-3 mt-1">


                    <div className="flex gap-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleMarker?.(pkg.resi, MARKER_BELUM_TTD) }}
                            className={`flex-1 py-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all border leading-tight ${currentMarker === MARKER_BELUM_TTD ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-700/50'}`}
                        >
                            <span className="material-symbols-outlined text-[14px]">draw</span> <span className="text-center">Sudah Diantar<br />Belum Bayar</span>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleMarker?.(pkg.resi, MARKER_SUDAH_BAYAR) }}
                            className={`flex-1 py-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all border leading-tight ${currentMarker === MARKER_SUDAH_BAYAR ? 'bg-teal-500 text-white border-teal-500' : 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:border-teal-700/50'}`}
                        >
                            <span className="material-symbols-outlined text-[14px]">payments</span> <span className="text-center">Sudah Bayar<br />Belum Diantar</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

const PackageCardMemo = React.memo(PackageCard, (prev, next) => {
    return (
        prev.pkg.resi === next.pkg.resi &&
        prev.pkg.nama === next.pkg.nama &&
        prev.pkg.nominal === next.pkg.nominal &&
        prev.pkg.address === next.pkg.address &&
        prev.pkg.telp === next.pkg.telp &&
        prev.pkg.marker === next.pkg.marker &&
        prev.isSelected === next.isSelected &&
        prev.currentView === next.currentView
    )
})

export default function PackageList({ packages, loading, error, selectedResis = [], onSelect, onRetry, currentView, onToggleMarker, showToast }) {
    const [searchQuery, setSearchQuery] = useState('')
    const filteredPackages = useMemo(() => {
        if (!packages) return []
        if (!searchQuery.trim()) return packages

        const q = searchQuery.toLowerCase()
        return packages.filter(pkg => {
            const nama = (pkg.nama || '').toLowerCase()
            const resi = (pkg.resi || '').toLowerCase()
            const area = (pkg.area || '').toLowerCase()
            const carrier = (pkg.carrier || '').toLowerCase()
            return nama.includes(q) || resi.includes(q) || area.includes(q) || carrier.includes(q)
        })
    }, [packages, searchQuery])

    const groupedPackages = useMemo(() => {
        const groups = {}
        const result = []

        filteredPackages.forEach(pkg => {
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
        
        // Sort bundles by size descending
        result.sort((a, b) => b.length - a.length)
        
        return result
    }, [filteredPackages])

    // State to track expanded groups. We use the index of the group as the key.
    const [expandedGroups, setExpandedGroups] = useState({})

    const toggleGroup = (idx) => {
        setExpandedGroups(prev => ({
            ...prev,
            [idx]: !prev[idx]
        }))
    }

    const handleKirimPengirimanGroup = (groupArray) => {
        const pkgWithPhone = groupArray.find(p => p.telp) || groupArray[0]
        if (!pkgWithPhone.telp) { showToast?.('No. HP tidak tersedia', 'warn'); return }
        const pesan = buildPesanPengiriman(groupArray)
        const nomor = konversiTelp(pkgWithPhone.telp)
        window.open(`https://wa.me/${nomor}?text=${encodeURIComponent(pesan)}`, '_blank', 'noopener,noreferrer')
        showToast?.('WhatsApp sedang dibuka...', 'info')
    }

    if (loading) {
        return (
            <div className="flex flex-col gap-3">
                {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500">
                <span className="material-symbols-outlined text-rose-500 text-5xl mb-3">error</span>
                <p className="text-sm font-medium mb-4">{error}</p>
                <button
                    onClick={onRetry}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-bold rounded-full shadow-md shadow-primary/20 active:scale-95 transition-all"
                >
                    <span className="material-symbols-outlined text-[18px]">refresh</span> Coba Lagi
                </button>
            </div>
        )
    }

    if (!packages || packages.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500">
                <span className="material-symbols-outlined text-slate-300 text-6xl mb-4">inbox_customize</span>
                <p className="font-semibold text-slate-600 dark:text-slate-400">Tidak ada paket</p>
                <button
                    onClick={onRetry}
                    className="flex items-center gap-2 mt-4 text-primary font-bold text-sm"
                >
                    <span className="material-symbols-outlined text-[18px]">refresh</span> Refresh
                </button>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Context Header */}
            <div className="flex items-center justify-between mt-2">
                <h2 className="text-base font-bold font-display">Daftar Paket ({packages.length})</h2>
                {currentView === 'retur' && (
                    <button className="text-primary text-sm font-semibold hover:underline">Pilih Semua</button>
                )}
                {currentView !== 'retur' && (
                    <button onClick={onRetry} className="text-primary text-sm font-semibold flex items-center gap-1 active:scale-95 transition-transform">
                        <span className="material-symbols-outlined text-[18px]">refresh</span> Refresh
                    </button>
                )}
            </div>

            {/* Sticky Search Container */}
            <div className="sticky top-[65px] bg-background-light dark:bg-background-dark z-10 pb-4 pt-2 -mx-4 px-4">
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                    <input
                        type="text"
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-primary/50 text-sm shadow-sm placeholder:text-slate-400 outline-none"
                        placeholder="Cari Nama Penerima atau Resi"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

            </div>

            {groupedPackages.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-medium bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 border-dashed">
                    Paket tidak ditemukan.
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {groupedPackages.map((group, idx) => {
                        if (group.length === 1) {
                            const pkg = group[0]
                            return (
                                <div key={pkg.resi} className="flex flex-col gap-2">
                                    <PackageCardMemo
                                        pkg={pkg}
                                        isSelected={selectedResis.includes(pkg.resi)}
                                        currentMarker={pkg.marker || null}
                                        currentView={currentView}
                                        onSelect={onSelect}
                                        onToggleMarker={onToggleMarker}
                                    />
                                    {currentView !== 'retur' && (
                                        <div className="flex gap-2 mb-2">
                                            <button
                                                onClick={() => handleKirimPengirimanGroup([pkg])}
                                                disabled={!pkg.telp}
                                                className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all shadow-sm ${pkg.telp ? 'bg-primary text-white shadow-primary/20 bg-opacity-90' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-700'}`}
                                            >
                                                <span className="material-symbols-outlined text-[18px]">send</span> {pkg.telp ? 'Kirim WA Pengiriman' : 'No. HP Tidak Tersedia'}
                                            </button>
                                            <button
                                                disabled={!pkg.telp}
                                                onClick={() => pkg.telp && window.open(`tel:${konversiTelp(pkg.telp)}`, '_self')}
                                                className={`size-[42px] shrink-0 rounded-xl flex items-center justify-center transition-colors ${pkg.telp ? 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50' : 'bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100 dark:border-slate-800'}`}
                                            >
                                                <span className="material-symbols-outlined text-[20px]">call</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )
                        }

                        // Render Bundled Group
                        const isExpanded = expandedGroups[idx] || false
                        
                        return (
                            <div key={`group-${idx}`} className="bg-slate-100 dark:bg-slate-900/40 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-2 shadow-inner">
                                <div 
                                    onClick={() => toggleGroup(idx)}
                                    role="button"
                                    tabIndex={0}
                                    className="px-2 pt-1 pb-1 flex justify-between items-center w-full text-left cursor-pointer"
                                >
                                    <span className="flex flex-col">
                                        <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 border-b border-transparent">
                                            <span className="material-symbols-outlined text-[16px] text-primary">inventory_2</span> 
                                            {group[0].nama || 'Pelanggan'} 
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-medium ml-5">{group.length} Paket</span>
                                    </span>
                                    <span className="material-symbols-outlined text-slate-400 transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                        expand_more
                                    </span>
                                </div>
                                
                                {isExpanded && (
                                    <div className="flex flex-col gap-2 mt-1 animate-in slide-in-from-top-2 duration-200">
                                        {group.map(pkg => (
                                            <PackageCardMemo
                                                key={pkg.resi}
                                                pkg={pkg}
                                                isSelected={selectedResis.includes(pkg.resi)}
                                                currentMarker={pkg.marker || null}
                                                currentView={currentView}
                                                onSelect={onSelect}
                                                onToggleMarker={onToggleMarker}
                                            />
                                        ))}
                                        
                                        {currentView !== 'retur' && (
                                            <div className="mt-2 flex gap-3">
                                                <button 
                                                    onClick={() => handleKirimPengirimanGroup(group)}
                                                    disabled={!group.some(p => p.telp)}
                                                    className={`flex-1 font-bold py-3 text-sm rounded-xl flex items-center justify-center gap-2 transition-transform shadow-sm ${group.some(p => p.telp) ? 'bg-primary text-white active:scale-[0.98]' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">send</span>
                                                    <span>Kirim WA Pengiriman</span>
                                                </button>
                                                <button
                                                    disabled={!group.some(p => p.telp)}
                                                    onClick={() => {
                                                        const p = group.find(x => x.telp);
                                                        if(p) window.open(`tel:${konversiTelp(p.telp)}`, '_self');
                                                    }}
                                                    className={`size-12 shrink-0 rounded-xl flex items-center justify-center ${group.some(p => p.telp) ? 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700' : 'bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100'}`}
                                                >
                                                    <span className="material-symbols-outlined text-[24px]">call</span>
                                                </button>
                                            </div>
                                        )}
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
