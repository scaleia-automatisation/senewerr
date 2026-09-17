import { Routes, Route } from 'react-router-dom'

// SCAFFOLD — Espace Admin
// Implémenté au Bloc 2 + blocs métier correspondants
export default function AdminRoutes() {
  return (
    <Routes>
      <Route index element={
        <div className="flex items-center justify-center min-h-screen text-gray-500">
          <p>Espace Admin — En construction (Bloc 2)</p>
        </div>
      } />
    </Routes>
  )
}
