import 'dotenv/config'
import express from 'express'
import fetch from 'node-fetch'
import FormData from 'form-data'
import axios from 'axios'

const app = express()
const PORT = process.env.SERVER_PORT || 3001

// ─── JnT Credentials (never sent to browser) ───────────────────────────────
const AUTH_TOKEN = process.env.JNT_AUTH_TOKEN
const SIGNATURE = process.env.JNT_SIGNATURE
const SIG_ID = process.env.JNT_SIGNATURE_ID
const USER_CODE = process.env.JNT_USER_CODE
const SITE_NAME = process.env.JNT_SITE_NAME
const IMEI = process.env.JNT_IMEI
const MAC = process.env.JNT_MAC
const POSITION = process.env.JNT_POSITION
const JNT_COOKIE = process.env.JNT_COOKIE

const JNT_BASE = 'https://bc.jntexpress.id'
const COMMON_HEADERS = {
    imei: IMEI,
    phonetype: 'POCO 24069PC21G',
    androidid: IMEI,
    'app-platform': 'Android_com.jt.express.indonesia.operate.out',
    devicefrom: 'android',
    'app-channel': 'Internal Deliver',
    mac: MAC,
    langtype: 'ID',
    deviceversion: 'Android-16',
    lang: 'id',
    'user-agent': 'Android-POCO 24069PC21G/app_out',
    source: 'outfield',
    position: POSITION,
    longandlat: POSITION,
    'x-simplypost-signature': SIGNATURE,
    version: '3.5.4',
    'x-simplypost-id': SIG_ID,
    sdkversion: '36',
    serialnumber: 'serialNumber',
    authtoken: AUTH_TOKEN,
    cookie: JNT_COOKIE,
    'Accept-Encoding': 'gzip'
}

function buildFormData(dataObj, method) {
    const data = JSON.stringify(dataObj)
    const fields = {
        androidId: IMEI, data, deviceVersion: 'Android-16',
        fcmToken: AUTH_TOKEN, format: 'json', imei: IMEI,
        ip: '127.0.0.1', langType: 'id', mac: MAC, method,
        phoneType: 'POCO 24069PC21G', platform: 'android',
        position: POSITION, sessionid: AUTH_TOKEN, source: 'outfield',
        subUserCode: USER_CODE, tempUser: '1', userCode: USER_CODE,
        v: '1.0', version: '3.5.4',
    }
    const fd = new FormData()
    Object.entries(fields).forEach(([k, v]) => fd.append(k, v))
    return fd
}

// ─── Route: Get package list ────────────────────────────────────────────────
app.get('/api/packages', async (req, res) => {
    try {
        const body = buildFormData({
            parameter: {
                labelTagType: '派件',
                rangeType: '3',
                siteName: SITE_NAME,
                userCode: USER_CODE,
            }
        }, '/scanquery/order/findPieceOrderList')

        const response = await fetch(`${JNT_BASE}/scanquery/order/findPieceOrderList`, {
            method: 'POST',
            headers: { ...COMMON_HEADERS, ...body.getHeaders() },
            body,
        })

        const json = await response.json()
        res.json(json)
    } catch (err) {
        console.error('[/api/packages]', err)
        res.status(502).json({ error: err.message })
    }
})

// ─── Route: Unmask phone numbers (bulk) ─────────────────────────────────────
app.post('/api/unmask-phones', express.json(), async (req, res) => {
    const { billcodes } = req.body || {}
    if (!Array.isArray(billcodes) || billcodes.length === 0) {
        return res.status(400).json({ error: 'billcodes array required' })
    }

    try {
        const dataObj = {
            parameter: {
                billcodes,
                informationType: 2,
                plaintextFor: '待派件列表',
                type: 1
            }
        }

        const body = buildFormData(dataObj, 'app.queryReverseCheck')

        const config = {
            method: 'POST',
            url: `${JNT_BASE}/jandt-businessapp-web/router`,
            headers: {
                ...COMMON_HEADERS,
                ...body.getHeaders()
            },
            data: body
        }

        const response = await axios.request(config)
        
        let responseData = response.data
        if (responseData?.data && typeof responseData.data === 'string') {
            try {
                responseData.data = JSON.parse(responseData.data)
            } catch (e) {
                // Ignore parsing errors
            }
        }

        res.json(responseData)
    } catch (err) {
        console.error('[/api/unmask-phones]', err?.response?.data || err.message)
        res.status(502).json({ error: err?.response?.data || err.message })
    }
})

// ─── Route: Maposcope Route Optimization ────────────────────────────────────
app.post('/api/route', express.json(), async (req, res) => {
    try {
        console.log('[/api/route] stops count:', req.body?.stops?.length)

        const response = await fetch('https://r2.maposcope.com/routing/3/route/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                'key': 'oisadfjo3242vmxetkej339safs2g1348cc2',
                'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 16; 24069PC21G Build/BP2A.250605.031.A3)',
                'Host': 'r2.maposcope.com',
                'Connection': 'keep-alive',
            },
            body: JSON.stringify(req.body),
        })

        const text = await response.text()
        console.log('[/api/route] status:', response.status, '| body:', text.slice(0, 300))

        let json
        try { json = JSON.parse(text) }
        catch { return res.status(502).json({ error: 'Invalid JSON from Maposcope', raw: text.slice(0, 300) }) }

        res.json(json)
    } catch (err) {
        console.error('[/api/route]', err.message)
        res.status(502).json({ error: err.message })
    }
})

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`[JnT Proxy] Listening on http://localhost:${PORT}`)
    })
}

export default app
