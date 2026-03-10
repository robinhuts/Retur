export function formatRupiah(str) {
    const angka = String(str).replace(/\D/g, '')
    if (!angka) return ''
    return parseInt(angka, 10).toLocaleString('id-ID')
}

export function konversiTelp(raw) {
    let t = raw.replace(/\D/g, '')
    if (t.startsWith('0')) t = '62' + t.slice(1)
    else if (t.startsWith('8')) t = '62' + t
    return t
}

export function buildPesan({ resi, nama, telp, nominal }) {
    const telpFmt = telp ? konversiTelp(telp) : '____________'
    const nominalFmt = nominal ? formatRupiah(nominal) : '____________'

    return `Selamat pagi Bpk/Ibu,
Saya kurir J&T Express Lampung ingin mengonfirmasi paket berikut:

Resi: ${resi || '____________'}
Nama: ${nama ? nama.toUpperCase() : '____________'}
No. HP: ${telpFmt}
Nilai COD: Rp ${nominalFmt}

Apakah paket ini benar diretur?
Terima kasih \uD83D\uDE4F`
}

export function buildPesanTagihCOD(packagesList) {
    const packages = Array.isArray(packagesList) ? packagesList : [packagesList]
    if (!packages || packages.length === 0) return ''

    const firstPkg = packages.find(p => p.telp) || packages[0]
    const namaUpper = firstPkg.nama ? firstPkg.nama.toUpperCase() : '____________'

    const resis = packages.map(p => p.resi || '____________').join(', ')
    const totalCod = packages.reduce((sum, p) => sum + (parseInt(p.nominal) || 0), 0)
    const nominalFmt = totalCod > 0 ? formatRupiah(totalCod) : '0'

    const paketText = packages.length > 1 ? `${packages.length} paket` : `paket`

    return `Halo Kak【${namaUpper}】,\nSaya kurir J&T Express yang tadi mengantar ${paketText} Anda.\n\nNomor resi: ${resis}\nNominal COD: Rp ${nominalFmt}\n\nMohon segera lakukan pembayaran COD / transfer ya Kak, karena paket sudah diterima.\nTerima kasih 🙏`
}

export function buildPesanTTD(packagesList) {
    const packages = Array.isArray(packagesList) ? packagesList : [packagesList]
    if (!packages || packages.length === 0) return ''

    const firstPkg = packages.find(p => p.telp) || packages[0]
    const namaUpper = firstPkg.nama ? firstPkg.nama.toUpperCase() : '____________'

    const resis = packages.map(p => p.resi || '____________').join(', ')
    const paketText = packages.length > 1 ? `${packages.length} paket` : `paket`

    return `Halo Kak【${namaUpper}】,\nSaya kurir J&T Express yang akan mengantar ${paketText} Anda hari ini.\n\nNomor resi: ${resis}\n\nMohon bersiap ya Kak, paket sedang dalam perjalanan ke lokasi Anda.\nTerima kasih 🙏`
}

export function buildPesanPengiriman(packagesList) {
    // Convert single object to array for uniform parameter handling
    const packages = Array.isArray(packagesList) ? packagesList : [packagesList]
    if (!packages || packages.length === 0) return ''

    // Assume all packages belong to the same person
    const firstPkg = packages.find(p => p.telp) || packages[0]

    const namaUpper = firstPkg.nama ? firstPkg.nama.toUpperCase() : '____________'
    const addressFmt = firstPkg.address || '____________'

    // Aggregate resis and total COD
    const resis = packages.map(p => p.resi || '\u2014').join(', ')
    const totalCod = packages.reduce((sum, p) => sum + (parseInt(p.nominal) || 0), 0)
    const totalCodFmt = totalCod > 0 ? formatRupiah(totalCod) : '0'

    const paketText = packages.length > 1 ? `${packages.length} paket` : `paket`

    return `Halo Kak\u3010${namaUpper}\u3011,
Saya dari J&T Express, Mau konfirmasi pengiriman ${paketText} hari ini dengan nomor resi\u3010${resis}\u3011ke alamat:
\u3010${addressFmt}\u3011

Mohon pastikan ada penerima di lokasi tujuan ya Kak.
${totalCod > 0 ? `\nJika ini adalah paket COD, mohon siapkan uang pas total sebesar Rp\u3010${totalCodFmt}\u3011\n` : ''}
Terima kasih`
}
