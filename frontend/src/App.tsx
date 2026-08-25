import { Routes, Route } from 'react-router-dom'
import HomePage from './features/home/components/HomePage'
import CreateGroupPage from './features/groups/components/CreateGroupPage'
import RecommendationsPage from './features/recommendations/components/RecommendationsPage'
import './App.css'

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create-group" element={<CreateGroupPage />} />
        <Route path="/recommendations/:accessCode" element={<RecommendationsPage />} />
      </Routes>
    </>
  )
}

export default App
