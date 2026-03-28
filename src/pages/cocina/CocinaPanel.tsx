import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import type { OrderStatus } from '../../types/database'

interface CocinaOrder {
    id: string
    type: 'mesa' | 'para_llevar'
    customer_name: string | null
    status: OrderStatus
    created_at: string
    table_number: number | null
    items: { name: string; quantity: number }[]
    wait_minutes: number
}

const STATUS_CONFIG = {
    pending: { label: 'Pendiente', color: 'border-gray-600 bg-gray-900', header: 'bg-gray-800', badge: 'bg-gray-700 text-gray-300', btn: 'bg-amber-500 hover:bg-amber-400', btnLabel: '→ Preparando' },
    preparing: { label: 'Preparando', color: 'border-amber-500 bg-gray-900', header: 'bg-amber-900', badge: 'bg-amber-500 text-amber-100', btn: 'bg-blue-500 hover:bg-blue-400', btnLabel: '→ Listo' },
    ready: { label: 'Listo', color: 'border-blue-500 bg-gray-900', header: 'bg-blue-900', badge: 'bg-blue-500 text-blue-100', btn: 'bg-green-500 hover:bg-green-400', btnLabel: '→ Entregado' },
    delivered: { label: 'Entregado', color: 'border-green-600 bg-gray-900', header: 'bg-green-900', badge: 'bg-green-600 text-green-100', btn: '', btnLabel: '' },
}

const COLUMNS: OrderStatus[] = ['pending', 'preparing', 'ready']

