import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import { Toaster } from 'sonner'
import App from './app/App'
import { AuthProvider } from './features/auth/AuthContext'
import { ThemeProvider } from './lib/theme'
import './lib/i18n'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: (failureCount, error: unknown) => {
        const status = (error as { status?: number })?.status
        if (status === 401 || status === 403 || status === 404) return false
        return failureCount < 2
      },
    },
    mutations: {
      retry: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
    <HelmetProvider>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
        <Toaster
          richColors
          position="top-center"
          toastOptions={{
            style: {
              background: 'var(--surface)',
              color: 'var(--ink)',
              border: '1px solid var(--line)',
              borderRadius: '12px',
            },
          }}
        />
      </QueryClientProvider>
    </BrowserRouter>
    </HelmetProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
