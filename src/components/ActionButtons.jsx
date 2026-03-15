import { Send, Copy, RotateCcw } from 'lucide-react'

export default function ActionButtons({ onCopy, onKirim, onReset }) {
    return (
        <div className="flex flex-col gap-3">
            <button
                className="btn-primary"
                onClick={onKirim}
            >
                <Send size={18} /> Kirim WhatsApp
            </button>
            <div className="flex gap-2">
                <button
                    className="btn-secondary"
                    onClick={onCopy}
                >
                    <Copy size={18} /> Salin Pesan
                </button>
                <button
                    className="btn-ghost"
                    title="Reset form"
                    onClick={onReset}
                >
                    <RotateCcw size={20} />
                </button>
            </div>
        </div>
    )
}
