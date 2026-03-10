import { useEffect, useState } from 'react'
import { CheckCircle2, Info, AlertTriangle } from 'lucide-react'

export default function Toast({ message, type }) {
    const [show, setShow] = useState(false)
    const [color, setColor] = useState('')

    useEffect(() => {
        if (!message) return

        let bgColor = 'bg-stone-800'
        if (type === 'success') bgColor = 'bg-emerald-600'
        if (type === 'info') bgColor = 'bg-blue-600'
        if (type === 'warn') bgColor = 'bg-rose-600'

        setColor(bgColor)
        setShow(true)

        const t = setTimeout(() => {
            setShow(false)
        }, 2800)
        return () => clearTimeout(t)
    }, [message, type])

    return (
        <div
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full text-sm font-semibold text-white whitespace-nowrap shadow-xl shadow-black/20 z-50 transition-all duration-300 flex items-center gap-2.5 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} ${color}`}
        >
            {type === 'success' && <CheckCircle2 size={18} strokeWidth={2.5} />}
            {type === 'info' && <Info size={18} strokeWidth={2.5} />}
            {type === 'warn' && <AlertTriangle size={18} strokeWidth={2.5} />}
            {message}
        </div>
    )
}
