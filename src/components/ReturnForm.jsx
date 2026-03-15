import { konversiTelp } from '../utils'
import { Package, CheckCircle, AlertCircle } from 'lucide-react'

const FIELDS = [
    { id: 'resi', label: 'Nominal Resi', placeholder: 'Contoh: JT0012345678', type: 'text', inputMode: 'text' },
    { id: 'nama', label: 'Nama Penerima', placeholder: 'Contoh: Budi Santoso', type: 'text', inputMode: 'text' },
    { id: 'telp', label: 'Nomor Telepon', placeholder: 'Contoh: 08123456789', type: 'tel', inputMode: 'tel' },
    { id: 'nominal', label: 'Nominal COD (Rp)', placeholder: 'Contoh: 1092200', type: 'text', inputMode: 'numeric' },
]

export default function ReturnForm({ values, errors, onChange }) {
    return (
        <div className="bg-white dark:bg-surface-dark rounded-xl shadow-sm p-5 border border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Package size={20} className="text-primary" />
                </div>
                Data Pengiriman Retur
            </h2>

            <div className="flex flex-col gap-4">
                {FIELDS.map(({ id, label, placeholder, type, inputMode }) => (
                    <div className="flex flex-col" key={id}>
                        <label htmlFor={id} className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 flex justify-between">
                            <span>{label} <span className="text-primary">*</span></span>
                        </label>
                        <input
                            id={id}
                            type={type}
                            inputMode={inputMode}
                            placeholder={placeholder}
                            autoComplete="off"
                            value={values[id]}
                            className={`input-field ${errors[id] ? 'error' : ''}`}
                            onChange={e => onChange(id, e.target.value)}
                        />

                        {id === 'telp' && values.telp && !errors.telp && (
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-500 font-semibold mt-2 flex items-center gap-1.5">
                                <CheckCircle size={14} /> Format WA: +{konversiTelp(values.telp)}
                            </div>
                        )}

                        {errors[id] && (
                            <div className="text-[11px] text-red-500 dark:text-red-400 font-semibold mt-2 flex items-center gap-1.5">
                                <AlertCircle size={14} /> {errors[id]}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
