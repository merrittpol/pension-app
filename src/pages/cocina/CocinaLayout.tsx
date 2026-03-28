import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export function CocinaLayout() {
    const { profile, signOut } = useAuth()
    const navigate = useNavigate()

    async function handleSignOut() {
        await signOut()
        navigate('/login')
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Header */}
            <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-lg">
                        👨‍🍳
                    </div>
                    <div>
                        <h1 className="text-sm font-semibold text-white">Panel Cocina</h1>
                        <p className="text-xs text-gray-400">{profile?.name}</p>
                    </div>
                </div>
                <button
                    onClick={handleSignOut}
                    className="text-xs text-gray-400 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800"
                >
                    🚪 Salir
                </button>
            </header>
            <main className="p-6">
                <Outlet />
            </main>
        </div>
    )
}