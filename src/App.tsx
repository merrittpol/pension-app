import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { AdminLayout } from './pages/admin/AdminLayout'
import { AdminHome } from './pages/admin/AdminHome'
import { MesasPage } from './pages/admin/MesasPage'
import { MenuPage } from './pages/admin/MenuPage'
import { PedidosPage } from './pages/admin/PedidosPage'
import { ReportesPage } from './pages/admin/ReportesPage'
import { UsuariosPage } from './pages/admin/UsuariosPage'
import { MeseroLayout } from './pages/mesero/MeseroLayout'
import { MeseroMesas } from './pages/mesero/MeseroMesas'
import { MeseroPedidos } from './pages/mesero/MeseroPedidos'
import { CocinaLayout } from './pages/cocina/CocinaLayout'
import { CocinaPanel } from './pages/cocina/CocinaPanel'
import { FinanzasPage } from './pages/admin/FinanzasPage'



function Unauthorized() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-red-600 font-medium">Sin permisos para esta sección</p>
    </div>
  )
}


export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminHome />} />
            <Route path="mesas" element={<MesasPage />} />
            <Route path="menu" element={<MenuPage />} />
            <Route path="pedidos" element={<PedidosPage />} />
            <Route path="reportes" element={<ReportesPage />} />
            <Route path="usuarios" element={<UsuariosPage />} />
            <Route path="finanzas" element={<FinanzasPage />} />
          </Route>

          <Route
            path="/mesero"
            element={
              <ProtectedRoute allowedRoles={['mesero', 'admin']}>
                <MeseroLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<MeseroMesas />} />
            <Route path="pedidos" element={<MeseroPedidos />} />
          </Route>

          <Route
            path="/cocina"
            element={
              <ProtectedRoute allowedRoles={['cocina', 'admin']}>
                <CocinaLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<CocinaPanel />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}