import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Stats {
    mesas_disponibles: number
    pedidos_activos: number
    ventas_hoy: number
    items_menu: number
}

export function AdminHome() {
    const [stats, setStats] = useState<Stats>({
        mesas_disponibles: 0,
        pedidos_activos: 0,
        ventas_hoy: 0,
        items_menu: 0,
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadStats() {
            const [mesas, pedidos, ventas, menu] = await Promise.all([
                supabase.from('tables').select('id', { count: 'exact' }).eq('status', 'available'),
                supabase.from('orders').select('id', { count: 'exact' }).in('status', ['pending', 'preparing', 'ready']),
                supabase.from('payments').select('amount').gte('paid_at', new Date().toISOString().split('T')[0]),
                supabase.from('menu_items').select('id', { count: 'exact' }).eq('available', true),
            ])

            const totalVentas = ventas.data?.reduce((s, p) => s + p.amount, 0) ?? 0

            setStats({
                mesas_disponibles: mesas.count ?? 0,
                pedidos_activos: pedidos.count ?? 0,
                ventas_hoy: totalVentas,
                items_menu: menu.count ?? 0,
            })
            setLoading(false)
        }
        loadStats()
    }, [])

    const cards = [
        { label: 'Mesas disponibles', value: stats.mesas_disponibles, icon: '🪑', color: 'blue' },
        { label: 'Pedidos activos', value: stats.pedidos_activos, icon: '🧾', color: 'amber' },
        { label: 'Ventas hoy', value: `Bs. ${stats.ventas_hoy.toFixed(2)}`, icon: '💰', color: 'green' },
        { label: 'Ítems en menú', value: stats.items_menu, icon: '📋', color: 'purple' },
    ]

    const colorMap: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-600',
        amber: 'bg-amber-50 text-amber-600',
        green: 'bg-green-50 text-green-600',
        purple: 'bg-purple-50 text-purple-600',
    }

    return (
        <div className="p-8">
            <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900">Resumen del día</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                    {new Date().toLocaleDateString('es-BO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-4">
                {cards.map(card => (
                    <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-5">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg mb-3 ${colorMap[card.color]}`}>
                            {card.icon}
                        </div>
                        {loading ? (
                            <div className="h-7 w-20 bg-gray-100 rounded animate-pulse mb-1" />
                        ) : (
                            <p className="text-2xl font-semibold text-gray-900">{card.value}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Accesos rápidos</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                        { label: 'Nuevo pedido', icon: '➕', to: '/admin/pedidos' },
                        { label: 'Ver mesas', icon: '🪑', to: '/admin/mesas' },
                        { label: 'Editar menú', icon: '📋', to: '/admin/menu' },
                        { label: 'Ver reportes', icon: '📊', to: '/admin/reportes' },
                    ].map(a => (
                        <a
                            key={a.label}
                            href={a.to}
                            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-100 hover:bg-gray-50 hover:border-gray-200 transition-colors text-center"
                        >
                            <span className="text-2xl">{a.icon}</span>
                            <span className="text-xs text-gray-600 font-medium">{a.label}</span>
                        </a>
                    ))}
                </div>
            </div>
        </div>
    )
}