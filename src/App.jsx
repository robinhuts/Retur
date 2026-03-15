import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import Sidebar from './components/Sidebar.jsx'
import ReturnForm from './components/ReturnForm.jsx'
import PesanPreview from './components/PesanPreview.jsx'
import ActionButtons from './components/ActionButtons.jsx'
import PackageList from './components/PackageList.jsx'
import Toast from './components/Toast.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import MarkerView from './components/MarkerView.jsx'
import {
    buildPesan, buildPesanPengiriman,
    konversiTelp
} from './utils.js'
import { fetchPieceOrderList, fetchUnmaskedPhone, fetchUnmaskedPhonesBulk } from './api.js'
import { supabase } from './supabase.js'
import { ArrowLeft, Bell, User } from 'lucide-react'

const EMPTY_FORM = { resi: '', nama: '', telp: '', nominal: '', address: '', jmlPaket: 0 }
const MARKERS_KEY = 'jnt_package_markers'
const MARKER_BELUM_TTD = 'belum-ttd'
const MARKER_SUDAH_BAYAR = 'sudah-bayar'

// localStorage as optimistic cache
function loadMarkersCache() {
    try { return JSON.parse(localStorage.getItem(MARKERS_KEY) || '{}') }
    catch { return {} }

}
function saveMarkersCache(m) { localStorage.setItem(MARKERS_KEY, JSON.stringify(m)) }

