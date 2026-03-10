import React from 'react'

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null, errorInfo: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true }
    }

    componentDidCatch(error, errorInfo) {
        console.error('[ErrorBoundary]', error, errorInfo)
        this.setState({ error, errorInfo })
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null })
        this.props.onReset?.()
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
                        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-red-500 text-3xl">error</span>
                        </div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                            Terjadi Kesalahan
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mb-6">
                            Aplikasi mengalami masalah. Silakan muat ulang halaman.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={this.handleReset}
                                className="flex-1 py-3 px-6 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform"
                            >
                                Coba Lagi
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="flex-1 py-3 px-6 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl active:scale-[0.98] transition-transform"
                            >
                                Muat Ulang
                            </button>
                        </div>
                        {this.props.showDetails && this.state.error && (
                            <details className="mt-6 text-left">
                                <summary className="text-sm text-slate-400 cursor-pointer hover:text-slate-500">
                                    Detail error
                                </summary>
                                <pre className="mt-2 text-xs text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg overflow-auto max-h-32">
                                    {this.state.error.toString()}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
