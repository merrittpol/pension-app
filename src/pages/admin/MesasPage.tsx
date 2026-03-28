import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Table, TableStatus } from '../../types/database'

const STATUS_CONFIG = {
    available: { label: 'Disponible', color: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' },
    occupied: { label: 'Ocupada', color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
    pending: { label: 'Cuenta pend.', color: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
}

export function MesasPage() {
    const [tables, setTables] = useState<Table[]>([])
    const [loading, setLoading] = useState(true)
    const [adding, setAdding] = useState(false)
    const [removing, setRemoving] = useState(false)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [updating, setUpdating] = useState<string | null>(null)

    useEffect(() => {
        fetchTables()

        // Realtime: escuchar cambios en mesas
        const channel = supabase
            .channel('tables-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => {
                fetchTables()
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])

    async function fetchTables() {
        const { data } = await supabase
            .from('tables')
            .select('*')
            .order('number')
        setTables(data ?? [])
        setLoading(false)
    }

    async function addTable() {
        setAdding(true)
        const nextNumber = tables.length > 0
            ? Math.max(...tables.map(t => t.number)) + 1
            : 1
        await supabase.from('tables').insert({ number: nextNumber, status: 'available' })
        setAdding(false)
    }

    async function removeTable() {
        if (tables.length === 0) return
        setRemoving(true)
        const lastTable = tables.reduce((a, b) => a.number > b.number ? a : b)
        await supabase.from('tables').delete().eq('id', lastTable.id)
        setRemoving(false)
    }

    async function deleteTable(id: string) {
        setDeleting(id)
        await supabase.from('tables').delete().eq('id', id)
        setDeleting(null)
    }

    async function changeStatus(id: string, status: TableStatus) {
        setUpdating(id)
        await supabase.from('tables').update({ status }).eq('id', id)
        setUpdating(null)
    }

    async function toggleDisabled(id: string, currentDisabled: boolean) {
        setUpdating(id)
        const { error } = await supabase.from('tables').update({ disabled: !currentDisabled } as any).eq('id', id)
        if (error) {
            alert(`No se pudo actualizar la mesa.\n\nPor favor, asegúrate de haber ejecutado el comando SQL en Supabase para agregar la columna 'disabled'.\n\nError: ${error.message}`)
            console.error('Error toggling disabled:', error)
        }
        setUpdating(null)
    }

    const activeTables = tables.filter(t => !t.disabled)
    const counts = {
        available: activeTables.filter(t => t.status === 'available').length,
        occupied: activeTables.filter(t => t.status === 'occupied').length,
        pending: activeTables.filter(t => t.status === 'pending').length,
    }
    const disabledCount = tables.filter(t => t.disabled).length

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Gestión de Mesas</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {activeTables.length} activas{disabledCount > 0 && ` · ${disabledCount} deshabilitadas`}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={removeTable}
                        disabled={removing || tables.length === 0}
                        className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                        {removing ? '...' : '− Quitar mesa'}
                    </button>
                    <button
                        onClick={addTable}
                        disabled={adding}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        {adding ? '...' : '+ Agregar mesa'}
                    </button>
                </div>
            </div>

            {/* Resumen */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                {(Object.entries(counts) as [TableStatus, number][]).map(([status, count]) => (
                    <div key={status} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                        <span className={`w-3 h-3 rounded-full ${STATUS_CONFIG[status].dot}`} />
                        <div>
                            <p className="text-lg font-semibold text-gray-900">{count}</p>
                            <p className="text-xs text-gray-500">{STATUS_CONFIG[status].label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Grid de mesas */}
            {loading ? (
                <div className="grid grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-36 bg-gray-100 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {tables.map(table => {
                        const cfg = STATUS_CONFIG[table.status]
                        const isDisabled = table.disabled
                        return (
                            <div
                                key={table.id}
                                className={`bg-white rounded-xl border p-5 flex flex-col gap-3 transition-opacity ${
                                    isDisabled ? 'opacity-50 border-gray-200 bg-gray-50' : 'border-gray-100'
                                }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900">#{table.number}</p>
                                        {isDisabled ? (
                                            <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border mt-1 bg-gray-100 text-gray-500 border-gray-200">
                                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                                                Deshabilitada
                                            </span>
                                        ) : (
                                            <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border mt-1 ${cfg.color}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                                {cfg.label}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {/* Toggle deshabilitar/habilitar */}
                                        <button
                                            onClick={() => toggleDisabled(table.id, table.disabled)}
                                            disabled={updating === table.id || (!isDisabled && table.status !== 'available')}
                                            className={`text-lg leading-none transition-colors ${
                                                isDisabled
                                                    ? 'text-gray-400 hover:text-green-500'
                                                    : 'text-gray-300 hover:text-amber-500'
                                            } disabled:opacity-30`}
                                            title={
                                                isDisabled
                                                    ? 'Habilitar mesa'
                                                    : table.status !== 'available'
                                                        ? 'Solo se pueden deshabilitar mesas disponibles'
                                                        : 'Deshabilitar mesa'
                                            }
                                        >
                                            {isDisabled ? '👁' : '🚫'}
                                        </button>
                                        {/* Eliminar mesa */}
                                        <button
                                            onClick={() => deleteTable(table.id)}
                                            disabled={deleting === table.id || table.status !== 'available' || isDisabled}
                                            className="text-gray-300 hover:text-red-400 disabled:opacity-30 transition-colors text-lg leading-none"
                                            title={table.status !== 'available' ? 'Solo se pueden eliminar mesas disponibles' : 'Eliminar mesa'}
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>

                                {/* Cambiar estado — solo si no está deshabilitada */}
                                {!isDisabled && (
                                    <div className="space-y-1.5">
                                        {(Object.entries(STATUS_CONFIG) as [TableStatus, typeof STATUS_CONFIG.available][])
                                            .filter(([s]) => s !== table.status)
                                            .map(([s, c]) => (
                                                <button
                                                    key={s}
                                                    onClick={() => changeStatus(table.id, s)}
                                                    disabled={updating === table.id}
                                                    className={`w-full text-xs py-1.5 px-2 rounded-lg border transition-colors ${c.color} hover:opacity-80 disabled:opacity-40`}
                                                >
                                                    {updating === table.id ? '...' : `→ ${c.label}`}
                                                </button>
                                            ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}