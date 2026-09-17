import { Routes, Route } from 'react-router-dom'

// SCAFFOLD — Espace Pharmacie
// Implémenté au Bloc 2 + blocs métier correspondants
export default function PharmacyRoutes() {
  return (
    <Routes>
      <Route index element={
        <div className="flex items-center justify-center min-h-screen text-gray-500">
          <p>Espace Pharmacie — En construction (Bloc 2)</p>
        </div>
      } />
    </Routes>
  )
}
