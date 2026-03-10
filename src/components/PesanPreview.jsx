export default function PesanPreview({ pesan }) {
    const hasContent = Boolean(pesan)

    return (
        <div className="mb-4">
            <div className={`p-4 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${hasContent ? 'bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-700' : 'bg-slate-50 dark:bg-slate-900/30 text-slate-400 italic border border-slate-100 dark:border-slate-800 border-dashed'}`}>
                {hasContent ? pesan : 'Isi form di atas untuk melihat preview pesan...'}
            </div>
        </div>
    )
}
