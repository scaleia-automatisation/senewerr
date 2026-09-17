import { Routes, Route } from 'react-router-dom'

// SCAFFOLD — Super Admin
// Implémenté au Bloc 2 + blocs métier correspondants
export default function SuperadminRoutes() {
  return (
    <Routes>
      <Route index element={
        <div className="flex items-center justify-center min-h-screen text-gray-500">
          <p>Super Admin — En construction (Bloc 2)</p>
        </div>
      } />
    </Routes>
  )
}
