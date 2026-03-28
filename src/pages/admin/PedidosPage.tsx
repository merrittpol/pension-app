import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Order, OrderStatus, MenuItem, Table, PaymentMethod } from '../../types/database'

const STATUS_CONFIG = {
    pending: { label: 'Pendiente', color: 'bg-gray-100 text-gray-600', next: 'preparing' as OrderStatus },
    preparing: { label: 'Preparando', color: 'bg-amber-100 text-amber-700', next: 'ready' as OrderStatus },
    ready: { label: 'Listo', color: 'bg-blue-100 text-blue-700', next: 'delivered' as OrderStatus },
    delivered: { label: 'Entregado', color: 'bg-green-100 text-green-700', next: null },
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: string }[] = [
    { value: 'cash', label: 'Efectivo', icon: '💵' },
    { value: 'card', label: 'Tarjeta', icon: '💳' },
    { value: 'qr', label: 'QR', icon: '📱' },
]

interface OrderWithItems extends Order {
    items: { name: string; quantity: number; unit_price: number }[]
    table_number?: number
    total: number
    paid: boolean
}

export function PedidosPage() {
    const [orders, setOrders] = useState<OrderWithItems[]>([])
    const [tables, setTables] = useState<Table[]>([])
    const [menuItems, setMenuItems] = useState<MenuItem[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [filterStatus, setFilter] = useState<OrderStatus | 'all'>('all')
    const [updating, setUpdating] = useState<string | null>(null)

    // Modal pago
    const [payOrder, setPayOrder] = useState<OrderWithItems | null>(null)
    const [payMethod, setPayMethod] = useState<PaymentMethod>('cash')
    const [paying, setPaying] = useState(false)

    // Form nuevo pedido
    const [orderType, setOrderType] = useState<'mesa' | 'para_llevar'>('mesa')
    const [tableId, setTableId] = useState('')
    const [customerName, setCustomerName] = useState('')
    const [cart, setCart] = useState<{ menu_item_id: string; quantity: number; unit_price: number; name: string }[]>([])
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        fetchAll()
        const channel = supabase
            .channel('orders-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchAll)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, fetchAll)
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [])

    async function fetchAll() {
        const [ordersRes, tablesRes, menuRes, paymentsRes] = await Promise.all([
            supabase.from('orders').select('*').order('created_at', { ascending: false }),
            supabase.from('tables').select('*').order('number'),
            supabase.from('menu_items').select('*').eq('available', true).order('name'),
            supabase.from('payments').select('order_id'),
        ])

        const paidOrderIds = new Set((paymentsRes.data ?? []).map(p => p.order_id))
        const ordersData = ordersRes.data ?? []

        const enriched = await Promise.all(
            ordersData.map(async (order) => {
                const { data: items } = await supabase
                    .from('order_items')
                    .select('quantity, unit_price, menu_items(name)')
                    .eq('order_id', order.id)

                const parsedItems = (items ?? []).map((i: any) => ({
                    name: i.menu_items?.name ?? '',
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                }))

                const table = (tablesRes.data ?? []).find(t => t.id === order.table_id)

                return {
                    ...order,
                    items: parsedItems,
                    table_number: table?.number,
                    total: parsedItems.reduce((s, i) => s + i.quantity * i.unit_price, 0),
                    paid: paidOrderIds.has(order.id),
                }
            })
        )

        setOrders(enriched)
        setTables(tablesRes.data ?? [])
        setMenuItems(menuRes.data ?? [])
        setLoading(false)
    }

    function addToCart(item: MenuItem) {
        setCart(c => {
            const existing = c.find(i => i.menu_item_id === item.id)
            if (existing) return c.map(i => i.menu_item_id === item.id ? { ...i, quantity: i.quantity + 1 } : i)
            return [...c, { menu_item_id: item.id, quantity: 1, unit_price: item.price, name: item.name }]
        })
    }

    function removeFromCart(id: string) { setCart(c => c.filter(i => i.menu_item_id !== id)) }

    function updateQty(id: string, qty: number) {
        if (qty < 1) return removeFromCart(id)
        setCart(c => c.map(i => i.menu_item_id === id ? { ...i, quantity: qty } : i))
    }

    async function submitOrder() {
        if (cart.length === 0) return
        if (orderType === 'mesa' && !tableId) return
        if (orderType === 'para_llevar' && !customerName.trim()) return
        setSaving(true)

        const { data: user } = await supabase.auth.getUser()

        const { data: order, error } = await supabase
            .from('orders')
            .insert({
                type: orderType,
                table_id: orderType === 'mesa' ? tableId : null,
                customer_name: orderType === 'para_llevar' ? customerName : null,
                user_id: user.user!.id,
                status: 'pending',
            })
            .select()
            .single()

        if (error || !order) { setSaving(false); return }

        await supabase.from('order_items').insert(
            cart.map(i => ({
                order_id: order.id,
                menu_item_id: i.menu_item_id,
                quantity: i.quantity,
                unit_price: i.unit_price,
            }))
        )

        if (orderType === 'mesa' && tableId) {
            await supabase.from('tables').update({ status: 'occupied' }).eq('id', tableId)
        }

        setCart([])
        setTableId('')
        setCustomerName('')
        setShowForm(false)
        setSaving(false)
        fetchAll()
    }

    async function advanceStatus(order: OrderWithItems) {
        const next = STATUS_CONFIG[order.status].next
        if (!next) return
        setUpdating(order.id)
        await supabase.from('orders').update({ status: next }).eq('id', order.id)
        if (next === 'delivered' && order.table_id) {
            await supabase.from('tables').update({ status: 'pending' }).eq('id', order.table_id)
        }
        setUpdating(null)
        fetchAll()
    }

    async function confirmPayment() {
        if (!payOrder) return
        setPaying(true)
        await supabase.from('payments').insert({
            order_id: payOrder.id,
            amount: payOrder.total,
            method: payMethod,
            paid_at: new Date().toISOString(),
        })
        if (payOrder.table_id) {
            await supabase.from('tables').update({ status: 'available' }).eq('id', payOrder.table_id)
        }
        setPaying(false)
        setPayOrder(null)
        fetchAll()
    }

    const filtered = filterStatus === 'all'
        ? orders.filter(o => o.status !== 'delivered')
        : orders.filter(o => o.status === filterStatus)

    const cartTotal = cart.reduce((s, i) => s + i.quantity * i.unit_price, 0)

    return (
        <div className="p-8">
            {/* Modal pago */}
            {payOrder && (
                <div
                    className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
                    onClick={e => { if (e.target === e.currentTarget) setPayOrder(null) }}
                >
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
                        <h3 className="text-base font-semibold text-gray-900 mb-1">Registrar pago</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            {payOrder.type === 'mesa' ? `Mesa #${payOrder.table_number}` : payOrder.customer_name}
                        </p>

                        <div className="bg-gray-50 rounded-lg p-3 mb-4">
                            {payOrder.items.map((item, i) => (
                                <div key={i} className="flex justify-between text-sm py-0.5">
                                    <span className="text-gray-600">{item.quantity}× {item.name}</span>
                                    <span className="text-gray-800">Bs. {(item.quantity * item.unit_price).toFixed(2)}</span>
                                </div>
                            ))}
                            <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between">
                                <span className="text-sm font-semibold text-gray-900">Total</span>
                                <span className="text-sm font-bold text-gray-900">Bs. {payOrder.total.toFixed(2)}</span>
                            </div>
                        </div>

                        <p className="text-xs text-gray-500 mb-2 font-medium">Método de pago</p>
                        <div className="grid grid-cols-3 gap-2 mb-5">
                            {PAYMENT_METHODS.map(m => (
                                <button
                                    key={m.value}
                                    onClick={() => setPayMethod(m.value)}
                                    className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-colors ${payMethod === m.value
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <span className="text-xl">{m.icon}</span>
                                    <span className="text-xs font-medium text-gray-700">{m.label}</span>
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={confirmPayment}
                                disabled={paying}
                                className="flex-1 bg-green-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                                {paying ? 'Procesando...' : '✓ Confirmar pago'}
                            </button>
                            <button
                                onClick={() => setPayOrder(null)}
                                className="px-4 py-2.5 rounded-xl text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Pedidos</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {orders.filter(o => o.status !== 'delivered').length} pedidos activos
                    </p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                    + Nuevo pedido
                </button>
            </div>

            {/* Filtros */}
            <div className="flex gap-2 mb-6 flex-wrap">
                {(['all', 'pending', 'preparing', 'ready', 'delivered'] as const).map(s => (
                    <button
                        key={s}
                        onClick={() => setFilter(s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === s
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                    >
                        {{ all: 'Activos', pending: 'Pendiente', preparing: 'Preparando', ready: 'Listo', delivered: 'Entregado' }[s]}
                    </button>
                ))}
            </div>

            {/* Formulario nuevo pedido */}
            {showForm && (
                <div className="bg-white rounded-xl border border-blue-100 p-5 mb-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">Nuevo pedido</h3>

                    <div className="flex gap-2 mb-4">
                        {(['mesa', 'para_llevar'] as const).map(t => (
                            <button
                                key={t}
                                onClick={() => setOrderType(t)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${orderType === t ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                {t === 'mesa' ? '🪑 Mesa' : '🥡 Para llevar'}
                            </button>
                        ))}
                    </div>

                    {orderType === 'mesa' ? (
                        <div className="mb-4">
                            <label className="block text-xs text-gray-500 mb-2">Seleccionar mesa disponible</label>
                            <div className="flex flex-wrap gap-2">
                                {tables.filter(t => t.status === 'available' && !t.disabled).map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => setTableId(t.id)}
                                        className={`w-12 h-12 rounded-lg text-sm font-semibold transition-colors ${tableId === t.id
                                            ? 'bg-blue-600 text-white'
                                            : 'border border-gray-200 text-gray-700 hover:border-blue-300'
                                            }`}
                                    >
                                        #{t.number}
                                    </button>
                                ))}
                                {tables.filter(t => t.status === 'available').length === 0 && (
                                    <p className="text-sm text-gray-400">No hay mesas disponibles</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="mb-4">
                            <label className="block text-xs text-gray-500 mb-1">Nombre del cliente</label>
                            <input
                                type="text"
                                value={customerName}
                                onChange={e => setCustomerName(e.target.value)}
                                className="w-full max-w-xs px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: Juan Pérez"
                            />
                        </div>
                    )}

                    <div className="mb-4">
                        <label className="block text-xs text-gray-500 mb-2">Agregar ítems</label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                            {menuItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => addToCart(item)}
                                    className="flex flex-col items-start p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                                >
                                    <span className="text-sm font-medium text-gray-900 truncate w-full">{item.name}</span>
                                    <span className="text-xs text-gray-500 mt-0.5">Bs. {item.price.toFixed(2)}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {cart.length > 0 && (
                        <div className="bg-gray-50 rounded-lg p-3 mb-4">
                            <p className="text-xs font-medium text-gray-500 mb-2">Carrito</p>
                            <div className="space-y-2">
                                {cart.map(item => (
                                    <div key={item.menu_item_id} className="flex items-center justify-between gap-2">
                                        <span className="text-sm text-gray-700 flex-1 truncate">{item.name}</span>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => updateQty(item.menu_item_id, item.quantity - 1)}
                                                className="w-6 h-6 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 text-xs">−</button>
                                            <span className="text-sm w-6 text-center">{item.quantity}</span>
                                            <button onClick={() => updateQty(item.menu_item_id, item.quantity + 1)}
                                                className="w-6 h-6 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 text-xs">+</button>
                                        </div>
                                        <span className="text-sm font-medium text-gray-900 w-16 text-right">
                                            Bs. {(item.quantity * item.unit_price).toFixed(2)}
                                        </span>
                                        <button onClick={() => removeFromCart(item.menu_item_id)}
                                            className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
                                    </div>
                                ))}
                            </div>
                            <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between">
                                <span className="text-sm font-medium text-gray-700">Total</span>
                                <span className="text-sm font-semibold text-gray-900">Bs. {cartTotal.toFixed(2)}</span>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button
                            onClick={submitOrder}
                            disabled={saving || cart.length === 0}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            {saving ? 'Guardando...' : 'Confirmar pedido'}
                        </button>
                        <button
                            onClick={() => { setShowForm(false); setCart([]) }}
                            className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Lista de pedidos */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                    <p className="text-lg">Sin pedidos activos</p>
                    <p className="text-sm mt-1">Los nuevos pedidos aparecerán aquí</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(order => {
                        const cfg = STATUS_CONFIG[order.status]
                        return (
                            <div
                                key={order.id}
                                className={`rounded-xl border p-5 transition-colors ${order.paid
                                    ? 'bg-gray-50 border-gray-100 opacity-60'
                                    : 'bg-white border-gray-100'
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-gray-900">
                                                {order.type === 'mesa'
                                                    ? `Mesa #${order.table_number}`
                                                    : `🥡 ${order.customer_name}`}
                                            </span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.color}`}>
                                                {cfg.label}
                                            </span>
                                            {order.paid && (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 font-medium">
                                                    ✓ Pagado
                                                </span>
                                            )}
                                            <span className="text-xs text-gray-400">
                                                {new Date(order.created_at).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>

                                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                                            {order.items.map((item, i) => (
                                                <span key={i} className="text-sm text-gray-600">
                                                    {item.quantity}× {item.name}
                                                </span>
                                            ))}
                                        </div>

                                        <p className="text-sm font-semibold text-gray-900 mt-2">
                                            Total: Bs. {order.total.toFixed(2)}
                                        </p>
                                    </div>

                                    <div className="flex flex-col gap-2 items-end shrink-0">
                                        {/* Avanzar estado — siempre disponible mientras no esté entregado */}
                                        {cfg.next && (
                                            <button
                                                onClick={() => advanceStatus(order)}
                                                disabled={updating === order.id}
                                                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                                            >
                                                {updating === order.id ? '...' : `→ ${STATUS_CONFIG[cfg.next].label}`}
                                            </button>
                                        )}

                                        {/* Cobrar ahora — solo si no está pagado y no está entregado */}
                                        {!order.paid && order.status !== 'delivered' && (
                                            <button
                                                onClick={() => { setPayOrder(order); setPayMethod('cash') }}
                                                className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors whitespace-nowrap"
                                            >
                                                💰 Cobrar ahora
                                            </button>
                                        )}

                                        {/* Registrar pago — solo si fue entregado y no pagado */}
                                        {order.status === 'delivered' && !order.paid && (
                                            <button
                                                onClick={() => { setPayOrder(order); setPayMethod('cash') }}
                                                className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
                                            >
                                                💰 Registrar pago
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}