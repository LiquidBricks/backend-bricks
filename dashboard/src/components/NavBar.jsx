import React from 'react'
import { NavLink } from 'react-router-dom'

export default function NavBar() {
  const activeStyle = ({ isActive }) => ({
    fontWeight: isActive ? 'bold' : 'normal'
  })
  return (
    <nav style={{ display: 'flex', gap: 12, borderBottom: '1px solid #ddd', paddingBottom: 8, marginBottom: 16 }}>
      <NavLink to="/" style={activeStyle}>Home</NavLink>
      <NavLink to="/info" style={activeStyle}>Info</NavLink>
      <NavLink to="/sessions" style={activeStyle}>Sessions</NavLink>
    </nav>
  )
}
