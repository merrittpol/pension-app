import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const NAV = [
    { to: '/mesero', label: 'Mesas', icon: '🪑', end: true },
    { to: '/mesero/pedidos', label: 'Pedidos', icon: '🧾' },
]

export function MeseroLayout() {
    const { profile, signOut } = useAuth()
    const navigate = useNavigate()

    async function handleSignOut() {
        await signOut()
        navigate('/login')
    }

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            <aside className="w-56 bg-white border-r border-gray-100 flex flex-col">
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
                            className={({ isActive }) =>
                                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${isActive
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
                        className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                        <span>🚪</span> Cerrar sesión
                    </button>
                </div>
            </aside>
            <main className="flex-1 overflow-auto">
                <Outlet />
            </main>
        </div>
    )
}