export default function App() {
    // ── Form state ──
    const [values, setValues] = useState(EMPTY_FORM)
    const [errors, setErrors] = useState({})

    // ── Package list state ──
    const [packages, setPackages] = useState([])
    const [loading, setLoading] = useState(true)
    const [apiError, setApiError] = useState(null)

    // ── Toast state ──
    const [toast, setToast] = useState({ message: '', type: 'success', key: 0 })
    const toastTimer = useRef(null)

    // ── Selected packages ──
    const [selectedPkgs, setSelectedPkgs] = useState([])

    // ── Layout state ──
    const [currentView, setCurrentView] = useState('pengiriman')

    // ── Markers state (Supabase, localStorage cache for instant UI) ──
    const [markers, setMarkers] = useState(loadMarkersCache)

    // ── FAB Visibility state ──
    const [isFabVisible, setIsFabVisible] = useState(true)
    const scrollTimeoutRef = useRef(null)

    // ── Mobile auto-scroll hack to hide URL bar ──
    useEffect(() => {
        // A slight timeout ensures the DOM has painted before we try scrolling
        const t = setTimeout(() => {
            window.scrollTo(0, 1)
        }, 100)
        return () => clearTimeout(t)
    }, [])

    // ── Auto-hide FAB on scroll inactivity ──
    useEffect(() => {
        if (currentView !== 'pengiriman') return

        const handleScroll = () => {
            setIsFabVisible(true)

            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current)
            }

            scrollTimeoutRef.current = setTimeout(() => {
                setIsFabVisible(false)
            }, 5000)
        }

        window.addEventListener('scroll', handleScroll, { passive: true })

        // Initial timer start
        handleScroll()

        return () => {
            window.removeEventListener('scroll', handleScroll)
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
        }
    }, [currentView])

    /* ── Fetch package list ── */
    const loadPackages = useCallback(async () => {
        setLoading(true)
        setApiError(null)
        try {
            const list = await fetchPieceOrderList()
            setPackages(list)
        } catch (err) {
            console.error('[JNT API]', err)
            setApiError(err.message || 'Gagal mengambil data paket.')
        } finally {
            setLoading(false)
        }
    }, [])

    /* ── Background fetch unmasked phones ── */
    const fetchMissingPhones = useCallback(async (packageList) => {
        const needsPhoneResis = packageList.filter(p => !p.telp && p.maskedPhone).map(p => p.resi)
        if (needsPhoneResis.length === 0) return

        const CHUNK_SIZE = 50
        for (let i = 0; i < needsPhoneResis.length; i += CHUNK_SIZE) {
            const chunk = needsPhoneResis.slice(i, i + CHUNK_SIZE)
            try {
                const phoneMap = await fetchUnmaskedPhonesBulk(chunk)
                if (Object.keys(phoneMap).length > 0) {
                    setPackages(prev => prev.map(pkg =>
                        phoneMap[pkg.resi] ? { ...pkg, telp: phoneMap[pkg.resi] } : pkg
                    ))
                }
            } catch (err) { console.error('[Background Phone Fetch Error]', err) }
            if (i + CHUNK_SIZE < needsPhoneResis.length)
                await new Promise(r => setTimeout(r, 500))
        }
    }, [])

    const hasLoadedInitial = useRef(false)

    useEffect(() => {
        loadPackages()
    }, [loadPackages])

    useEffect(() => {
        if (!hasLoadedInitial.current && packages.length > 0) {
            hasLoadedInitial.current = true
            fetchMissingPhones(packages)
        }
    }, [packages.length, fetchMissingPhones])

    /* ── Toast helper ── */
    const showToast = useCallback((message, type = 'success') => {
        clearTimeout(toastTimer.current)
        setToast(prev => ({ message, type, key: prev.key + 1 }))
    }, [])

    useEffect(() => {
        return () => clearTimeout(toastTimer.current)
    }, [])

    /* ── Load markers from Supabase on mount + realtime subscription ── */
    useEffect(() => {
        // Initial load
        supabase.from('package_markers').select('resi, marker')
            .then(({ data, error }) => {
                if (error) { console.error('[Supabase markers]', error); return }
                if (data) {
                    const m = Object.fromEntries(data.map(r => [r.resi, r.marker]))
                    setMarkers(m)
                    saveMarkersCache(m)
                }
            })

        // Realtime subscription
        const channel = supabase.channel('package_markers_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'package_markers' }, (payload) => {
                setMarkers(prev => {
                    const next = { ...prev }
                    if (payload.eventType === 'DELETE') {
                        delete next[payload.old.resi]
                    } else {
                        next[payload.new.resi] = payload.new.marker
                    }
                    saveMarkersCache(next)
                    return next
                })
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])

    /* ── Marker helpers ── */
    const removeMarker = useCallback(async (resi) => {
        // Optimistic update
        setMarkers(prev => {
            const next = { ...prev }
            delete next[resi]
            saveMarkersCache(next)
            return next
        })
        const { error } = await supabase.from('package_markers').delete().eq('resi', resi)
        if (error) console.error('[removeMarker]', error)
    }, [])

    const toggleMarker = useCallback(async (resi, markerType) => {
        const isRemoving = markers[resi] === markerType
        // Optimistic update
        setMarkers(prev => {
            const next = { ...prev }
            if (isRemoving) { delete next[resi] } else { next[resi] = markerType }
            saveMarkersCache(next)
            return next
        })
        if (isRemoving) {
            const { error } = await supabase.from('package_markers').delete().eq('resi', resi)
            if (error) console.error('[toggleMarker delete]', error)
        } else {
            const { error } = await supabase.from('package_markers')
                .upsert({ resi, marker: markerType }, { onConflict: 'resi' })
            if (error) console.error('[toggleMarker upsert]', error)
        }
    }, [markers])

    // Packages with marker info enriched
    const packagesWithMarkers = useMemo(() =>
        packages.map(pkg => ({ ...pkg, marker: markers[pkg.resi] || null })),
        [packages, markers]
    )

    // Filtered by marker type
    const belumTtdPackages = useMemo(() =>
        packagesWithMarkers.filter(p => p.marker === MARKER_BELUM_TTD),
        [packagesWithMarkers]
    )
    const sudahBayarPackages = useMemo(() =>
        packagesWithMarkers.filter(p => p.marker === MARKER_SUDAH_BAYAR),
        [packagesWithMarkers]
    )

    const markerCounts = useMemo(() => ({
        [MARKER_BELUM_TTD]: belumTtdPackages.length,
        [MARKER_SUDAH_BAYAR]: sudahBayarPackages.length,
    }), [belumTtdPackages.length, sudahBayarPackages.length])

    /* ── Select package → auto-fill form ── */
    const handleSelectPackage = useCallback(async (pkg) => {
        let isAlreadySelected = false

        setSelectedPkgs(prev => {
            let next = []
            isAlreadySelected = prev.some(p => p.resi === pkg.resi)

            if (isAlreadySelected) {
                next = prev.filter(p => p.resi !== pkg.resi)
            } else {
                if (prev.length > 0 && prev[0].nama !== pkg.nama) {
                    next = [pkg]
                } else {
                    next = [...prev, pkg]
                }
            }

            if (next.length === 0) {
                setValues(EMPTY_FORM); setErrors({})
                return next
            }

            const resis = next.map(p => p.resi).join(', ')
            const totalCod = next.reduce((sum, p) => sum + (parseInt(p.nominal) || 0), 0)

            setTimeout(() => {
                setValues(v => {
                    let currentPhone = v.telp
                    if (!currentPhone || currentPhone.includes('*') || currentPhone === next[0].maskedPhone) {
                        currentPhone = next[0].telp || ''
                    }
                    return {
                        resi: resis,
                        nama: next[0].nama || '',
                        telp: currentPhone,
                        nominal: totalCod ? totalCod.toString() : '0',
                        address: next[0].address || '',
                        jmlPaket: next.length
                    }
                })
                setErrors({})
            }, 0)

            return next
        })

        if (!isAlreadySelected && !pkg.telp) {
            showToast('Mengambil nomor HP asli...', 'info')
            try {
                const realPhone = await fetchUnmaskedPhone(pkg.resi)
                if (realPhone && realPhone !== pkg.maskedPhone) {
                    setValues(prev => ({ ...prev, telp: realPhone }))
                    showToast('Nomor HP asli berhasil diambil!', 'success')
                } else {
                    showToast('Nomor HP asli gagal diambil, isi manual', 'warn')
                }
            } catch { showToast('Gagal mengambil nomor HP', 'warn') }
        } else if (!isAlreadySelected) {
            showToast('Data paket diperbarui!', 'success')
        }

        if (!isAlreadySelected && selectedPkgs.length === 0) {
            setTimeout(() => {
                document.getElementById('form-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }, 100)
        }
    }, [selectedPkgs.length, showToast])

    /* ── Live message ── */
    const hasAny = Object.values(values).some(Boolean)
    const pesan = useMemo(() => {
        if (!hasAny) return ''
        return currentView === 'retur' ? buildPesan(values) : buildPesanPengiriman(values)
    }, [values, hasAny, currentView])
    const isReady = Object.values(values).every(v => String(v).trim() !== '')

    const handleChange = useCallback((id, val) => {
        setValues(prev => ({ ...prev, [id]: val }))
        setErrors(prev => ({ ...prev, [id]: '' }))
    }, [])

    /* ── Validation ── */
    const validate = useCallback(() => {
        const errs = {}
        if (!values.resi.trim()) errs.resi = 'Nomor resi wajib diisi.'
        if (!values.nama.trim()) errs.nama = 'Nama penerima wajib diisi.'
        if (!values.telp.trim()) errs.telp = 'Nomor telepon wajib diisi.'
        if (!values.nominal.trim()) errs.nominal = 'Nominal COD wajib diisi.'
        setErrors(errs)
        return Object.keys(errs).length === 0
    }, [values])

    /* ── Copy ── */
    const handleCopy = useCallback(() => {
        if (!validate()) { showToast('Lengkapi semua data dulu!', 'warn'); return }
        const doCopy = txt => navigator.clipboard?.writeText(txt).catch(() => {
            const ta = Object.assign(document.createElement('textarea'), { value: txt, style: 'position:fixed;opacity:0' })
            document.body.appendChild(ta); ta.focus(); ta.select()
            document.execCommand('copy'); document.body.removeChild(ta)
        })
        doCopy(pesan).then(() => showToast('Pesan berhasil disalin!', 'success'))
    }, [validate, pesan, showToast])

    /* ── Send WA ── */
    const handleKirim = useCallback(() => {
        if (!validate()) { showToast('Lengkapi semua data dulu!', 'warn'); return }
        const nomor = konversiTelp(values.telp)
        const encoded = encodeURIComponent(pesan)
        window.open(`https://wa.me/${nomor}?text=${encoded}`, '_blank', 'noopener,noreferrer')
        showToast('WhatsApp sedang dibuka...', 'info')
    }, [validate, values.telp, pesan, showToast])

    /* ── Reset ── */
    const handleReset = useCallback(() => {
        setValues(EMPTY_FORM); setErrors({}); setSelectedPkgs([])
        showToast('Form telah direset', 'info')
    }, [showToast])

    /* ── Marker view config ── */
    const isMarkerView = currentView === MARKER_BELUM_TTD || currentView === MARKER_SUDAH_BAYAR
    const mvConfig = {
        'belum-ttd': {
            title: 'Sudah Diantar, Belum Bayar',
            subtitle: 'Paket sudah diantar, menunggu TTD & pembayaran',
            gradient: 'from-amber-600 via-amber-500 to-orange-400',
            shadow: 'shadow-amber-500/20',
            emptyText: 'Belum ada paket yang ditandai "Sudah Diantar, Belum Bayar"',
            emptyHint: 'Di tab Konfirmasi Pengiriman, klik tombol pada kartu paket lalu pilih "Sudah Diantar, Belum Bayar".',
            markerType: MARKER_BELUM_TTD,
            accent: 'amber',
        },
        'sudah-bayar': {
            title: 'Sudah Bayar, Belum Diantar',
            subtitle: 'Pelanggan sudah bayar, paket belum diantar',
            gradient: 'from-emerald-600 via-emerald-500 to-teal-400',
            shadow: 'shadow-emerald-500/20',
            emptyText: 'Belum ada paket yang ditandai "Sudah Bayar, Belum Diantar"',
            emptyHint: 'Di tab Konfirmasi Pengiriman, klik tombol pada kartu paket lalu pilih "Sudah Bayar, Belum Diantar".',
            markerType: MARKER_SUDAH_BAYAR,
            accent: 'emerald',
        }
    }
    const currentMvConfig = isMarkerView ? mvConfig[currentView] : null
    const mvPackages = currentView === MARKER_BELUM_TTD ? belumTtdPackages
        : currentView === MARKER_SUDAH_BAYAR ? sudahBayarPackages : []

    return (
        <ErrorBoundary onReset={loadPackages}>
            <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen flex flex-col font-sans antialiased">
                {/* ── Top Header ── */}
                <header className="sticky top-0 z-50 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-lg border-b border-slate-200/80 dark:border-slate-800/80 px-4 py-3 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <button className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            <ArrowLeft size={22} className="text-slate-700 dark:text-slate-300" />
                        </button>
                        <h1 className="text-lg font-bold tracking-tight font-display">
                            {currentView === 'retur' ? 'Konfirmasi Retur' : currentView === 'pengiriman' ? 'Konfirmasi Pengiriman' : currentMvConfig?.title || 'J&T Courier'}
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            <Bell size={20} className="text-slate-600 dark:text-slate-400" />
                        </button>
                        <button className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <User size={20} className="text-primary" />
                        </button>
                    </div>
                </header>


                <main className="flex-1 flex flex-col w-full max-w-md mx-auto relative pb-32">
                    {/* ── Marker Views ── */}
                    {isMarkerView && (
                        <div className="p-4">
                            <MarkerView
                                packages={mvPackages}
                                config={currentMvConfig}
                                currentView={currentView}
                                setCurrentView={setCurrentView}
                                onRemoveMarker={(resi) => { removeMarker(resi); showToast('Penanda dihapus', 'info') }}
                                showToast={showToast}
                            />
                        </div>
                    )}

                    {/* ── Retur / Pengiriman Views ── */}
                    {!isMarkerView && (
                        <div className="flex flex-col flex-1 w-full">
                            {/* Package List */}
                            <div className="w-full relative px-4 pt-4">
                                <PackageList
                                    packages={packagesWithMarkers}
                                    loading={loading}
                                    error={apiError}
                                    selectedResis={selectedPkgs.map(p => p.resi)}
                                    onSelect={handleSelectPackage}
                                    onRetry={loadPackages}
                                    currentView={currentView}
                                    onToggleMarker={toggleMarker}
                                    showToast={showToast}
                                />
                            </div>

                            {/* Form (Retur only) */}
                            {currentView === 'retur' && (
                                <div className="w-full flex flex-col gap-4 px-4 pb-4">
                                    <div id="form-section">
                                        <ReturnForm values={values} errors={errors} onChange={handleChange} />
                                    </div>

                                    <div className="bg-white dark:bg-surface-dark rounded-xl shadow-sm p-5 border border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Preview Pesan
                                            </span>
                                            <span className={`badge ${isReady ? 'badge-success' : 'badge-neutral'}`}>
                                                {isReady ? 'Siap kirim' : 'Belum diisi'}
                                            </span>
                                        </div>
                                        <PesanPreview pesan={pesan} />
                                        <ActionButtons onCopy={handleCopy} onKirim={handleKirim} onReset={handleReset} />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </main>

                {/* ── One-Handed Action Bar (Only on Pengiriman List view) ── */}
                {currentView === 'pengiriman' && (
                    <div
                        className={`fixed left-4 right-4 z-40 max-w-md mx-auto transition-all duration-500 ease-in-out ${isFabVisible ? 'bottom-24 translate-y-0 opacity-100' : '-bottom-32 translate-y-full opacity-0 pointer-events-none'
                            }`}
                    >
                        <div className="bg-white dark:bg-[#1a1a1a] p-3 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.15)] border border-slate-200/80 dark:border-slate-800/80 flex gap-3">
                            <button onClick={() => setCurrentView('belum-ttd')} className="flex-1 flex flex-col items-center justify-center py-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl transition-all active:scale-95 hover:bg-amber-100 dark:hover:bg-amber-900/30">
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-500 mb-1"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide text-center leading-tight">Diantar<br />Belum Bayar</span>
                                <span className="text-sm font-bold text-amber-900 dark:text-amber-300 mt-0.5">{markerCounts[MARKER_BELUM_TTD]} Paket</span>
                            </button>
                            <button onClick={() => setCurrentView('sudah-bayar')} className="flex-1 flex flex-col items-center justify-center py-3 bg-primary text-white rounded-xl shadow-lg shadow-primary/30 transition-all active:scale-95 hover:bg-primary-dark">
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                                <span className="text-[10px] font-bold text-white/90 uppercase tracking-wide text-center leading-tight">Bayar<br />Belum Diantar</span>
                                <span className="text-sm font-bold mt-0.5">{markerCounts[MARKER_SUDAH_BAYAR]} Paket</span>
                            </button>
                        </div>
                    </div>
                )}

                <Sidebar
                    currentView={currentView}
                    setCurrentView={setCurrentView}
                    markerCounts={markerCounts}
                />

                <Toast key={toast.key} message={toast.message} type={toast.type} />
            </div>
        </ErrorBoundary>
    )
}
