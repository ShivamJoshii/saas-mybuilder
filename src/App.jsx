import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './Login';
import RequestAccess from './RequestAccess';
import Dashboard from './Dashboard';
import SetupPassword from './SetupPassword';
import Admin from './Admin';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/request-access" element={<RequestAccess />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/setup-password" element={<SetupPassword />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

