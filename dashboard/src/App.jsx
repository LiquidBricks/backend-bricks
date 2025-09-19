import React from 'react'
import { Routes, Route } from 'react-router-dom'
import NavBar from './components/NavBar.jsx'
import Home from './pages/Home.jsx'
import Info from './pages/Info.jsx'
import Sessions from './pages/Run.jsx'
import Session from './pages/Session.jsx'

export default function App() {

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 16 }}>
      <NavBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/info" element={<Info />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/session/:id" element={<Session />} />
      </Routes>
    </div>
  )
}
