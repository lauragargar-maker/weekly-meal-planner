import React from 'react'
import ReactDOM from 'react-dom/client'
import AuthProvider from './components/AuthProvider.tsx'
import AuthGate from './components/AuthGate.tsx'
import { initAnalytics } from './lib/analytics'
import './index.css'

initAnalytics()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  </React.StrictMode>,
)
