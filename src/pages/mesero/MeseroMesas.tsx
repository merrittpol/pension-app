import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Table } from '../../types/database'

const STATUS_CONFIG = {
    available: { label: 'Disponible', color: 'border-green-200 bg-green-50', dot: 'bg-green-500', text: 'text-green-700' },
    occupied: { label: 'Ocupada', color: 'border-red-200 bg-red-50', dot: 'bg-red-500', text: 'text-red-700' },
    pending: { label: 'Cuenta pend.', color: 'border-amber-200 bg-amber-50', dot: 'bg-amber-500', text: 'text-amber-700' },
}

export function MeseroMesas() {
    const [tables, setTables] = useState<Table[]>([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        fetchTables()
        const channel = supabase
            .channel('mesero-tables')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, fetchTables)
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [])

    async function fetchTables() {
        const { data } = await supabase.from('tables').select('*').eq('disabled', false).order('number')
        setTables(data ?? [])
        setLoading(false)
    }

    const counts = {
        available: tables.filter(t => t.status === 'available').length,
        occupied: tables.filter(t => t.status === 'occupied').length,
        pending: tables.filter(t => t.status === 'pending').length,
    }

    return (
        <div className="p-6">
            <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Mesas</h2>
                <p className="text-sm text-gray-500 mt-0.5">Seleccioná una mesa para tomar un pedido</p>
            </div>

            {/* Contadores */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                {(Object.entries(counts) as [keyof typeof STATUS_CONFIG, number][]).map(([status, count]) => (
                    <div key={status} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${STATUS_CONFIG[status].dot}`} />
                        <div>
                            <p className="text-lg font-semibold text-gray-900">{count}</p>
                            <p className="text-xs text-gray-500">{STATUS_CONFIG[status].label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Grid mesas */}
            {loading ? (
                <div className="grid grid-cols-3 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {tables.map(table => {
                        const cfg = STATUS_CONFIG[table.status]
                        const clickable = table.status === 'available'
                        return (
                            <button
                                key={table.id}
                                onClick={() => clickable && navigate(`/mesero/pedidos?mesa=${table.id}&numero=${table.number}`)}
                                disabled={!clickable}
                                className={`rounded-xl border-2 p-5 text-left transition-all ${cfg.color} ${clickable
                                        ? 'hover:scale-105 hover:shadow-md cursor-pointer'
                                        : 'opacity-80 cursor-not-allowed'
                                    }`}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <p className="text-3xl font-bold text-gray-900">#{table.number}</p>
                                    <span className={`w-3 h-3 rounded-full mt-1 ${cfg.dot}`} />
                                </div>
                                <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
                                {clickable && (
                                    <p className="text-xs text-gray-400 mt-1">Toca para pedir</p>
                                )}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}