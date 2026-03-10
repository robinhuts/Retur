import React, { memo } from 'react'
import { formatRupiah, konversiTelp } from '../utils'

const MarkerCard = memo(function MarkerCard({ pkg, isBelumTtd, onRemove, onKirimWA }) {
    if (isBelumTtd) {
        return (
            <div className="bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800 p-4">
                <div className="flex gap-4">
                    <div className="size-16 rounded-lg bg-primary/5 flex items-center justify-center shrink-0 border border-primary/10 relative">
                        <span className="material-symbols-outlined text-primary text-3xl">package_2</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                            <p className="text-lg font-bold truncate">{pkg.nama || '—'}</p>
                            <span className="text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded uppercase flex-shrink-0">
                                Sudah Diantar
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate">ID: {pkg.resi}</p>
                        <span className="mt-1 inline-block px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-[10px] font-bold whitespace-nowrap">BELUM BAYAR</span>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="p-4 space-y-3 relative">
                <div className="flex justify-between items-start pr-6">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Status Pengiriman</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold">SUDAH BAYAR</span>
                            <span className="px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-[10px] font-bold whitespace-nowrap">BELUM DIANTAR</span>
                        </div>
                    </div>
                    {pkg.nominal && pkg.nominal !== '0' && (
                        <div className="text-right">
                            <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Total COD</span>
                            <p className="text-lg font-bold text-primary whitespace-nowrap">Rp {formatRupiah(pkg.nominal)}</p>
                        </div>
                    )}
                </div>
                <div className="flex gap-4">
                    <div className="h-20 w-20 rounded-lg shrink-0 border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[32px] text-slate-300">inventory_2</span>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-tight truncate">ID: {pkg.resi}</h3>
                        <p className="font-bold text-slate-900 dark:text-slate-100 truncate mt-0.5">{pkg.nama || '—'}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 leading-snug mt-0.5">{pkg.address || '—'}</p>
                    </div>
                </div>
            </div>
        </div>
    )
})

export default MarkerCard