export function CocinaPanel() {
    const [orders, setOrders] = useState<CocinaOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState<string | null>(null)
    const [ticker, setTicker] = useState(0)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const prevCountRef = useRef(0)

    useEffect(() => {
        fetchOrders()

        const channel = supabase
            .channel('cocina-orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchOrders(true)
            })
            .subscribe()

        // Actualizar tiempos cada 30 segundos
        const timer = setInterval(() => setTicker(t => t + 1), 30000)

        return () => {
            supabase.removeChannel(channel)
            clearInterval(timer)
        }
    }, [])

    async function fetchOrders(playSound = false) {
        const { data: ordersData } = await supabase
            .from('orders')
            .select('*')
            .in('status', ['pending', 'preparing', 'ready'])
            .order('created_at', { ascending: true })

        const enriched = await Promise.all(
            (ordersData ?? []).map(async order => {
                const { data: items } = await supabase
                    .from('order_items')
                    .select('quantity, menu_items(name)')
                    .eq('order_id', order.id)

                const { data: tableData } = order.table_id
                    ? await supabase.from('tables').select('number').eq('id', order.table_id).single()
                    : { data: null }

                const wait = Math.floor(
                    (Date.now() - new Date(order.created_at).getTime()) / 60000
                )

                return {
                    ...order,
                    table_number: tableData?.number ?? null,
                    items: (items ?? []).map((i: any) => ({
                        name: i.menu_items?.name ?? '',
                        quantity: i.quantity,
                    })),
                    wait_minutes: wait,
                } as CocinaOrder
            })
        )

        // Sonar si hay nuevos pedidos pendientes
        if (playSound) {
            const newCount = enriched.filter(o => o.status === 'pending').length
            if (newCount > prevCountRef.current) {
                playBeep()
            }
            prevCountRef.current = newCount
        }

        setOrders(enriched)
        setLoading(false)
    }

    function playBeep() {
        try {
            const ctx = new AudioContext()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.frequency.value = 880
            gain.gain.setValueAtTime(0.3, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
            osc.start(ctx.currentTime)
            osc.stop(ctx.currentTime + 0.4)
        } catch (_) { }
    }

    async function advanceStatus(order: CocinaOrder) {
        const next: Record<OrderStatus, OrderStatus | null> = {
            pending: 'preparing',
            preparing: 'ready',
            ready: 'delivered',
            delivered: null,
        }
        const nextStatus = next[order.status]
        if (!nextStatus) return
        setUpdating(order.id)
        await supabase.from('orders').update({ status: nextStatus }).eq('id', order.id)
        if (nextStatus === 'delivered' && order.table_id) {
            await supabase.from('tables').update({ status: 'pending' }).eq('id', order.id)
        }
        setUpdating(null)
        fetchOrders()
    }

    function waitColor(mins: number) {
        if (mins < 10) return 'text-green-400'
        if (mins < 20) return 'text-amber-400'
        return 'text-red-400'
    }

    const columnOrders = (status: OrderStatus) =>
        orders.filter(o => o.status === status)

    if (loading) return (
        <div className="flex items-center justify-center h-64 text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mr-3" />
            Cargando pedidos...
        </div>
    )

    return (
        <div>
            {/* Stats rápidas */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                {COLUMNS.map(status => {
                    const cfg = STATUS_CONFIG[status]
                    const count = columnOrders(status).length
                    return (
                        <div key={status} className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex items-center gap-3">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cfg.badge}`}>
                                {cfg.label}
                            </span>
                            <span className="text-2xl font-bold text-white">{count}</span>
                        </div>
                    )
                })}
            </div>

            {orders.length === 0 ? (
                <div className="text-center py-24 text-gray-600">
                    <p className="text-4xl mb-3">🍳</p>
                    <p className="text-lg font-medium">Sin pedidos por ahora</p>
                    <p className="text-sm mt-1">Los nuevos pedidos aparecerán aquí automáticamente</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {COLUMNS.map(status => {
                        const cfg = STATUS_CONFIG[status]
                        const cols = columnOrders(status)
                        return (
                            <div key={status}>
                                {/* Cabecera columna */}
                                <div className={`flex items-center justify-between px-4 py-2.5 rounded-t-xl ${cfg.header}`}>
                                    <span className="text-sm font-semibold text-white">{cfg.label}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
                                        {cols.length}
                                    </span>
                                </div>

                                {/* Tarjetas */}
                                <div className={`border-x border-b border-gray-700 rounded-b-xl min-h-32 p-3 space-y-3`}>
                                    {cols.length === 0 && (
                                        <p className="text-center text-gray-600 text-xs py-8">Sin pedidos</p>
                                    )}
                                    {cols.map(order => {
                                        const cfg2 = STATUS_CONFIG[order.status]
                                        return (
                                            <div
                                                key={order.id}
                                                className={`rounded-xl border-2 overflow-hidden ${cfg2.color} transition-all`}
                                            >
                                                {/* Header tarjeta */}
                                                <div className={`px-4 py-2.5 flex items-center justify-between ${cfg2.header}`}>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold text-white">
                                                            {order.type === 'mesa'
                                                                ? `Mesa #${order.table_number}`
                                                                : `🥡 ${order.customer_name}`}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-xs font-semibold ${waitColor(order.wait_minutes)}`}>
                                                            ⏱ {order.wait_minutes}min
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Items */}
                                                <div className="px-4 py-3 space-y-1.5">
                                                    {order.items.map((item, i) => (
                                                        <div key={i} className="flex items-center gap-2">
                                                            <span className="w-6 h-6 rounded-md bg-gray-700 text-white text-xs font-bold flex items-center justify-center shrink-0">
                                                                {item.quantity}
                                                            </span>
                                                            <span className="text-sm text-gray-200">{item.name}</span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Hora y botón */}
                                                <div className="px-4 pb-3 flex items-center justify-between">
                                                    <span className="text-xs text-gray-500">
                                                        {new Date(order.created_at).toLocaleTimeString('es-BO', {
                                                            hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </span>
                                                    {cfg2.btn && (
                                                        <button
                                                            onClick={() => advanceStatus(order)}
                                                            disabled={updating === order.id}
                                                            className={`text-xs text-white px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 ${cfg2.btn}`}
                                                        >
                                                            {updating === order.id ? '...' : cfg2.btnLabel}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}