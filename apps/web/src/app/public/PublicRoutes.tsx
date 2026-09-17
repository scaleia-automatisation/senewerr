import { Routes, Route } from 'react-router-dom'

// SCAFFOLD — Landing & Public
// Implémenté au Bloc 2 + blocs métier correspondants
export default function PublicRoutes() {
  return (
    <Routes>
      <Route index element={
        <div className="flex items-center justify-center min-h-screen text-gray-500">
          <p>Landing & Public — En construction (Bloc 2)</p>
        </div>
      } />
    </Routes>
  )
}
