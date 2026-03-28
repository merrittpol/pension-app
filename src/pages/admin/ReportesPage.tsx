import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, LineChart, Line
} from 'recharts'

type PeriodType = 'day' | 'week' | 'month' | 'year'

interface SalesRow {
    period_start: string
    total_sales: number
    order_count: number
}

interface TopProduct {
    name: string
    total_qty: number
    total_revenue: number
}

const PERIODS: { value: PeriodType; label: string }[] = [
    { value: 'day', label: 'Por día' },
    { value: 'week', label: 'Por semana' },
    { value: 'month', label: 'Por mes' },
    { value: 'year', label: 'Por año' },
]

function getDateRange(period: PeriodType) {
    const to = new Date()
    const from = new Date()
    if (period === 'day') from.setDate(to.getDate() - 30)
    if (period === 'week') from.setDate(to.getDate() - 84)
    if (period === 'month') from.setMonth(to.getMonth() - 12)
    if (period === 'year') from.setFullYear(to.getFullYear() - 5)
    return { from: from.toISOString(), to: to.toISOString() }
}

function formatLabel(isoDate: string, period: PeriodType): string {
    const d = new Date(isoDate)
    if (period === 'day') return d.toLocaleDateString('es-BO', { day: 'numeric', month: 'short' })
    if (period === 'week') return `Sem ${Math.ceil(d.getDate() / 7)} ${d.toLocaleDateString('es-BO', { month: 'short' })}`
    if (period === 'month') return d.toLocaleDateString('es-BO', { month: 'short', year: '2-digit' })
    return d.getFullYear().toString()
}

