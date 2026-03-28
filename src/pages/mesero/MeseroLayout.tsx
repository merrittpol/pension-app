import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const NAV = [
    { to: '/mesero', label: 'Mesas', icon: '🪑', end: true },
    { to: '/mesero/pedidos', label: 'Pedidos', icon: '🧾' },
]

export function MeseroLayout() {
    const { profile, signOut } = useAuth()
    const navigate = useNavigate()
    const [menuOpen, setMenuOpen] = useState(false)

    async function handleSignOut() {
        await signOut()
        navigate('/login')
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header móvil */}
            <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between lg:hidden sticky top-0 z-40">
                <div>
                    <h1 className="text-sm font-semibold text-gray-900">AppPensión</h1>
                    <p className="text-xs text-gray-400">{profile?.name}</p>
                </div>
                <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-gray-100"
                >
                    <span className={`w-5 h-0.5 bg-gray-600 transition-all ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
                    <span className={`w-5 h-0.5 bg-gray-600 transition-all ${menuOpen ? 'opacity-0' : ''}`} />
                    <span className={`w-5 h-0.5 bg-gray-600 transition-all ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
                </button>
            </header>

            {/* Overlay */}
            {menuOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-40 lg:hidden"
                    onClick={() => setMenuOpen(false)}
                />
            )}

            <div className="flex">
                {/* Sidebar */}
                <aside className={`
          fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-100 flex flex-col z-50 transition-transform duration-300
          lg:sticky lg:top-0 lg:w-56 lg:translate-x-0 lg:h-screen
          ${menuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
                    <div className="px-5 py-5 border-b border-gray-100">
                        <h1 className="text-base font-semibold text-gray-900">AppPensión</h1>
                        <p className="text-xs text-gray-400 mt-0.5">{profile?.name}</p>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mt-1 inline-block">Mesero</span>
                    </div>

                    <nav className="flex-1 px-3 py-4 space-y-0.5">
                        {NAV.map(item => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.end}
                                onClick={() => setMenuOpen(false)}
                                className={({ isActive }) =>
                                    `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive
                                        ? 'bg-blue-50 text-blue-700 font-medium'
                                        : 'text-gray-600 hover:bg-gray-50'
                                    }`
                                }
                            >
                                <span>{item.icon}</span>
                                {item.label}
                            </NavLink>
                        ))}
                    </nav>

                    <div className="px-3 py-4 border-t border-gray-100">
                        <button
                            onClick={handleSignOut}
                            className="flex items-center gap-2.5 px-3 py-2.5 w-full rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                            <span>🚪</span> Cerrar sesión
                        </button>
                    </div>
                </aside>

                <main className="flex-1 overflow-auto w-full">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}