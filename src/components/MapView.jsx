import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../supabase.js'
import { fetchOptimizedRoute } from '../api.js'

const MAP_PINS_KEY = 'jnt_map_pins'
const DEFAULT_CENTER = [-4.5586, 105.4068] // Lampung, Indonesia
const DEFAULT_ZOOM = 13

/* ── Google Satellite tile URL (free public) ── */
const GOOGLE_SAT_URL = 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
const GOOGLE_HYBRID_URL = 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'

// localStorage as optimistic cache
function loadPinsCache() {
    try { return JSON.parse(localStorage.getItem(MAP_PINS_KEY) || '[]') }
    catch { return [] }
}
function savePinsCache(pins) { localStorage.setItem(MAP_PINS_KEY, JSON.stringify(pins)) }

export default function MapView({ packages = [] }) {
    const mapRef = useRef(null)        // Leaflet map instance
    const mapDivRef = useRef(null)     // DOM element
    const markersRef = useRef({})      // resi/id → Leaflet marker
    const userMarkerRef = useRef(null) // User position marker
    const watchIdRef = useRef(null)    // Geolocation watch ID
    const [pins, setPins] = useState(loadPinsCache)
    const [isHybrid, setIsHybrid] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [searching, setSearching] = useState(false)
    const [searchResult, setSearchResult] = useState(null)
    const [selectedPin, setSelectedPin] = useState(null)
    const [userPos, setUserPos] = useState(null)
    const [locating, setLocating] = useState(true)
    const tileLayerRef = useRef(null)

    // ── Route planning ──
    const [routeMode, setRouteMode] = useState(false)
    const [selectedStops, setSelectedStops] = useState([])   // pin ids in order
    const [routeData, setRouteData] = useState(null)         // processed result
    const [routeLoading, setRouteLoading] = useState(false)
    const routeLayerRef = useRef([])                          // Leaflet polyline layers
    const [routeSource, setRouteSource] = useState('pins')    // 'pins' or 'packages'
    const [packageCoords, setPackageCoords] = useState({})    // resi -> {lat, lng}

    // Convert packages to stops format (need geocoding first)
    const getPackageStops = useCallback(async () => {
        const stops = []
        for (const pkg of packages) {
            if (packageCoords[pkg.resi]) {
                stops.push({
                    id: pkg.resi,
                    lat: packageCoords[pkg.resi].lat,
                    lng: packageCoords[pkg.resi].lng,
                    label: pkg.nama || pkg.resi,
                })
            } else if (pkg.address) {
                try {
                    const q = encodeURIComponent(pkg.address + ', Lampung, Indonesia')
                    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`)
                    const data = await res.json()
                    if (data.length > 0) {
                        const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
                        setPackageCoords(prev => ({ ...prev, [pkg.resi]: coords }))
                        stops.push({
                            id: pkg.resi,
                            lat: coords.lat,
                            lng: coords.lng,
                            label: pkg.nama || pkg.resi,
                        })
                    }
                } catch (e) {
                    console.warn('[geocode]', pkg.resi, e)
                }
            }
        }
        return stops
    }, [packages, packageCoords])

    /* ── Init Leaflet map ── */
    useEffect(() => {
        if (mapRef.current || !mapDivRef.current || !window.L) return

        const L = window.L
        const map = L.map(mapDivRef.current, {
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
            zoomControl: false,
        })

        // Add zoom control bottom right
        L.control.zoom({ position: 'bottomright' }).addTo(map)

        // Satellite tile layer
        tileLayerRef.current = L.tileLayer(GOOGLE_SAT_URL, {
            subdomains: ['0', '1', '2', '3'],
            maxZoom: 21,
            attribution: '© Google Maps',
        }).addTo(map)

        mapRef.current = map

        // ── Auto-detect user location on load ──
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    if (!mapRef.current) return;
                    const { latitude: lat, longitude: lng } = pos.coords
                    mapRef.current.flyTo([lat, lng], 16, { duration: 1.8 })
                    setLocating(false)
                    setUserPos({ lat, lng })
                },
                () => { if (mapRef.current) setLocating(false) }, // denied → stay at default
                { enableHighAccuracy: true, timeout: 8000 }
            )

            // Watch position for live updates
            watchIdRef.current = navigator.geolocation.watchPosition(
                (pos) => {
                    const { latitude: lat, longitude: lng } = pos.coords
                    setUserPos({ lat, lng })
                },
                null,
                { enableHighAccuracy: true }
            )
        } else {
            setLocating(false)
        }

        // Click to drop a pin — upsert to Supabase (disabled in route mode)
        map.on('click', async (e) => {
            // routeMode is checked via ref to avoid stale closure
            if (routeModeRef.current) return
            const { lat, lng } = e.latlng
            const newPin = {
                id: Date.now().toString(),
                lat, lng,
                label: 'Pelanggan',
                note: '',
                color: 'red',
            }
            // Optimistic update
            setPins(prev => {
                const next = [...prev, newPin]
                savePinsCache(next)
                return next
            })
            const { error } = await supabase.from('map_pins').upsert(newPin, { onConflict: 'id' })
            if (error) console.error('[addPin]', error)
        })

        return () => {
            if (watchIdRef.current != null) {
                navigator.geolocation.clearWatch(watchIdRef.current)
            }
            map.remove()
            mapRef.current = null
        }
    }, [])

    /* ── Load pins from Supabase on mount + realtime subscription ── */
    useEffect(() => {
        supabase.from('map_pins').select('*').order('updated_at', { ascending: true })
            .then(({ data, error }) => {
                if (error) { console.error('[Supabase map_pins]', error); return }
                if (data) { setPins(data); savePinsCache(data) }
            })

        const channel = supabase.channel('map_pins_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'map_pins' }, (payload) => {
                setPins(prev => {
                    let next
                    if (payload.eventType === 'DELETE') {
                        next = prev.filter(p => p.id !== payload.old.id)
                    } else if (payload.eventType === 'INSERT') {
                        const exists = prev.find(p => p.id === payload.new.id)
                        next = exists ? prev.map(p => p.id === payload.new.id ? payload.new : p) : [...prev, payload.new]
                    } else {
                        next = prev.map(p => p.id === payload.new.id ? payload.new : p)
                    }
                    savePinsCache(next)
                    return next
                })
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])

    /* ── Switch satellite ↔ hybrid ── */
    useEffect(() => {
        if (!mapRef.current || !tileLayerRef.current || !window.L) return
        const L = window.L
        tileLayerRef.current.remove()
        tileLayerRef.current = L.tileLayer(isHybrid ? GOOGLE_HYBRID_URL : GOOGLE_SAT_URL, {
            subdomains: ['0', '1', '2', '3'],
            maxZoom: 21,
            attribution: '© Google Maps',
        }).addTo(mapRef.current)
    }, [isHybrid])

    /* ── User position marker (pulsing blue dot) ── */
    useEffect(() => {
        if (!mapRef.current || !window.L || !userPos) return
        const L = window.L

        // Inject ping keyframe once
        if (!document.getElementById('jnt-ping-style')) {
            const style = document.createElement('style')
            style.id = 'jnt-ping-style'
            style.textContent = `@keyframes jnt-ping{0%{transform:scale(1);opacity:.8}100%{transform:scale(2.8);opacity:0}}`
            document.head.appendChild(style)
        }

        if (userMarkerRef.current) {
            userMarkerRef.current.setLatLng([userPos.lat, userPos.lng])
            return
        }

        const userIcon = L.divIcon({
            className: '',
            html: `<div style="position:relative;width:22px;height:22px">
                <div style="position:absolute;inset:0;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(59,130,246,0.6);z-index:2"></div>
                <div style="position:absolute;inset:-5px;background:rgba(59,130,246,0.3);border-radius:50%;animation:jnt-ping 1.6s ease-out infinite;z-index:1"></div>
            </div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
            popupAnchor: [0, -14],
        })

        userMarkerRef.current = L.marker([userPos.lat, userPos.lng], { icon: userIcon, zIndexOffset: 2000 })
            .addTo(mapRef.current)
            .bindPopup('<div style="font-family:sans-serif;font-weight:700;font-size:13px;color:#3b82f6">📍 Posisi Anda</div>')
    }, [userPos])

    /* ── Render pins on map ── */
    useEffect(() => {
        if (!mapRef.current || !window.L) return
        const L = window.L
        const map = mapRef.current

        // Remove old markers
        Object.values(markersRef.current).forEach(m => m.remove())
        markersRef.current = {}

        // Custom icon factory matching Stitch design
        const makeIcon = (color, isSelected) => {
            const iconName = isSelected ? 'location_on' : 'local_shipping'
            const scale = isSelected ? 'scale(1.15) translateY(-5px)' : 'scale(1)'
            const filled = isSelected ? `font-variation-settings: 'FILL' 1;` : ''
            const padding = isSelected ? '8px' : '5px'
            const size = isSelected ? '20px' : '16px'

            return L.divIcon({
                className: '',
                html: `
                <div style="display:flex;flex-direction:column;align-items:center;transform:${scale};transition:all 0.2s cubic-bezier(0.34,1.56,0.64,1);filter:drop-shadow(0 4px 10px rgba(0,0,0,0.2));">
                    <div style="background:${color};color:white;border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;padding:${padding}">
                        <span class="material-symbols-outlined" style="font-size:${size};${filled}">${iconName}</span>
                    </div>
                    <div style="width:4px;height:12px;background:${color};margin-top:-2px;border-radius:0 0 4px 4px;z-index:-1"></div>
                </div>`,
                iconSize: [40, 50],
                iconAnchor: [20, 50],
                popupAnchor: [0, -50],
            })
        }

        // Draw manual pins
        pins.forEach(pin => {
            const isSelected = selectedPin === pin.id
            const color = pin.color === 'blue' ? '#3b82f6' : pin.color === 'green' ? '#10b981' : '#e61920'
            const icon = makeIcon(color, isSelected)
            const marker = L.marker([pin.lat, pin.lng], { icon, draggable: true, zIndexOffset: isSelected ? 1000 : 0 })
                .addTo(map)
                .bindPopup(`
                    <div style="font-family:sans-serif;min-width:160px">
                        <div style="font-weight:700;font-size:14px;margin-bottom:4px">${pin.label}</div>
                        ${pin.note ? `<div style="font-size:12px;color:#64748b">${pin.note}</div>` : ''}
                        <div style="font-size:11px;color:#94a3b8;margin-top:4px">${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}</div>
                    </div>
                `)

            // Drag to update position
            marker.on('dragend', async () => {
                const pos = marker.getLatLng()
                setPins(prev => {
                    const next = prev.map(p => p.id === pin.id ? { ...p, lat: pos.lat, lng: pos.lng } : p)
                    savePinsCache(next)
                    return next
                })
                const { error } = await supabase.from('map_pins').update({ lat: pos.lat, lng: pos.lng }).eq('id', pin.id)
                if (error) console.error('[dragend]', error)
            })

            markersRef.current[pin.id] = marker
        })
    }, [pins, selectedPin])

    /* ── Geocode search (Nominatim) ── */
    const handleSearch = useCallback(async () => {
        if (!searchQuery.trim()) return
        setSearching(true)
        setSearchResult(null)
        try {
            const q = encodeURIComponent(searchQuery + ', Lampung, Indonesia')
            const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`)
            const data = await res.json()
            if (data.length > 0) {
                const { lat, lon, display_name } = data[0]
                const coords = [parseFloat(lat), parseFloat(lon)]
                mapRef.current?.flyTo(coords, 17, { duration: 1.5 })
                setSearchResult({ coords, name: display_name })
            } else {
                setSearchResult(null)
                alert('Lokasi tidak ditemukan. Coba dengan kata kunci yang lebih spesifik.')
            }
        } catch {
            alert('Gagal melakukan pencarian lokasi.')
        } finally {
            setSearching(false)
        }
    }, [searchQuery])

    /* ── Delete pin ── */
    const deletePin = useCallback(async (id) => {
        setPins(prev => {
            const next = prev.filter(p => p.id !== id)
            savePinsCache(next)
            return next
        })
        setSelectedPin(null)
        const { error } = await supabase.from('map_pins').delete().eq('id', id)
        if (error) console.error('[deletePin]', error)
    }, [])

    /* ── Update pin label/note/color ── */
    const updatePin = useCallback(async (id, changes) => {
        setPins(prev => {
            const next = prev.map(p => p.id === id ? { ...p, ...changes } : p)
            savePinsCache(next)
            return next
        })
        const { error } = await supabase.from('map_pins').update(changes).eq('id', id)
        if (error) console.error('[updatePin]', error)
    }, [])

    /* ── Fly to pin ── */
    const flyToPin = useCallback((pin) => {
        mapRef.current?.flyTo([pin.lat, pin.lng], 18, { duration: 1 })
        markersRef.current[pin.id]?.openPopup()
        setSelectedPin(pin.id)
    }, [])

    /* ── Go to current GPS location ── */
    const goToMyLocation = useCallback(() => {
        if (!navigator.geolocation) return
        if (userPos) {
            mapRef.current?.flyTo([userPos.lat, userPos.lng], 17, { duration: 1 })
            userMarkerRef.current?.openPopup()
            return
        }
        navigator.geolocation.getCurrentPosition(pos => {
            if (!mapRef.current) return;
            const { latitude: lat, longitude: lng } = pos.coords
            mapRef.current.flyTo([lat, lng], 17, { duration: 1.5 })
            setUserPos({ lat, lng })
        })
    }, [userPos])

    /* ── Route mode ref (to avoid stale closure in map click) ── */
    const routeModeRef = useRef(false)
    useEffect(() => { routeModeRef.current = routeMode }, [routeMode])

    /* ── Toggle a stop in route selection ── */
    const toggleStop = useCallback((pinId) => {
        setSelectedStops(prev =>
            prev.includes(pinId) ? prev.filter(id => id !== pinId) : [...prev, pinId]
        )
    }, [])

    /* ── Clear route layers from map ── */
    const clearRouteLayer = useCallback(() => {
        routeLayerRef.current.forEach(l => l.remove())
        routeLayerRef.current = []
    }, [])

    /* ── Calculate optimized route via Maposcope (via api.js) ── */
    const calculateRoute = useCallback(async () => {
        if (!userPos || selectedStops.length === 0) return
        setRouteLoading(true)
        setRouteData(null)
        clearRouteLayer()

        let stopPins = []
        if (routeSource === 'pins') {
            stopPins = selectedStops
                .map(id => pins.find(p => p.id === id))
                .filter(Boolean)
        } else {
            // For packages, we need to geocode first
            stopPins = await getPackageStops()
            stopPins = stopPins.filter(s => selectedStops.includes(s.id))
        }

        if (stopPins.length === 0) {
            alert('Tidak ada stop yang valid. Pastikan lokasi sudah teridentifikasi.')
            setRouteLoading(false)
            return
        }

        try {
            const data = await fetchOptimizedRoute(userPos, stopPins)
            setRouteData(data)
        } catch (err) {
            console.error('[calculateRoute]', err)
            alert('Gagal menghitung rute: ' + err.message)
        } finally {
            setRouteLoading(false)
        }
    }, [userPos, selectedStops, pins, routeSource, clearRouteLayer, getPackageStops])

    /* ── Draw route polylines on map when routeData changes ── */
    useEffect(() => {
        clearRouteLayer()
        if (!routeData || !mapRef.current || !window.L) return
        const L = window.L
        const COLORS = ['#f43f5e', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#c084fc', '#f472b6']

        routeData.steps.forEach((step, i) => {
            if (!step.geometry || step.geometry.length < 2) return
            const latlngs = step.geometry.map(([lng, lat]) => [lat, lng])
            const color = COLORS[i % COLORS.length]

            // Main line
            const line = L.polyline(latlngs, {
                color, weight: 5, opacity: 0.85, lineJoin: 'round', lineCap: 'round',
            }).addTo(mapRef.current)

            // Direction arrows using decorators-style dashes
            const dash = L.polyline(latlngs, {
                color: 'white', weight: 2, opacity: 0.5, dashArray: '6 14',
            }).addTo(mapRef.current)

            // Stop number marker at destination
            const dest = latlngs[latlngs.length - 1]
            const stopIcon = L.divIcon({
                className: '',
                html: `<div style="background:${color};color:white;width:22px;height:22px;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,0.4)">${i + 1}</div>`,
                iconSize: [22, 22], iconAnchor: [11, 11],
            })
            const stopMarker = L.marker(dest, { icon: stopIcon }).addTo(mapRef.current)

            routeLayerRef.current.push(line, dash, stopMarker)
        })

        // Fit bounds to show full route
        if (routeData.allGeometry.length > 0) {
            const allLatLng = routeData.allGeometry.map(([lng, lat]) => [lat, lng])
            mapRef.current.fitBounds(L.latLngBounds(allLatLng), { padding: [30, 30] })
        }
    }, [routeData, clearRouteLayer])

    /* ── Exit route mode cleanup ── */
    const exitRouteMode = useCallback(() => {
        setRouteMode(false)
        setSelectedStops([])
        setRouteData(null)
        clearRouteLayer()
    }, [clearRouteLayer])

    return (
        <div className="flex flex-col flex-1 h-full absolute inset-0 bg-gray-100 overflow-hidden">
            
            {/* BEGIN: Map Background */}
            <main className="absolute inset-0 z-0">
                <div ref={mapDivRef} className="w-full h-full bg-slate-200" />
            </main>
            {/* END: Map Background */}

            {/* BEGIN: Search Header */}
            <header className="absolute top-10 left-0 right-0 px-4 z-20 pointer-events-none">
                <div className="flex items-center bg-white rounded-xl shadow-lg p-2 gap-2 pointer-events-auto">
                    <div className="p-2 text-gray-400">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                        </svg>
                    </div>
                    <input 
                        type="text"
                        className="flex-1 border-none focus:ring-0 text-sm py-2 outline-none" 
                        placeholder="Cari alamat..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    {searchQuery && !searching && (
                        <button
                            onClick={() => { setSearchQuery(''); setSearchResult(null) }}
                            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>
                    )}
                    {searching ? (
                        <div className="p-2 text-[#F28C8C] flex items-center justify-center">
                            <span className="material-symbols-outlined text-[20px] animate-spin">sync</span>
                        </div>
                    ) : (
                        <button 
                            onClick={handleSearch}
                            disabled={!searchQuery.trim()}
                            className="bg-[#F28C8C] hover:bg-[#eb7474] text-white p-2 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center"
                        >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                            </svg>
                        </button>
                    )}
                </div>

                {/* Search Results Dropdown (Adapted to Match Style) */}
                {searchResult && (
                    <div className="absolute top-full left-4 right-4 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden pointer-events-auto">
                        <div className="p-3 border-b border-gray-100">
                            <p className="text-xs font-bold text-[#F28C8C] uppercase tracking-wide mb-1">Hasil Pencarian</p>
                            <p className="text-xs text-gray-600 line-clamp-2">{searchResult.name}</p>
                        </div>
                        <div className="flex gap-2 p-2">
                            <button
                                onClick={() => {
                                    const newPin = {
                                        id: Date.now().toString(),
                                        lat: searchResult.coords[0],
                                        lng: searchResult.coords[1],
                                        label: 'Pelanggan Baru',
                                        note: searchResult.name,
                                        color: 'red',
                                    }
                                    setPins(prev => {
                                        const next = [...prev, newPin]
                                        savePinsCache(next)
                                        return next
                                    })
                                    supabase.from('map_pins').upsert(newPin, { onConflict: 'id' })
                                    setSearchResult(null)
                                    setSearchQuery('')
                                }}
                                className="flex-1 py-2.5 rounded-lg bg-[#F28C8C] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md"
                            >
                                <span className="material-symbols-outlined text-[16px]">add_location</span>
                                Tambah Pin
                            </button>
                            <button
                                onClick={() => {
                                    mapRef.current?.flyTo(searchResult.coords, 18, { duration: 1 })
                                    setSearchResult(null)
                                }}
                                className="flex-1 py-2.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center gap-1.5"
                            >
                                <span className="material-symbols-outlined text-[16px]">visibility</span>
                                Lihat
                            </button>
                        </div>
                    </div>
                )}
            </header>
            {/* END: Search Header */}

            {/* BEGIN: Floating Action Buttons */}
            <div className="absolute top-28 right-4 flex flex-col gap-3 z-20 pointer-events-auto">
                <button 
                    onClick={() => setIsHybrid(h => !h)}
                    title={isHybrid ? 'Mode Satelit' : 'Mode Hybrid'}
                    className={`p-2.5 rounded-lg shadow-md transition-colors flex justify-center items-center ${isHybrid ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                    </svg>
                </button>
                <button 
                    onClick={goToMyLocation}
                    title={locating ? 'Mendeteksi...' : 'Lokasi Saya'}
                    className={`p-2.5 rounded-lg shadow-md transition-colors flex items-center justify-center ${locating ? 'bg-[#EF4444]/50 animate-pulse text-white' : userPos ? 'bg-[#EF4444] text-white hover:bg-red-600' : 'bg-white text-[#EF4444] hover:bg-gray-50'}`}
                >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                </button>
                <button 
                    onClick={() => routeMode ? exitRouteMode() : setRouteMode(true)}
                    title={routeMode ? 'Keluar Mode Rute' : 'Mode Rute'}
                    className={`p-2.5 rounded-lg shadow-md transition-colors flex items-center justify-center ${routeMode ? 'bg-[#EC4899] text-white hover:bg-pink-600' : 'bg-white text-[#EC4899] hover:bg-gray-50'}`}
                >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L16 4m0 13V4m0 0L9 7"></path>
                    </svg>
                </button>
            </div>
            {/* END: Floating Action Buttons */}

            {/* Hint pill */}
            <div className={`absolute bottom-32 left-1/2 -translate-x-1/2 z-20 pointer-events-none transition-opacity duration-300 ${routeMode || selectedPin || searchResult ? 'opacity-0' : 'opacity-100'}`}>
                <div className="bg-gray-900/80 text-white text-xs px-4 py-2 rounded-full shadow-md font-medium flex items-center gap-1.5 backdrop-blur-sm">
                    <span className="material-symbols-outlined text-[14px]">touch_app</span>
                    Klik peta untuk tambah pin
                </div>
            </div>

            {/* BEGIN: Customer Bottom Sheet / Route Panel */}
            <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-[32px] shadow-[0_-10px_30px_rgba(0,0,0,0.1)] z-30 transition-transform duration-300 flex flex-col max-h-[50vh] ${routeMode || selectedPin ? 'translate-y-0' : 'translate-y-full'}`}>
                {/* Handle for dragging (visual) */}
                <div className="w-full flex justify-center py-3 shrink-0">
                    <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
                </div>
                
                <div className="px-6 pb-6 pt-2 flex flex-col min-h-0">
                    
                    {routeMode ? (
                        /* ── ROUTE PLANNING PANEL ── */
                        <div className="flex flex-col h-full min-h-0">
                            {/* Header */}
                            <div className="pb-3 shrink-0 flex items-center justify-between">
                                <div className="text-sm font-bold uppercase tracking-wider text-[#EC4899] flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px]">route</span> Rencana Rute
                                </div>
                                {selectedStops.length > 0 && (
                                    <span className="bg-[#EC4899] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                        {selectedStops.length} stop
                                    </span>
                                )}
                            </div>

                            {routeData ? (
                                /* ── RESULT VIEW ── */
                                <div className="flex flex-col h-full min-h-0 overflow-y-auto mt-2 custom-scrollbar pr-2">
                                    <div className="flex flex-col gap-3 pb-8">
                                        {/* Start */}
                                        <div className="flex items-center gap-3 p-3 border border-blue-100 rounded-2xl bg-blue-50/50">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                                                <span className="material-symbols-outlined text-[16px]">navigation</span>
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-blue-800 text-sm">Posisi Kamu (Start)</h3>
                                            </div>
                                        </div>

                                        {routeData.steps.map((step, i) => (
                                            <div key={step.id} className="flex items-center p-3 border border-gray-100 rounded-2xl bg-white shadow-sm" data-purpose="customer-card">
                                                <div className="w-8 h-8 rounded-full bg-[#F28C8C] flex items-center justify-center text-white shrink-0 shadow-sm mr-3 font-bold text-xs">
                                                    {i + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-semibold text-gray-800 text-sm truncate">{step.pinLabel}</h3>
                                                    <p className="text-xs text-gray-500 font-mono tracking-wider mt-0.5">{step.distance}m · {Math.ceil(step.duration / 60)} mnt</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 mt-4 shrink-0">
                                        <button 
                                            onClick={() => { setRouteData(null); clearRouteLayer() }}
                                            className="flex-1 bg-gray-100 text-gray-700 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">refresh</span> Ubah
                                        </button>
                                        <button 
                                            onClick={() => {
                                                if (routeData?.steps?.[0]) {
                                                    const firstStop = routeData.steps[0]
                                                    if (firstStop.pinId) {
                                                        const pkg = packages.find(p => p.resi === firstStop.pinId)
                                                        const pin = pins.find(p => p.id === firstStop.pinId)
                                                        const dest = pkg ? packageCoords[pkg.resi] : (pin ? { lat: pin.lat, lng: pin.lng } : null)
                                                        if (dest) {
                                                            window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=driving`, '_blank')
                                                        }
                                                    }
                                                }
                                            }}
                                            className="flex-[2] bg-[#F28C8C] text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.98]"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">directions</span> Mulai Jalan
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* ── STOP SELECTION VIEW ── */
                                <>
                                    {/* Tabs */}
                                    <div className="flex gap-2 mb-4 shrink-0">
                                        <button
                                            onClick={() => setRouteSource('pins')}
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${routeSource === 'pins'
                                                ? 'bg-[#F28C8C] text-white shadow-md'
                                                : 'bg-gray-100 text-gray-500'
                                                }`}
                                        >
                                            <span className="material-symbols-outlined text-[14px] align-middle mr-1">location_on</span>
                                            Pins ({pins.length})
                                        </button>
                                        <button
                                            onClick={() => setRouteSource('packages')}
                                            disabled={packages.length === 0}
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${routeSource === 'packages'
                                                ? 'bg-[#F28C8C] text-white shadow-md'
                                                : 'bg-gray-100 text-gray-500'
                                                } disabled:opacity-50`}
                                        >
                                            <span className="material-symbols-outlined text-[14px] align-middle mr-1">inventory_2</span>
                                            Paket ({packages.length})
                                        </button>
                                    </div>

                                    {/* Lists */}
                                    <div className="flex-1 overflow-y-auto mb-4 custom-scrollbar pr-2 min-h-0 h-[250px]">
                                        <div className="space-y-3">
                                            {routeSource === 'pins' ? (
                                                pins.length === 0 ? (
                                                    <div className="py-8 text-center text-gray-400 text-sm">
                                                        <span className="material-symbols-outlined text-[36px] text-gray-300 mb-2 block">location_on</span>
                                                        Belum ada pin.
                                                    </div>
                                                ) : (
                                                    pins.map(pin => {
                                                        const isChosen = selectedStops.includes(pin.id)
                                                        const order = selectedStops.indexOf(pin.id) + 1
                                                        return (
                                                            <div 
                                                                key={pin.id}
                                                                onClick={() => toggleStop(pin.id)}
                                                                className={`flex items-center p-3 border rounded-2xl bg-white shadow-sm cursor-pointer transition-colors ${isChosen ? 'border-amber-300 bg-amber-50/20' : 'border-gray-100 hover:border-blue-100'}`}
                                                                data-purpose="customer-card"
                                                            >
                                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-4 shrink-0 transition-colors ${isChosen ? 'bg-[#F28C8C] text-white shadow-md' : 'bg-blue-50 text-blue-600'}`}>
                                                                    {isChosen ? (
                                                                        <span className="font-bold">{order}</span>
                                                                    ) : (
                                                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                                                                        </svg>
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <h3 className="font-semibold text-gray-800 text-sm truncate">{pin.label}</h3>
                                                                    <p className="text-xs text-gray-500 font-mono tracking-wider truncate">{pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}</p>
                                                                </div>
                                                            </div>
                                                        )
                                                    })
                                                )
                                            ) : (
                                                packages.length === 0 ? (
                                                    <div className="py-8 text-center text-gray-400 text-sm">
                                                        <span className="material-symbols-outlined text-[36px] text-gray-300 mb-2 block">inventory_2</span>
                                                        Daftar paket kosong.
                                                    </div>
                                                ) : (
                                                    packages.slice(0, 20).map(pkg => {
                                                        const isChosen = selectedStops.includes(pkg.resi)
                                                        const order = selectedStops.indexOf(pkg.resi) + 1
                                                        const hasCoords = !!packageCoords[pkg.resi]
                                                        return (
                                                            <div 
                                                                key={pkg.resi}
                                                                onClick={() => {
                                                                    if (!hasCoords && pkg.address) toggleStop(pkg.resi + '_pending')
                                                                    else if (hasCoords) toggleStop(pkg.resi)
                                                                }}
                                                                className={`flex items-center p-3 border rounded-2xl bg-white shadow-sm transition-colors ${!hasCoords && !pkg.address ? 'opacity-50 cursor-not-allowed border-gray-100' : 'cursor-pointer'} ${isChosen ? 'border-amber-300 bg-amber-50/20' : 'border-gray-100 hover:border-blue-100'}`}
                                                                data-purpose="customer-card"
                                                            >
                                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-4 shrink-0 transition-colors ${isChosen ? 'bg-[#F28C8C] text-white shadow-md' : hasCoords ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                                                                    {isChosen ? (
                                                                        <span className="font-bold">{order}</span>
                                                                    ) : hasCoords ? (
                                                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                                                                        </svg>
                                                                    ) : '⏳'}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <h3 className="font-semibold text-gray-800 text-sm truncate">{pkg.nama || pkg.resi}</h3>
                                                                    <p className="text-xs text-gray-500 mt-0.5 truncate">{pkg.address || 'Alamat tidak tersedia'}</p>
                                                                </div>
                                                            </div>
                                                        )
                                                    })
                                                )
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Primary CTA Button */}
                                    <div className="shrink-0 pb-2">
                                        <button 
                                            onClick={calculateRoute}
                                            disabled={routeLoading || selectedStops.length === 0 || !userPos}
                                            className="w-full bg-[#F28C8C] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
                                            id="cta-button"
                                        >
                                            {routeLoading ? (
                                                <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                                            ) : (
                                                <>
                                                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L16 4m0 13V4m0 0L9 7"></path>
                                                    </svg>
                                                    Hitung Rute ({selectedStops.length} stop)
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : selectedPin ? (
                        /* ── CUSTOMER PIN DETAILS ── */
                        (() => {
                            const pin = pins.find(p => p.id === selectedPin)
                            if (!pin) return null
                            return (
                                <div className="flex flex-col h-full min-h-[220px]">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="bg-[#F28C8C]/10 text-[#F28C8C] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Pin Pelanggan</span>
                                                <span className="text-gray-400 text-xs font-mono">{pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}</span>
                                            </div>
                                            <h3 className="text-gray-900 text-lg font-bold">{pin.label}</h3>
                                            <p className="text-gray-500 text-xs mt-1.5 flex items-start gap-1">
                                                <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0 text-gray-400">location_on</span>
                                                {pin.note || 'Tidak ada catatan khusus.'}
                                            </p>
                                        </div>
                                        <button onClick={() => setSelectedPin(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 ml-4 hover:bg-gray-200 transition-colors">
                                            <span className="material-symbols-outlined text-[18px]">close</span>
                                        </button>
                                    </div>

                                    <div className="flex gap-3 mt-auto pb-4 pt-2">
                                        <button 
                                            onClick={() => deletePin(pin.id)} 
                                            className="flex-1 flex items-center justify-center py-3.5 rounded-2xl border border-red-200 bg-red-50 text-red-600 text-sm font-bold transition-transform active:scale-95"
                                        >
                                            <span className="material-symbols-outlined text-[18px] mr-1.5">delete</span> Hapus
                                        </button>
                                        <button 
                                            onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}`, '_blank')}
                                            className="flex-[2] flex items-center justify-center py-3.5 rounded-2xl bg-[#F28C8C] text-white text-sm font-bold shadow-lg shadow-[#F28C8C]/30 transition-transform active:scale-[0.98]"
                                        >
                                            <span className="material-symbols-outlined text-[18px] mr-1.5">directions</span> Arahkan
                                        </button>
                                    </div>
                                </div>
                            )
                        })()
                    ) : null}
                </div>
            </div>
            {/* END: Customer Bottom Sheet */}
            
        </div>
    )
}

/* PinCard component removed since it's not used in this layout anymore */
