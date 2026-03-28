import { useEffect, useState } from 'react'
import { supabase, supabaseAdmin } from '../../lib/supabase'
import type { User, UserRole } from '../../types/database'

const ROLES: { value: UserRole; label: string; color: string; icon: string }[] = [
    { value: 'admin', label: 'Admin', color: 'bg-purple-100 text-purple-700', icon: '👑' },
    { value: 'mesero', label: 'Mesero', color: 'bg-blue-100 text-blue-700', icon: '🍽' },
    { value: 'cocina', label: 'Cocina', color: 'bg-amber-100 text-amber-700', icon: '👨‍🍳' },
]

interface UserWithEmail extends User {
    email?: string
}

export function UsuariosPage() {
    const [users, setUsers] = useState<UserWithEmail[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [saving, setSaving] = useState(false)
    const [updating, setUpdating] = useState<string | null>(null)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        role: 'mesero' as UserRole,
    })

    useEffect(() => { fetchUsers() }, [])

    async function fetchUsers() {
        setLoading(true)
        const { data } = await supabase
            .from('users')
            .select('*')
            .order('created_at')
        setUsers(data ?? [])
        setLoading(false)
    }

    async function handleCreate() {
        if (!form.name || !form.email || !form.password) return
        setSaving(true)
        setError(null)

        // 1. Crear en auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: form.email,
            password: form.password,
            email_confirm: true,
            user_metadata: {
                name: form.name,
                role: form.role,
            },
        })

        if (authError) {
            setError(authError.message)
            setSaving(false)
            return
        }

        // 2. Insertar en public.users
        await supabase.from('users').insert({
            id: authData.user.id,
            name: form.name,
            role: form.role,
        })

        setForm({ name: '', email: '', password: '', role: 'mesero' })
        setShowForm(false)
        setSaving(false)
        setSuccess('Usuario creado correctamente')
        setTimeout(() => setSuccess(null), 3000)
        fetchUsers()
    }

    async function changeRole(userId: string, role: UserRole) {
        setUpdating(userId)
        await supabase.from('users').update({ role }).eq('id', userId)
        setUpdating(null)
        fetchUsers()
    }

    async function deleteUser(user: UserWithEmail) {
        if (!confirm(`¿Eliminar a ${user.name}? Esta acción no se puede deshacer.`)) return
        setDeleting(user.id)
        await supabase.from('users').delete().eq('id', user.id)
        setDeleting(null)
        fetchUsers()
    }

    const roleCount = (role: UserRole) => users.filter(u => u.role === role).length

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Usuarios</h2>
                    <p className="text-sm text-gray-500 mt-0.5">{users.length} usuarios registrados</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                    + Nuevo usuario
                </button>
            </div>

            {/* Resumen por rol */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                {ROLES.map(r => (
                    <div key={r.value} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${r.color}`}>
                            {r.icon}
                        </div>
                        <div>
                            <p className="text-xl font-semibold text-gray-900">{roleCount(r.value)}</p>
                            <p className="text-xs text-gray-500">{r.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Notificaciones */}
            {success && (
                <div className="mb-4 px-4 py-3 bg-green-50 border border-green-100 rounded-lg text-sm text-green-700">
                    ✓ {success}
                </div>
            )}
            {error && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
                    {error}
                </div>
            )}

            {/* Formulario nuevo usuario */}
            {showForm && (
                <div className="bg-white rounded-xl border border-blue-100 p-5 mb-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">Nuevo usuario</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Nombre completo</label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ej: María López"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Email</label>
                            <input
                                type="email"
                                value={form.email}
                                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="maria@pension.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Contraseña</label>
                            <input
                                type="password"
                                value={form.password}
                                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Mínimo 6 caracteres"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Rol</label>
                            <div className="flex gap-2">
                                {ROLES.map(r => (
                                    <button
                                        key={r.value}
                                        onClick={() => setForm(f => ({ ...f, role: r.value }))}
                                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors border ${form.role === r.value
                                            ? r.color + ' border-current'
                                            : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                            }`}
                                    >
                                        {r.icon} {r.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                        <button
                            onClick={handleCreate}
                            disabled={saving || !form.name || !form.email || !form.password}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            {saving ? 'Creando...' : 'Crear usuario'}
                        </button>
                        <button
                            onClick={() => { setShowForm(false); setError(null) }}
                            className="px-4 py-2 rounded-lg text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Lista de usuarios */}
            {loading ? (
                <div className="space-y-2">
                    {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50">
                                <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Usuario</th>
                                <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Rol actual</th>
                                <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Cambiar rol</th>
                                <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">Desde</th>
                                <th className="px-5 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => {
                                const roleCfg = ROLES.find(r => r.value === user.role)!
                                return (
                                    <tr key={user.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600">
                                                    {user.name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-sm font-medium text-gray-900">{user.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${roleCfg.color}`}>
                                                {roleCfg.icon} {roleCfg.label}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex gap-1.5">
                                                {ROLES.filter(r => r.value !== user.role).map(r => (
                                                    <button
                                                        key={r.value}
                                                        onClick={() => changeRole(user.id, r.value)}
                                                        disabled={updating === user.id}
                                                        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-40 ${r.color}`}
                                                    >
                                                        {updating === user.id ? '...' : `→ ${r.label}`}
                                                    </button>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-xs text-gray-400">
                                            {new Date(user.created_at).toLocaleDateString('es-BO', {
                                                day: 'numeric', month: 'short', year: 'numeric'
                                            })}
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <button
                                                onClick={() => deleteUser(user)}
                                                disabled={deleting === user.id || user.role === 'admin'}
                                                className="text-gray-300 hover:text-red-400 disabled:opacity-20 transition-colors text-lg"
                                                title={user.role === 'admin' ? 'No se puede eliminar al admin' : 'Eliminar usuario'}
                                            >
                                                ×
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    {users.length === 0 && (
                        <div className="text-center py-12 text-gray-400 text-sm">No hay usuarios registrados</div>
                    )}
                </div>
            )}
        </div>
    )
}