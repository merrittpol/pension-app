import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { MenuItem, ItemType } from '../../types/database'

export function MenuPage() {
    const [items, setItems] = useState<MenuItem[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [saving, setSaving] = useState(false)
    const [filter, setFilter] = useState<'all' | ItemType>('all')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editForm, setEditForm] = useState({ name: '', price: '', type: 'fixed' as ItemType, date: '' })

    const [form, setForm] = useState({
        name: '', price: '', type: 'fixed' as ItemType, date: '', available: true,
    })

    useEffect(() => { fetchItems() }, [])

    async function fetchItems() {
        const { data } = await supabase
            .from('menu_items')
            .select('*')
            .order('type')
            .order('name')
        setItems(data ?? [])
        setLoading(false)
    }

    async function handleSave() {
        if (!form.name || !form.price) return
        setSaving(true)
        await supabase.from('menu_items').insert({
            name: form.name,
            price: parseFloat(form.price),
            type: form.type,
            available: form.available,
            date: form.type === 'daily' && form.date ? form.date : null,
        })
        setForm({ name: '', price: '', type: 'fixed', date: '', available: true })
        setShowForm(false)
        setSaving(false)
        fetchItems()
    }

    async function toggleAvailable(item: MenuItem) {
        await supabase
            .from('menu_items')
            .update({ available: !item.available })
            .eq('id', item.id)
        fetchItems()
    }

    async function deleteItem(id: string) {
        if (!confirm('¿Eliminar este ítem del menú?')) return
        await supabase.from('menu_items').delete().eq('id', id)
        fetchItems()
    }

    function startEdit(item: MenuItem) {
        setEditingId(item.id)
        setEditForm({
            name: item.name,
            price: item.price.toString(),
            type: item.type,
            date: item.date ?? '',
        })
    }

    async function handleUpdate() {
        if (!editingId || !editForm.name || !editForm.price) return
        setSaving(true)
        await supabase.from('menu_items').update({
            name: editForm.name,
            price: parseFloat(editForm.price),
            type: editForm.type,
            date: editForm.type === 'daily' && editForm.date ? editForm.date : null,
        }).eq('id', editingId)
        setEditingId(null)
        setSaving(false)
        fetchItems()
    }

    const filtered = filter === 'all' ? items : items.filter(i => i.type === filter)

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Gestión de Menú</h2>
                    <p className="text-sm text-gray-500 mt-0.5">{items.length} ítems en total</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                    + Nuevo ítem
                </button>
            </div>

            {/* Filtros */}
            <div className="flex gap-2 mb-6">
                {(['all', 'fixed', 'daily'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                    >
                        {{ all: 'Todos', fixed: 'Fijos', daily: 'Diarios' }[f]}
                    </button>
                ))}
            </div>

            {/* Formulario nuevo ítem */}
            {showForm && (
                <div className="bg-white rounded-xl border border-blue-100 p-5 mb-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">Nuevo ítem</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: Almuerzo del día"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Precio (Bs.)</label>
                            <input
                                type="number"
                                value={form.price}
                                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="0.00"
                                min="0"
                                step="0.5"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Tipo</label>
                            <select
                                value={form.type}
                                onChange={e => setForm(f => ({ ...f, type: e.target.value as ItemType }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="fixed">Fijo (siempre disponible)</option>
                                <option value="daily">Diario (menú del día)</option>
                            </select>
                        </div>
                        {form.type === 'daily' && (
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Fecha</label>
                                <input
                                    type="date"
                                    value={form.date}
                                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        )}
                        <div className="flex items-center gap-2 col-span-2">
                            <input
                                type="checkbox"
                                id="available"
                                checked={form.available}
                                onChange={e => setForm(f => ({ ...f, available: e.target.checked }))}
                                className="rounded"
                            />
                            <label htmlFor="available" className="text-sm text-gray-600">Disponible ahora</label>
                        </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                        <button
                            onClick={handleSave}
                            disabled={saving || !form.name || !form.price}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            {saving ? 'Guardando...' : 'Guardar'}
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

            {/* Lista de ítems */}
            {loading ? (
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="text-left text-xs text-gray-500 font-medium px-4 py-3 min-w-[120px]">Nombre</th>
                                <th className="text-left text-xs text-gray-500 font-medium px-4 py-3 whitespace-nowrap">Tipo</th>
                                <th className="text-left text-xs text-gray-500 font-medium px-4 py-3 whitespace-nowrap">Precio</th>
                                <th className="text-left text-xs text-gray-500 font-medium px-4 py-3 whitespace-nowrap">Estado</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(item => (
                                <tr key={item.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                                    {editingId === item.id ? (
                                        /* Modo edición inline */
                                        <>
                                            <td className="px-4 py-2 min-w-[120px]">
                                                <input
                                                    type="text"
                                                    value={editForm.name}
                                                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                                    className="w-full min-w-[100px] px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap">
                                                <select
                                                    value={editForm.type}
                                                    onChange={e => setEditForm(f => ({ ...f, type: e.target.value as ItemType }))}
                                                    className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="fixed">Fijo</option>
                                                    <option value="daily">Diario</option>
                                                </select>
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap">
                                                <input
                                                    type="number"
                                                    value={editForm.price}
                                                    onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                                                    className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    min="0"
                                                    step="0.5"
                                                />
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap">
                                                <button
                                                    onClick={() => toggleAvailable(item)}
                                                    className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${item.available
                                                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                        }`}
                                                >
                                                    {item.available ? 'Disponible' : 'No disp.'}
                                                </button>
                                            </td>
                                            <td className="px-4 py-2 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={handleUpdate}
                                                        disabled={saving || !editForm.name || !editForm.price}
                                                        className="text-xs px-2.5 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                                                    >
                                                        {saving ? '...' : 'Guardar'}
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingId(null)}
                                                        className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                                                    >
                                                        Cancelar
                                                    </button>
                                                </div>
                                            </td>
                                        </>
                                    ) : (
                                        /* Modo visualización normal */
                                        <>
                                            <td className="px-4 py-3.5 min-w-[120px]">
                                                <p className="text-sm font-medium text-gray-900 leading-tight">{item.name}</p>
                                                {item.date && <p className="text-xs text-gray-400 mt-1">{item.date}</p>}
                                            </td>
                                            <td className="px-4 py-3.5 whitespace-nowrap">
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${item.type === 'daily'
                                                        ? 'bg-purple-100 text-purple-700'
                                                        : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {item.type === 'daily' ? 'Diario' : 'Fijo'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 text-sm font-medium text-gray-900 whitespace-nowrap">
                                                Bs. {item.price.toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3.5 whitespace-nowrap">
                                                <button
                                                    onClick={() => toggleAvailable(item)}
                                                    className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${item.available
                                                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                        }`}
                                                >
                                                    {item.available ? 'Disponible' : 'No disp.'}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => startEdit(item)}
                                                        className="text-gray-400 hover:text-blue-500 transition-colors text-sm"
                                                        title="Editar ítem"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        onClick={() => deleteItem(item.id)}
                                                        className="text-gray-400 hover:text-red-500 transition-colors text-sm"
                                                        title="Eliminar ítem"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filtered.length === 0 && (
                        <div className="text-center py-12 text-gray-400 text-sm">
                            No hay ítems en esta categoría
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}