import { konversiTelp } from '../utils'

const FIELDS = [
    { id: 'resi', label: 'Nominal Resi', placeholder: 'Contoh: JT0012345678', type: 'text', inputMode: 'text' },
    { id: 'nama', label: 'Nama Penerima', placeholder: 'Contoh: Budi Santoso', type: 'text', inputMode: 'text' },
    { id: 'telp', label: 'Nomor Telepon', placeholder: 'Contoh: 08123456789', type: 'tel', inputMode: 'tel' },
    { id: 'nominal', label: 'Nominal COD (Rp)', placeholder: 'Contoh: 1092200', type: 'text', inputMode: 'numeric' },
]

export default function ReturnForm({ values, errors, onChange }) {
    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 border border-slate-100 dark:border-slate-700">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-[18px]">local_shipping</span>
                </div>
                Data Pengiriman Retur
            </h2>

            <div className="flex flex-col gap-4">
                {FIELDS.map(({ id, label, placeholder, type, inputMode }) => (
                    <div className="flex flex-col" key={id}>
                        <label htmlFor={id} className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex justify-between">
                            <span>{label} <span className="text-primary">*</span></span>
                        </label>
                        <input
                            id={id}
                            type={type}
                            inputMode={inputMode}
                            placeholder={placeholder}
                            autoComplete="off"
                            value={values[id]}
                            className={`w-full px-4 py-3 border rounded-xl text-sm font-medium text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-900/50 transition-all outline-none placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-primary/20 ${errors[id]
                                ? 'border-red-400 focus:border-red-500 bg-red-50/50 dark:bg-red-900/10'
                                : 'border-slate-200 dark:border-slate-700 focus:border-primary'
                                }`}
                            onChange={e => onChange(id, e.target.value)}
                        />

                        {/* Phone live preview */}
                        {id === 'telp' && values.telp && (
                            <div className="text-[10px] text-green-600 dark:text-green-500 font-bold mt-1.5 min-h-[16px] flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">check_circle</span> Format WA: +{konversiTelp(values.telp)}
                            </div>
                        )}

                        {errors[id] && (
                            <div className="text-[10px] text-red-500 dark:text-red-400 font-bold mt-1.5 flex items-center gap-1 animate-[fadeIn_0.2s_ease]">
                                <span className="material-symbols-outlined text-[14px]">warning</span> {errors[id]}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
