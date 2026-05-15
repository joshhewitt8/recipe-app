import { BrowserRouter, Routes, Route } from 'react-router-dom'
import RecipeList from './pages/RecipeList'
import RecipeDetail from './pages/RecipeDetail'
import RecipeForm from './pages/RecipeForm'
import DesignPage from './pages/DesignPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RecipeList />} />
        <Route path="/design" element={<DesignPage />} />
        <Route path="/new" element={<RecipeForm />} />
        <Route path="/recipes/:id" element={<RecipeDetail />} />
        <Route path="/recipes/:id/edit" element={<RecipeForm />} />
      </Routes>
    </BrowserRouter>
  )
}
