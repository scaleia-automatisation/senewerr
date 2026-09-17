import { Routes, Route } from 'react-router-dom'

// SCAFFOLD — Espace Mutuelle
// Implémenté au Bloc 2 + blocs métier correspondants
export default function MutualRoutes() {
  return (
    <Routes>
      <Route index element={
        <div className="flex items-center justify-center min-h-screen text-gray-500">
          <p>Espace Mutuelle — En construction (Bloc 2)</p>
        </div>
      } />
    </Routes>
  )
}
