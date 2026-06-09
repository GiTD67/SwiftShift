import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/inter/index.css'
import App from './App.tsx'
import './index.css'
import './animated-bg.css'
import 'boxicons/css/boxicons.min.css'
import { Toaster } from 'sonner'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Toaster position="top-center" theme="dark" closeButton />
  </React.StrictMode>,
)
