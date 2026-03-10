export default function ActionButtons({ onCopy, onKirim, onReset }) {
    return (
        <div className="flex flex-col gap-2">
            <button
                className="w-full py-3.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-transform active:scale-95 bg-primary text-white shadow-md shadow-primary/20"
                onClick={onKirim}
            >
                <span className="material-symbols-outlined text-[18px]">send</span> Kirim WhatsApp
            </button>
            <div className="flex gap-2">
                <button
                    className="flex-1 py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-transform active:scale-95 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                    onClick={onCopy}
                >
                    <span className="material-symbols-outlined text-[18px]">content_copy</span> Salin Pesan
                </button>
                <button
                    className="flex-none p-3 rounded-xl flex items-center justify-center text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-colors active:scale-95"
                    title="Reset form"
                    onClick={onReset}
                >
                    <span className="material-symbols-outlined text-[18px]">refresh</span>
                </button>
            </div>
        </div>
    )
}
