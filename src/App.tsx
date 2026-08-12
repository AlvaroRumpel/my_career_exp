import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { CareerProvider, useCareer } from './ui/CareerContext'
import Layout from './ui/Layout'
import CreatePlayer from './ui/CreatePlayer'
import Dashboard from './ui/Dashboard'
import PreGame from './ui/PreGame'
import PostGame from './ui/PostGame'
import History from './ui/History'

function Guard({ children }: { children: React.ReactNode }) {
  const { career } = useCareer()
  if (!career) return <Navigate to="/new" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <CareerProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/new" element={<CreatePlayer />} />
            <Route path="/" element={<Guard><Dashboard /></Guard>} />
            <Route path="/pregame" element={<Guard><PreGame /></Guard>} />
            <Route path="/postgame" element={<Guard><PostGame /></Guard>} />
            <Route path="/history" element={<Guard><History /></Guard>} />
          </Route>
        </Routes>
      </HashRouter>
    </CareerProvider>
  )
}
