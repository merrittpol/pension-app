import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { MenuItem, Order, OrderStatus } from '../../types/database'

const STATUS_CONFIG = {
    pending: { label: 'Pendiente', color: 'bg-gray-100 text-gray-600' },
    preparing: { label: 'Preparando', color: 'bg-amber-100 text-amber-700' },
    ready: { label: 'Listo', color: 'bg-blue-100 text-blue-700' },
    delivered: { label: 'Entregado', color: 'bg-green-100 text-green-700' },
}

interface OrderWithItems extends Order {
    items: { name: string; quantity: number; unit_price: number }[]
    total: number
    paid: boolean
}

export function MeseroPedidos() {
    const [searchParams] = useSearchParams()
    const mesaId = searchParams.get('mesa')
    const mesaNumero = searchParams.get('numero')
    const { profile } = useAuth()

    const [menuItems, setMenuItems] = useState<MenuItem[]>([])
    const [orders, setOrders] = useState<OrderWithItems[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [cart, setCart] = useState<{ menu_item_id: string; quantity: number; unit_price: number; name: string }[]>([])
    const [customerName, setCustomerName] = useState('')
    const [orderType, setOrderType] = useState<'mesa' | 'para_llevar'>(mesaId ? 'mesa' : 'para_llevar')
    const [showCart, setShowCart] = useState(false)

    useEffect(() => { fetchAll() }, [])

    async function fetchAll() {
        const [menuRes, ordersRes, paymentsRes] = await Promise.all([
            supabase.from('menu_items').select('*').eq('available', true).order('type').order('name'),
            supabase.from('orders').select('*')
                .in('status', ['pending', 'preparing', 'ready'])
                .order('created_at', { ascending: false }),
            supabase.from('payments').select('order_id'),
        ])

        const paidIds = new Set((paymentsRes.data ?? []).map(p => p.order_id))
        const allOrders = ordersRes.data ?? []

        const enriched = await Promise.all(
            allOrders.map(async order => {
                const { data: items } = await supabase
                    .from('order_items')
                    .select('quantity, unit_price, menu_items(name)')
                    .eq('order_id', order.id)
                const parsed = (items ?? []).map((i: any) => ({
                    name: i.menu_items?.name ?? '',
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                }))
                return {
                    ...order,
                    items: parsed,
                    total: parsed.reduce((s, i) => s + i.quantity * i.unit_price, 0),
                    paid: paidIds.has(order.id),
                }
            })
        )

        setMenuItems(menuRes.data ?? [])
        setOrders(enriched)
        setLoading(false)
    }

    function addToCart(item: MenuItem) {
        setCart(c => {
            const ex = c.find(i => i.menu_item_id === item.id)
            if (ex) return c.map(i => i.menu_item_id === item.id ? { ...i, quantity: i.quantity + 1 } : i)
            return [...c, { menu_item_id: item.id, quantity: 1, unit_price: item.price, name: item.name }]
        })
    }

    function updateQty(id: string, qty: number) {
        if (qty < 1) setCart(c => c.filter(i => i.menu_item_id !== id))
        else setCart(c => c.map(i => i.menu_item_id === id ? { ...i, quantity: qty } : i))
    }

    async function submitOrder() {
        if (cart.length === 0) return
        if (orderType === 'para_llevar' && !customerName.trim()) return
        setSaving(true)

        const { data: order } = await supabase
            .from('orders')
            .insert({
                type: orderType,
                table_id: orderType === 'mesa' ? mesaId : null,
                customer_name: orderType === 'para_llevar' ? customerName : null,
                user_id: profile!.id,
                status: 'pending',
            })
            .select()
            .single()

        if (order) {
            await supabase.from('order_items').insert(
                cart.map(i => ({
                    order_id: order.id,
                    menu_item_id: i.menu_item_id,
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                }))
            )
            if (orderType === 'mesa' && mesaId) {
                await supabase.from('tables').update({ status: 'occupied' }).eq('id', mesaId)
            }
        }

        setCart([])
        setShowCart(false)
        setSaving(false)
        fetchAll()
    }

    const cartTotal = cart.reduce((s, i) => s + i.quantity * i.unit_price, 0)
    const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
    const daily = menuItems.filter(i => i.type === 'daily')
    const fixed = menuItems.filter(i => i.type === 'fixed')

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                        {mesaNumero ? `Mesa #${mesaNumero}` : 'Pedidos'}
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {orders.length} pedidos activos
                    </p>
                </div>
                {cart.length > 0 && (
                    <button
                        onClick={() => setShowCart(true)}
                        className="relative bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                        🛒 Ver pedido
                        <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center">
                            {cartCount}
                        </span>
                    </button>
                )}
            </div>

            {/* Tipo de pedido */}
            <div className="flex gap-2 mb-5">
                {(['mesa', 'para_llevar'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setOrderType(t)}
                        disabled={t === 'mesa' && !mesaId}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${orderType === t ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        {t === 'mesa' ? '🪑 Mesa' : '🥡 Para llevar'}
                    </button>
                ))}
                {orderType === 'para_llevar' && (
                    <input
                        type="text"
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Nombre del cliente"
                    />
                )}
            </div>

            {/* Menú */}
            {loading ? (
                <div className="grid grid-cols-2 gap-3">
                    {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
                </div>
            ) : (
                <div className="space-y-4 mb-6">
                    {daily.length > 0 && (
                        <div>
                            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Menú del día</p>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {daily.map(item => {
                                    const inCart = cart.find(c => c.menu_item_id === item.id)
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => addToCart(item)}
                                            className={`p-3 rounded-xl border-2 text-left transition-all ${inCart
                                                    ? 'border-blue-400 bg-blue-50'
                                                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                                                }`}
                                        >
                                            <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">Bs. {item.price.toFixed(2)}</p>
                                            {inCart && (
                                                <span className="text-xs text-blue-600 font-medium">{inCart.quantity} en pedido</span>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {fixed.length > 0 && (
                        <div>
                            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Bebidas y extras</p>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {fixed.map(item => {
                                    const inCart = cart.find(c => c.menu_item_id === item.id)
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => addToCart(item)}
                                            className={`p-3 rounded-xl border-2 text-left transition-all ${inCart
                                                    ? 'border-purple-400 bg-purple-50'
                                                    : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                                                }`}
                                        >
                                            <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">Bs. {item.price.toFixed(2)}</p>
                                            {inCart && (
                                                <span className="text-xs text-purple-600 font-medium">{inCart.quantity} en pedido</span>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Modal carrito */}
            {showCart && (
                <div
                    className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50"
                    onClick={e => { if (e.target === e.currentTarget) setShowCart(false) }}
                >
                    <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-6 shadow-xl">
                        <h3 className="text-base font-semibold text-gray-900 mb-4">
                            {orderType === 'mesa' ? `Mesa #${mesaNumero}` : `🥡 ${customerName || 'Para llevar'}`}
                        </h3>

                        <div className="space-y-3 mb-4">
                            {cart.map(item => (
                                <div key={item.menu_item_id} className="flex items-center gap-3">
                                    <span className="text-sm text-gray-700 flex-1">{item.name}</span>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => updateQty(item.menu_item_id, item.quantity - 1)}
                                            className="w-7 h-7 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm">−</button>
                                        <span className="text-sm w-6 text-center font-medium">{item.quantity}</span>
                                        <button onClick={() => updateQty(item.menu_item_id, item.quantity + 1)}
                                            className="w-7 h-7 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm">+</button>
                                    </div>
                                    <span className="text-sm font-semibold text-gray-900 w-16 text-right">
                                        Bs. {(item.quantity * item.unit_price).toFixed(2)}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-gray-100 pt-3 mb-4 flex justify-between">
                            <span className="text-sm font-medium text-gray-700">Total estimado</span>
                            <span className="text-base font-bold text-gray-900">Bs. {cartTotal.toFixed(2)}</span>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={submitOrder}
                                disabled={saving}
                                className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                                {saving ? 'Enviando...' : '✓ Enviar a cocina'}
                            </button>
                            <button
                                onClick={() => setShowCart(false)}
                                className="px-4 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
                            >
                                Editar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Pedidos activos */}
            {orders.length > 0 && (
                <div className="mt-6">
                    <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">Pedidos en curso</p>
                    <div className="space-y-3">
                        {orders.map(order => (
                            <div key={order.id} className={`rounded-xl border p-4 ${order.paid ? 'bg-gray-50 opacity-60' : 'bg-white'}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-gray-900">
                                            {order.type === 'mesa' ? `Mesa #${order.table_id?.slice(-4)}` : `🥡 ${order.customer_name}`}
                                        </span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CONFIG[order.status].color}`}>
                                            {STATUS_CONFIG[order.status].label}
                                        </span>
                                        {order.paid && <span className="text-xs text-gray-400">✓ Pagado</span>}
                                    </div>
                                    <span className="text-xs text-gray-400">
                                        {new Date(order.created_at).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                    {order.items.map((item, i) => (
                                        <span key={i} className="text-xs text-gray-500">{item.quantity}× {item.name}</span>
                                    ))}
                                </div>
                                <p className="text-sm font-semibold text-gray-900 mt-2">Bs. {order.total.toFixed(2)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}