export function ReportesPage() {
    const [period, setPeriod] = useState<PeriodType>('month')
    const [salesData, setSalesData] = useState<SalesRow[]>([])
    const [topProducts, setTopProducts] = useState<TopProduct[]>([])
    const [loading, setLoading] = useState(true)
    const [activeChart, setActiveChart] = useState<'bar' | 'line'>('bar')
    const [arqueo, setArqueo] = useState<{ method: string; total: number; count: number }[]>([])
    const [arqueoDetalle, setArqueoDetalle] = useState<any[]>([])
    const [loadingArqueo, setLoadingArqueo] = useState(true)
    const [detalleMetodo, setDetalleMetodo] = useState<'cash' | 'card' | 'qr' | null>(null)
    const [detalleItems, setDetalleItems] = useState<{ name: string; qty: number; revenue: number }[]>([])
    const [loadingDetalle, setLoadingDetalle] = useState(false)
    const [arqueoFecha, setArqueoFecha] = useState(() => {
        const hoy = new Date()
        return hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0')
    })

    useEffect(() => {
        fetchData()
    }, [period])

    useEffect(() => {
        fetchArqueo()
        setDetalleMetodo(null)
    }, [arqueoFecha])

    async function fetchData() {
        setLoading(true)
        const { from, to } = getDateRange(period)

        const { data: sales } = await supabase.rpc('get_sales_report', {
            period_type: period,
            date_from: from,
            date_to: to,
        })

        // Top productos directo desde order_items
        const { data: items } = await supabase
            .from('order_items')
            .select('quantity, unit_price, menu_items(name)')

        const productMap = new Map<string, { qty: number; revenue: number }>()
            ; (items ?? []).forEach((i: any) => {
                const name = i.menu_items?.name ?? 'Desconocido'
                const prev = productMap.get(name) ?? { qty: 0, revenue: 0 }
                productMap.set(name, {
                    qty: prev.qty + i.quantity,
                    revenue: prev.revenue + i.quantity * i.unit_price,
                })
            })

        const top = Array.from(productMap.entries())
            .map(([name, v]) => ({ name, total_qty: v.qty, total_revenue: v.revenue }))
            .sort((a, b) => b.total_qty - a.total_qty)
            .slice(0, 6)

        setSalesData(sales ?? [])
        setTopProducts(top)
        setLoading(false)
    }
    async function fetchArqueo() {
        setLoadingArqueo(true)

        const inicio = new Date(arqueoFecha + 'T00:00:00')
        const fin = new Date(arqueoFecha + 'T23:59:59.999')

        const { data: payments } = await supabase
            .from('payments')
            .select(`
      id,
      amount,
      method,
      paid_at,
      orders (
        type,
        customer_name,
        table_id,
        tables ( number )
      )
    `)
            .gte('paid_at', inicio.toISOString())
            .lte('paid_at', fin.toISOString())
            .order('paid_at', { ascending: false })

        const detalle = (payments ?? []).map((p: any) => ({
            paid_at: p.paid_at,
            amount: p.amount,
            method: p.method,
            order_type: p.orders?.type,
            customer_name: p.orders?.customer_name,
            table_number: p.orders?.tables?.number,
        }))

        // Agrupar por método
        const byMethod = ['cash', 'card', 'qr'].map(method => ({
            method,
            total: detalle.filter(d => d.method === method).reduce((s, d) => s + Number(d.amount), 0),
            count: detalle.filter(d => d.method === method).length,
        }))

        setArqueo(byMethod)
        setArqueoDetalle(detalle)
        setLoadingArqueo(false)
    }
    async function fetchDetalleMetodo(method: 'cash' | 'card' | 'qr') {
        if (detalleMetodo === method) { setDetalleMetodo(null); return }
        setDetalleMetodo(method)
        setLoadingDetalle(true)

        const inicio = new Date(arqueoFecha + 'T00:00:00')
        const fin = new Date(arqueoFecha + 'T23:59:59.999')

        // Traer payments del método seleccionado con sus order_items
        const { data: payments } = await supabase
            .from('payments')
            .select('order_id')
            .eq('method', method)
            .gte('paid_at', inicio.toISOString())
            .lte('paid_at', fin.toISOString())

        const orderIds = (payments ?? []).map(p => p.order_id)

        if (orderIds.length === 0) {
            setDetalleItems([])
            setLoadingDetalle(false)
            return
        }

        const { data: items } = await supabase
            .from('order_items')
            .select('quantity, unit_price, menu_items(name)')
            .in('order_id', orderIds)

        const map = new Map<string, { qty: number; revenue: number }>()
            ; (items ?? []).forEach((i: any) => {
                const name = i.menu_items?.name ?? 'Desconocido'
                const prev = map.get(name) ?? { qty: 0, revenue: 0 }
                map.set(name, {
                    qty: prev.qty + i.quantity,
                    revenue: prev.revenue + i.quantity * i.unit_price,
                })
            })

        const result = Array.from(map.entries())
            .map(([name, v]) => ({ name, qty: v.qty, revenue: v.revenue }))
            .sort((a, b) => b.qty - a.qty)

        setDetalleItems(result)
        setLoadingDetalle(false)
    }

    const chartData = salesData.map(row => ({
        label: formatLabel(row.period_start, period),
        ventas: Number(row.total_sales),
        pedidos: Number(row.order_count),
    }))

    const totalVentas = salesData.reduce((s, r) => s + Number(r.total_sales), 0)
    const totalPedidos = salesData.reduce((s, r) => s + Number(r.order_count), 0)
    const ticketProm = totalPedidos > 0 ? totalVentas / totalPedidos : 0
    const mejorDia = [...salesData].sort((a, b) => Number(b.total_sales) - Number(a.total_sales))[0]

    return (
        <div className="p-8">
            <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Reportes de ventas</h2>
                <p className="text-sm text-gray-500 mt-0.5">Análisis de ingresos y pedidos</p>
            </div>

            {/* Selector período */}
            <div className="flex gap-2 mb-6 flex-wrap">
                {PERIODS.map(p => (
                    <button
                        key={p.value}
                        onClick={() => setPeriod(p.value)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${period === p.value
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-2 gap-4 mb-6 lg:grid-cols-4">
                {[
                    { label: 'Total ventas', value: `Bs. ${totalVentas.toLocaleString('es-BO', { maximumFractionDigits: 2 })}`, color: 'text-green-600' },
                    { label: 'Total pedidos', value: totalPedidos.toString(), color: 'text-blue-600' },
                    { label: 'Ticket promedio', value: `Bs. ${ticketProm.toFixed(2)}`, color: 'text-purple-600' },
                    { label: 'Mejor período', value: mejorDia ? `Bs. ${Number(mejorDia.total_sales).toFixed(2)}` : '—', color: 'text-amber-600' },
                ].map(card => (
                    <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-4">
                        <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                        {loading
                            ? <div className="h-7 w-24 bg-gray-100 rounded animate-pulse" />
                            : <p className={`text-xl font-semibold ${card.color}`}>{card.value}</p>
                        }
                    </div>
                ))}
            </div>

            {/* Gráfico ventas */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-900">Ventas (Bs.)</h3>
                    <div className="flex gap-1">
                        {(['bar', 'line'] as const).map(t => (
                            <button
                                key={t}
                                onClick={() => setActiveChart(t)}
                                className={`px-3 py-1 rounded-lg text-xs transition-colors ${activeChart === t ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                {t === 'bar' ? '▮▮ Barras' : '╱ Línea'}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="h-64 bg-gray-50 rounded-lg animate-pulse" />
                ) : chartData.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                        Sin datos para este período
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={260}>
                        {activeChart === 'bar' ? (
                            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                <YAxis tickFormatter={v => `${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(v: number) => [`Bs. ${v.toFixed(2)}`, 'Ventas']} />
                                <Bar dataKey="ventas" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        ) : (
                            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                <YAxis tickFormatter={v => `${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} tick={{ fontSize: 11 }} />
                                <Tooltip formatter={(v: number) => [`Bs. ${v.toFixed(2)}`, 'Ventas']} />
                                <Line type="monotone" dataKey="ventas" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                            </LineChart>
                        )}
                    </ResponsiveContainer>
                )}
            </div>

            {/* Gráfico pedidos */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Cantidad de pedidos</h3>
                {loading ? (
                    <div className="h-48 bg-gray-50 rounded-lg animate-pulse" />
                ) : chartData.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                        Sin datos para este período
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(v: number) => [v, 'Pedidos']} />
                            <Bar dataKey="pedidos" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Top productos */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Productos más vendidos</h3>
                {loading ? (
                    <div className="space-y-2">
                        {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-50 rounded animate-pulse" />)}
                    </div>
                ) : topProducts.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">Sin datos aún</p>
                ) : (
                    <div className="space-y-3">
                        {topProducts.map((p, i) => {
                            const maxQty = topProducts[0].total_qty
                            const pct = Math.round((p.total_qty / maxQty) * 100)
                            return (
                                <div key={p.name}>
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-bold w-5 ${i === 0 ? 'text-amber-500' : 'text-gray-400'}`}>
                                                #{i + 1}
                                            </span>
                                            <span className="text-sm text-gray-800">{p.name}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-gray-500">
                                            <span>{p.total_qty} uds</span>
                                            <span className="font-medium text-gray-900">Bs. {p.total_revenue.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
            {/* Arqueo de caja */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 mt-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-sm font-medium text-gray-900">Arqueo de caja</h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {arqueoFecha === new Date().toISOString().slice(0, 10) ? 'Pagos del día de hoy' : `Pagos del ${new Date(arqueoFecha + 'T12:00:00').toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                const d = new Date(arqueoFecha + 'T12:00:00')
                                d.setDate(d.getDate() - 1)
                                setArqueoFecha(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'))
                            }}
                            className="text-gray-400 hover:text-gray-600 transition-colors px-1.5 py-1 rounded hover:bg-gray-100"
                            title="Día anterior"
                        >
                            ◀
                        </button>
                        <input
                            type="date"
                            value={arqueoFecha}
                            onChange={e => setArqueoFecha(e.target.value)}
                            className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            onClick={() => {
                                const d = new Date(arqueoFecha + 'T12:00:00')
                                d.setDate(d.getDate() + 1)
                                const hoy = new Date()
                                if (d <= hoy) {
                                    setArqueoFecha(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'))
                                }
                            }}
                            disabled={arqueoFecha >= new Date().toISOString().slice(0, 10)}
                            className="text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors px-1.5 py-1 rounded hover:bg-gray-100"
                            title="Día siguiente"
                        >
                            ▶
                        </button>
                        <button
                            onClick={() => {
                                const hoy = new Date()
                                setArqueoFecha(hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0'))
                            }}
                            className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                                arqueoFecha === new Date().toISOString().slice(0, 10)
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            Hoy
                        </button>
                        <button
                            onClick={fetchArqueo}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                            ↻
                        </button>
                    </div>
                </div>

                {loadingArqueo ? (
                    <div className="space-y-2">
                        {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-50 rounded-lg animate-pulse" />)}
                    </div>
                ) : (
                    <>
                        {/* Detalle por método */}
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            {[
                                { method: 'cash', label: 'Efectivo', icon: '💵', color: 'bg-green-50 border-green-100 text-green-700', bar: 'bg-green-400' },
                                { method: 'card', label: 'Tarjeta', icon: '💳', color: 'bg-blue-50 border-blue-100 text-blue-700', bar: 'bg-blue-400' },
                                { method: 'qr', label: 'QR', icon: '📱', color: 'bg-purple-50 border-purple-100 text-purple-700', bar: 'bg-purple-400' },
                            ].map(m => {
                                const data = arqueo.find(a => a.method === m.method)
                                const isOpen = detalleMetodo === m.method
                                return (
                                    <div key={m.method} className="col-span-3 sm:col-span-1">
                                        {/* Tarjeta método */}
                                        <button
                                            onClick={() => fetchDetalleMetodo(m.method as any)}
                                            className={`w-full rounded-xl border p-4 text-left transition-all ${m.color} ${isOpen ? 'ring-2 ring-offset-1 ring-current' : ''}`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg">{m.icon}</span>
                                                    <span className="text-xs font-medium">{m.label}</span>
                                                </div>
                                                <span className="text-xs opacity-60">{isOpen ? '▲' : '▼'} detalle</span>
                                            </div>
                                            <p className="text-xl font-bold">Bs. {(data?.total ?? 0).toFixed(2)}</p>
                                            <p className="text-xs opacity-70 mt-0.5">
                                                {data?.count ?? 0} {(data?.count ?? 0) === 1 ? 'pago' : 'pagos'}
                                            </p>
                                        </button>

                                        {/* Detalle expandible */}
                                        {isOpen && (
                                            <div className="mt-2 bg-white border border-gray-100 rounded-xl overflow-hidden">
                                                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                                                    <p className="text-xs font-medium text-gray-600">
                                                        Ítems vendidos con {m.label}
                                                    </p>
                                                </div>

                                                {loadingDetalle ? (
                                                    <div className="p-4 space-y-2">
                                                        {[1, 2, 3].map(i => <div key={i} className="h-8 bg-gray-50 rounded animate-pulse" />)}
                                                    </div>
                                                ) : detalleItems.length === 0 ? (
                                                    <p className="text-sm text-gray-400 text-center py-6">Sin ventas con este método</p>
                                                ) : (
                                                    <div className="divide-y divide-gray-50">
                                                        {detalleItems.map((item, i) => {
                                                            const maxQty = detalleItems[0].qty
                                                            const pct = Math.round((item.qty / maxQty) * 100)
                                                            return (
                                                                <div key={item.name} className="px-4 py-3">
                                                                    <div className="flex items-center justify-between mb-1.5">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`text-xs font-bold w-4 ${i === 0 ? 'text-amber-500' : 'text-gray-300'}`}>
                                                                                #{i + 1}
                                                                            </span>
                                                                            <span className="text-sm text-gray-800">{item.name}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-3">
                                                                            <span className="text-xs text-gray-500">
                                                                                {item.qty} {item.qty === 1 ? 'unidad' : 'unidades'}
                                                                            </span>
                                                                            <span className="text-sm font-semibold text-gray-900 w-20 text-right">
                                                                                Bs. {item.revenue.toFixed(2)}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                                        <div
                                                                            className={`h-full rounded-full transition-all duration-500 ${m.bar}`}
                                                                            style={{ width: `${pct}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}

                                                        {/* Subtotal del método */}
                                                        <div className="px-4 py-3 bg-gray-50 flex justify-between items-center">
                                                            <span className="text-xs font-medium text-gray-600">
                                                                Total {m.label} · {detalleItems.reduce((s, i) => s + i.qty, 0)} ítems
                                                            </span>
                                                            <span className="text-sm font-bold text-gray-900">
                                                                Bs. {detalleItems.reduce((s, i) => s + i.revenue, 0).toFixed(2)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Detalle de transacciones */}
                        {arqueoDetalle.length > 0 && (
                            <div className="border border-gray-100 rounded-xl overflow-hidden mb-4">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100">
                                            <th className="text-left text-xs text-gray-500 font-medium px-4 py-2.5">Hora</th>
                                            <th className="text-left text-xs text-gray-500 font-medium px-4 py-2.5">Pedido</th>
                                            <th className="text-left text-xs text-gray-500 font-medium px-4 py-2.5">Método</th>
                                            <th className="text-right text-xs text-gray-500 font-medium px-4 py-2.5">Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {arqueoDetalle.map((t, i) => (
                                            <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                                                <td className="px-4 py-2.5 text-xs text-gray-500">
                                                    {new Date(t.paid_at).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="px-4 py-2.5 text-sm text-gray-700">
                                                    {t.order_type === 'mesa' ? `Mesa #${t.table_number}` : `🥡 ${t.customer_name}`}
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${t.method === 'cash' ? 'bg-green-100 text-green-700' :
                                                        t.method === 'card' ? 'bg-blue-100 text-blue-700' :
                                                            'bg-purple-100 text-purple-700'
                                                        }`}>
                                                        {{ cash: '💵 Efectivo', card: '💳 Tarjeta', qr: '📱 QR' }[t.method as string]}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-sm font-semibold text-gray-900 text-right">
                                                    Bs. {Number(t.amount).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Total del día */}
                        <div className="flex items-center justify-between bg-gray-50 rounded-xl px-5 py-4">
                            <div>
                                <p className="text-xs text-gray-500">{arqueoFecha === new Date().toISOString().slice(0, 10) ? 'Total recaudado hoy' : 'Total recaudado'}</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {arqueoDetalle.length} {arqueoDetalle.length === 1 ? 'transacción' : 'transacciones'}
                                </p>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">
                                Bs. {arqueo.reduce((s, a) => s + a.total, 0).toFixed(2)}
                            </p>
                        </div>

                        {arqueoDetalle.length === 0 && (
                            <p className="text-sm text-gray-400 text-center py-6">{arqueoFecha === new Date().toISOString().slice(0, 10) ? 'Sin pagos registrados hoy' : 'Sin pagos registrados en esta fecha'}</p>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}