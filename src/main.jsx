import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
// Inter, self-hosted so the first paint does not wait on a font CDN.
import '@fontsource-variable/inter'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)