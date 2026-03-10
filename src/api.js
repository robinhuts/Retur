/**
 * J&T Express API client — talks to our own secure proxy server (server.js)
 * No credentials here — all secrets are kept server-side.
 */

const ENDPOINT_PACKAGES = '/api/packages'
const ENDPOINT_UNMASK = '/api/unmask-phones'
const ENDPOINT_ROUTE = '/api/route'

function sanitizeString(str, maxLength = 500) {
    if (typeof str !== 'string') return ''
    return str.slice(0, maxLength).replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim()
}

function normalizePackage(item) {
    if (!item || typeof item !== 'object') {
        console.warn('[normalizePackage] Invalid item:', item)
        return null
    }

    const maskedPhone = sanitizeString(item.receivermobile, 20)
    const isMasked = maskedPhone.includes('*')

    const resi = sanitizeString(item.billcode, 50)
    if (!resi) {
        console.warn('[normalizePackage] Missing billcode, skipping')
        return null
    }

    return {
        resi,
        nama: sanitizeString(item.receivername, 100),
        telp: isMasked ? '' : maskedPhone,
        nominal: String(item.itemsvalue ?? ''),
        address: sanitizeString(item.receiveraddress, 500),
        area: sanitizeString(item.receiverarea, 100),
        carrier: sanitizeString(item.carrierName, 100),
        type: sanitizeString(item.showExpressType, 50),
        maskedPhone: isMasked ? maskedPhone : '',
    }
}

/**
 * Fetch the list of packages currently assigned to the courier.
 */
export async function fetchPieceOrderList() {
    const res = await fetch(ENDPOINT_PACKAGES)

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)

    const json = await res.json()

    if (Number(json.code) !== 20000) {
        throw new Error(json.desc || json.msg || `API error (code ${json.code})`)
    }

    const raw = typeof json.data === 'string' ? JSON.parse(json.data) : json.data
    const list = Array.isArray(raw) ? raw : (raw?.list ?? [])

    return list.map(normalizePackage).filter(Boolean)
}

/**
 * Fetch real (unmasked) phones for a batch of resis.
 * Uses app.queryReverseCheck API - bulk waybill.
 * @param {string[]} resis
 * @returns {Promise<Object>} { resi: phone }
 */
export async function fetchUnmaskedPhonesBulk(resis) {
    if (!resis || !resis.length) return {}

    try {
        const res = await fetch('/api/unmask-phones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ billcodes: resis }),
        })

        if (!res.ok) {
            console.error('[UNMASK] HTTP error:', res.status)
            return {}
        }

        const json = await res.json()
        
        if (Number(json.code) !== 20000) {
            console.error('[UNMASK] API error:', json.desc || json.msg)
            return {}
        }

        const phoneMap = {}
        const raw = typeof json.data === 'string' ? JSON.parse(json.data) : json.data
        
        if (Array.isArray(raw)) {
            raw.forEach(item => {
                const resi = item.waybillId || item.billcode
                const phone = item.receiverMobilePhone || item.phoneNumber
                if (resi && phone && !phone.includes('*')) {
                    phoneMap[resi] = phone
                }
            })
        }

        return phoneMap
    } catch (e) {
        console.error('[UNMASK ERROR]', e)
        return {}
    }
}

/**
 * Fetch real phone for a single resi (legacy — used in Retur mode select).
 */
export async function fetchUnmaskedPhone(resi) {
    if (!resi) return ''
    const map = await fetchUnmaskedPhonesBulk([resi])
    return map[resi] || ''
}

/** Default start/end depot (used when GPS is not yet available) */
const DEFAULT_POS = { lat: -4.243727196695598, lng: 105.47841551521823 }

/**
 * Calculate an optimized delivery route via Maposcope.
 * @param {{ lat: number, lng: number }|null} userPos  — GPS start/end (falls back to DEFAULT_POS)
 * @param {{ id: string, lat: number, lng: number, label: string }[]} pins — stops
 * @returns {Promise<{ totalDistance, totalDuration, steps, allGeometry }>}
 */
export async function fetchOptimizedRoute(userPos, pins) {
    if (!pins.length) throw new Error('pins are required')

    const origin = userPos ?? DEFAULT_POS   // ← use GPS if available, else hardcoded depot
    const stops = pins.map((pin, idx) => ({
        id: 100 + idx,
        location: [pin.lng, pin.lat],   // Maposcope expects [lng, lat]
        priority: 0,
        service: 120,
    }))

    const now = Math.floor(Date.now() / 1000)
    const payload = {
        android_version: '16, 36', app_version: '25.12.08.01',
        country: 'ID', device: '24069PC21G,Xiaomi',
        driver: {
            end: [origin.lng, origin.lat],
            start: [origin.lng, origin.lat],
            time_window: [now, now + 60],
        },
        lang: 'id-ID,id,ID', optimization: 1,
        plan: 'Trial license', rot: 2,
        stops,
        timezone: 'Asia/Jakarta',
        uid: import.meta.env.VITE_MAPOSCOPE_UID || 'b8524773-740f-45c4-8376-71fb80991e13',
        vehicle_type: 0,
    }

    const res = await fetch(ENDPOINT_ROUTE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })

    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
    }

    const json = await res.json()
    if (json.code !== 0) throw new Error(json.message || `Maposcope error code ${json.code}`)

    // Build a pin-id → label lookup
    const pinById = Object.fromEntries(pins.map((p, idx) => [String(100 + idx), p]))

    const route = json.route
    const steps = route.steps
        .filter(s => s.id !== 'START' && s.id !== 'STOP')
        .map(step => {
            const pin = pinById[step.id]
            return { ...step, pinId: pin?.id, pinLabel: pin?.label || step.id }
        })

    return {
        totalDistance: route.distance,        // metres
        totalDuration: route.duration_travel,  // seconds (travel only)
        steps,
        allGeometry: route.steps.flatMap(s => s.geometry || []),
    }
}
