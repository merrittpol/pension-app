import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const NAV = [
    { to: '/admin', label: 'Inicio', icon: '🏠', end: true },
    { to: '/admin/mesas', label: 'Mesas', icon: '🪑' },
    { to: '/admin/menu', label: 'Menú', icon: '📋' },
    { to: '/admin/pedidos', label: 'Pedidos', icon: '🧾' },
    { to: '/admin/reportes', label: 'Reportes', icon: '📊' },
    { to: '/admin/usuarios', label: 'Usuarios', icon: '👥' },
    { to: '/admin/finanzas', label: 'Finanzas', icon: '💰' },
]

export function AdminLayout() {
    const { profile, signOut } = useAuth()
    const navigate = useNavigate()
    const [signingOut, setSigningOut] = useState(false)

    async function handleSignOut() {
        setSigningOut(true)
        await signOut()
        navigate('/login')
    }

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {/* Sidebar */}
            <aside className="w-56 bg-white border-r border-gray-100 flex flex-col">
                <div className="px-5 py-5 border-b border-gray-100">
                    <h1 className="text-base font-semibold text-gray-900">AppPensión</h1>
                    <p className="text-xs text-gray-400 mt-0.5">{profile?.name}</p>
                </div>

                <nav className="flex-1 px-3 py-4 space-y-0.5">
                    {NAV.map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            className={({ isActive }) =>
                                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${isActive
                                    ? 'bg-blue-50 text-blue-700 font-medium'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`
                            }
                        >
                            <span className="text-base">{item.icon}</span>
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="px-3 py-4 border-t border-gray-100">
                    <button
                        onClick={handleSignOut}
                        disabled={signingOut}
                        className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                        <span>🚪</span>
                        {signingOut ? 'Saliendo...' : 'Cerrar sesión'}
                    </button>
                </div>
            </aside>

            {/* Contenido */}
            <main className="flex-1 overflow-auto">
                <Outlet />
            </main>
        </div>
    )
}