import { Routes, Route } from 'react-router-dom'
import HomePage from './features/home/components/HomePage'
import CreateGroupPage from './features/groups/components/CreateGroupPage'
import RecommendationsPage from './features/recommendations/components/RecommendationsPage'
import './App.css'
import { Layout } from './components/layout/Layout'

function App() {
  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/create-group" element={<CreateGroupPage />} />
          <Route
            path="/recommendations/:accessCode"
            element={<RecommendationsPage />}
          />
        </Route>
      </Routes>
    </>
  );
}

export default App;
