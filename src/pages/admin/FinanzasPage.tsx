import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend
} from 'recharts'

type Category = 'ingredientes' | 'servicios' | 'personal' | 'equipamiento' | 'limpieza' | 'otros'

interface Expense {
    id: string
    description: string
    amount: number
    category: Category
    date: string
    note: string | null
    created_at: string
}

interface DayBalance {
    date: string
    label: string
    ingresos: number
    gastos: number
    balance: number
}

const CATEGORIES: { value: Category; label: string; icon: string; color: string }[] = [
    { value: 'ingredientes', label: 'Ingredientes', icon: '🥕', color: 'bg-green-100 text-green-700' },
    { value: 'servicios', label: 'Servicios', icon: '💡', color: 'bg-blue-100 text-blue-700' },
    { value: 'personal', label: 'Personal', icon: '👤', color: 'bg-purple-100 text-purple-700' },
    { value: 'equipamiento', label: 'Equipamiento', icon: '🔧', color: 'bg-amber-100 text-amber-700' },
    { value: 'limpieza', label: 'Limpieza', icon: '🧹', color: 'bg-cyan-100 text-cyan-700' },
    { value: 'otros', label: 'Otros', icon: '📦', color: 'bg-gray-100 text-gray-600' },
]

export function FinanzasPage() {
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [chartData, setChartData] = useState<DayBalance[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [saving, setSaving] = useState(false)
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const [filterCat, setFilterCat] = useState<Category | 'all'>('all')
    const [deleting, setDeleting] = useState<string | null>(null)

    const [form, setForm] = useState({
        description: '',
        amount: '',
        category: 'ingredientes' as Category,
        date: new Date().toISOString().split('T')[0],
        note: '',
    })

    useEffect(() => { fetchAll() }, [selectedDate])

    async function fetchAll() {
        setLoading(true)

        // Gastos del día seleccionado
        const { data: expData } = await supabase
            .from('expenses')
            .select('*')
            .eq('date', selectedDate)
            .order('created_at', { ascending: false })

        // Últimos 14 días para el gráfico
        const from = new Date()
        from.setDate(from.getDate() - 13)
        const fromStr = from.toISOString().split('T')[0]

        const { data: expChart } = await supabase
            .from('expenses')
            .select('date, amount')
            .gte('date', fromStr)

        const { data: payments } = await supabase
            .from('payments')
            .select('amount, paid_at')
            .gte('paid_at', from.toISOString())

        // Construir datos del gráfico día por día
        const days: DayBalance[] = []
        for (let i = 13; i >= 0; i--) {
            const d = new Date()
            d.setDate(d.getDate() - i)
            const dateStr = d.toISOString().split('T')[0]

            const gastos = (expChart ?? [])
                .filter(e => e.date === dateStr)
                .reduce((s, e) => s + Number(e.amount), 0)

            const ingresos = (payments ?? [])
                .filter(p => p.paid_at.startsWith(dateStr))
                .reduce((s, p) => s + Number(p.amount), 0)

            days.push({
                date: dateStr,
                label: d.toLocaleDateString('es-BO', { day: 'numeric', month: 'short' }),
                ingresos,
                gastos,
                balance: ingresos - gastos,
            })
        }

        setExpenses(expData ?? [])
        setChartData(days)
        setLoading(false)
    }

    async function handleSave() {
        if (!form.description || !form.amount) return
        setSaving(true)
        await supabase.from('expenses').insert({
            description: form.description,
            amount: parseFloat(form.amount),
            category: form.category,
            date: form.date,
            note: form.note || null,
        })
        setForm({ description: '', amount: '', category: 'ingredientes', date: selectedDate, note: '' })
        setShowForm(false)
        setSaving(false)
        fetchAll()
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Eliminar este gasto?')) return
        setDeleting(id)
        await supabase.from('expenses').delete().eq('id', id)
        setDeleting(null)
        fetchAll()
    }

    // Métricas del día seleccionado
    const todayData = chartData.find(d => d.date === selectedDate)
    const ingresos = todayData?.ingresos ?? 0
    const gastos = expenses.reduce((s, e) => s + Number(e.amount), 0)
    const balance = ingresos - gastos
    const margen = ingresos > 0 ? (balance / ingresos) * 100 : 0

    const filtered = filterCat === 'all'
        ? expenses
        : expenses.filter(e => e.category === filterCat)

    const gastosPorCategoria = CATEGORIES.map(cat => ({
        ...cat,
        total: expenses.filter(e => e.category === cat.value).reduce((s, e) => s + Number(e.amount), 0),
    })).filter(c => c.total > 0).sort((a, b) => b.total - a.total)

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Finanzas</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Ingresos, gastos y balance diario</p>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        onClick={() => setShowForm(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                        + Registrar gasto
                    </button>
                </div>
            </div>

            {/* Métricas del día */}
            <div className="grid grid-cols-2 gap-4 mb-6 lg:grid-cols-4">
                {[
                    { label: 'Ingresos', value: `Bs. ${ingresos.toFixed(2)}`, color: 'text-green-600', bg: 'bg-green-50', icon: '📈' },
                    { label: 'Gastos', value: `Bs. ${gastos.toFixed(2)}`, color: 'text-red-600', bg: 'bg-red-50', icon: '📉' },
                    { label: 'Balance', value: `Bs. ${balance.toFixed(2)}`, color: balance >= 0 ? 'text-blue-600' : 'text-red-600', bg: balance >= 0 ? 'bg-blue-50' : 'bg-red-50', icon: balance >= 0 ? '✅' : '⚠️' },
                    { label: 'Margen', value: `${margen.toFixed(1)}%`, color: margen >= 0 ? 'text-purple-600' : 'text-red-600', bg: 'bg-purple-50', icon: '📊' },
                ].map(card => (
                    <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-4">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base mb-3 ${card.bg}`}>
                            {card.icon}
                        </div>
                        {loading
                            ? <div className="h-7 w-24 bg-gray-100 rounded animate-pulse mb-1" />
                            : <p className={`text-xl font-semibold ${card.color}`}>{card.value}</p>
                        }
                        <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
                    </div>
                ))}
            </div>

            {/* Gráfico 14 días */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Ingresos vs Gastos — últimos 14 días</h3>
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={v => `${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} tick={{ fontSize: 11 }} />
                        <Tooltip
                            formatter={(v: number, name: string) => [
                                `Bs. ${v.toFixed(2)}`,
                                name === 'ingresos' ? 'Ingresos' : 'Gastos'
                            ]}
                        />
                        <Legend
                            formatter={v => v === 'ingresos' ? 'Ingresos' : 'Gastos'}
                            wrapperStyle={{ fontSize: 12 }}
                        />
                        <Bar dataKey="ingresos" fill="#22C55E" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="gastos" fill="#EF4444" radius={[3, 3, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-6">
                {/* Gastos por categoría */}
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">Por categoría</h3>
                    {gastosPorCategoria.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">Sin gastos hoy</p>
                    ) : (
                        <div className="space-y-3">
                            {gastosPorCategoria.map(cat => {
                                const pct = Math.round((cat.total / gastos) * 100)
                                return (
                                    <div key={cat.value}>
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm">{cat.icon}</span>
                                                <span className="text-xs text-gray-700">{cat.label}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className="text-gray-400">{pct}%</span>
                                                <span className="font-semibold text-gray-900">Bs. {cat.total.toFixed(2)}</span>
                                            </div>
                                        </div>
                                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-red-400 rounded-full transition-all duration-500"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Balance 14 días */}
                <div className="bg-white rounded-xl border border-gray-100 p-5 lg:col-span-2">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">Balance neto por día</h3>
                    <div className="space-y-2">
                        {chartData.slice(-7).reverse().map(day => (
                            <div key={day.date} className="flex items-center gap-3">
                                <span className={`text-xs w-20 shrink-0 ${day.date === selectedDate ? 'font-semibold text-blue-600' : 'text-gray-400'}`}>
                                    {day.label}
                                </span>
                                <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden relative">
                                    {day.balance >= 0 ? (
                                        <div
                                            className="h-full bg-green-400 rounded-full transition-all duration-500"
                                            style={{ width: `${Math.min((day.balance / Math.max(...chartData.map(d => Math.abs(d.balance)), 1)) * 100, 100)}%` }}
                                        />
                                    ) : (
                                        <div
                                            className="h-full bg-red-400 rounded-full transition-all duration-500"
                                            style={{ width: `${Math.min((Math.abs(day.balance) / Math.max(...chartData.map(d => Math.abs(d.balance)), 1)) * 100, 100)}%` }}
                                        />
                                    )}
                                </div>
                                <span className={`text-xs font-semibold w-20 text-right shrink-0 ${day.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {day.balance >= 0 ? '+' : ''}Bs. {day.balance.toFixed(2)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Formulario nuevo gasto */}
            {showForm && (
                <div className="bg-white rounded-xl border border-blue-100 p-5 mb-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">Registrar gasto</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-xs text-gray-500 mb-1">Descripción</label>
                            <input
                                type="text"
                                value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: Compra de verduras"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Monto (Bs.)</label>
                            <input
                                type="number"
                                value={form.amount}
                                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="0.00"
                                min="0"
                                step="0.5"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Fecha</label>
                            <input
                                type="date"
                                value={form.date}
                                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Nota (opcional)</label>
                            <input
                                type="text"
                                value={form.note}
                                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: Mercado central"
                            />
                        </div>

                        {/* Categorías */}
                        <div className="col-span-2">
                            <label className="block text-xs text-gray-500 mb-2">Categoría</label>
                            <div className="flex flex-wrap gap-2">
                                {CATEGORIES.map(cat => (
                                    <button
                                        key={cat.value}
                                        onClick={() => setForm(f => ({ ...f, category: cat.value }))}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.category === cat.value
                                                ? cat.color + ' border-current'
                                                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                            }`}
                                    >
                                        {cat.icon} {cat.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                        <button
                            onClick={handleSave}
                            disabled={saving || !form.description || !form.amount}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            {saving ? 'Guardando...' : 'Guardar gasto'}
                        </button>
                        <button
                            onClick={() => setShowForm(false)}
                            className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Lista de gastos del día */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                    <h3 className="text-sm font-medium text-gray-900">
                        Gastos del {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-BO', { day: 'numeric', month: 'long' })}
                    </h3>
                    <div className="flex gap-1.5 flex-wrap">
                        <button
                            onClick={() => setFilterCat('all')}
                            className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${filterCat === 'all' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            Todos
                        </button>
                        {CATEGORIES.filter(c => expenses.some(e => e.category === c.value)).map(cat => (
                            <button
                                key={cat.value}
                                onClick={() => setFilterCat(cat.value)}
                                className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${filterCat === cat.value ? cat.color + ' font-medium' : 'text-gray-500 hover:bg-gray-100'}`}
                            >
                                {cat.icon} {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="p-4 space-y-2">
                        {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-50 rounded-lg animate-pulse" />)}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-sm">
                        <p>Sin gastos registrados</p>
                        <button
                            onClick={() => setShowForm(true)}
                            className="mt-2 text-blue-500 hover:text-blue-600 text-xs"
                        >
                            + Registrar primer gasto del día
                        </button>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left text-xs text-gray-500 font-medium px-5 py-2.5">Descripción</th>
                                <th className="text-left text-xs text-gray-500 font-medium px-5 py-2.5">Categoría</th>
                                <th className="text-left text-xs text-gray-500 font-medium px-5 py-2.5">Nota</th>
                                <th className="text-right text-xs text-gray-500 font-medium px-5 py-2.5">Monto</th>
                                <th className="px-5 py-2.5" />
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(expense => {
                                const cat = CATEGORIES.find(c => c.value === expense.category)!
                                return (
                                    <tr key={expense.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                                        <td className="px-5 py-3.5">
                                            <p className="text-sm font-medium text-gray-900">{expense.description}</p>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                {new Date(expense.created_at).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cat.color}`}>
                                                {cat.icon} {cat.label}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-xs text-gray-400">
                                            {expense.note ?? '—'}
                                        </td>
                                        <td className="px-5 py-3.5 text-right text-sm font-semibold text-red-600">
                                            − Bs. {Number(expense.amount).toFixed(2)}
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <button
                                                onClick={() => handleDelete(expense.id)}
                                                disabled={deleting === expense.id}
                                                className="text-gray-300 hover:text-red-400 disabled:opacity-30 transition-colors text-lg"
                                            >
                                                ×
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="bg-gray-50 border-t border-gray-200">
                                <td colSpan={3} className="px-5 py-3 text-sm font-medium text-gray-700">
                                    Total gastos del día
                                </td>
                                <td className="px-5 py-3 text-right text-sm font-bold text-red-600">
                                    − Bs. {gastos.toFixed(2)}
                                </td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                )}
            </div>
        </div>
    )
}