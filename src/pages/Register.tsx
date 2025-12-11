import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { registerUser, loginUser } from '../services/authService';
import type { UserRole } from '../types';
import { Stethoscope } from 'lucide-react';

const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('patient');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await registerUser(username, email, password, name, role);
      // Auto login after register
      const user = await loginUser(username, password); 
      
      if (user.role === 'doctor') {
        navigate('/doctor');
      } else {
        navigate('/patient');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-100 p-3 rounded-full mb-4">
            <Stethoscope className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Create Account</h2>
          <p className="text-gray-500 text-sm mt-1">Join DentalCare Hospital</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          <Input
            label="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe"
            required
            disabled={loading}
          />

          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose a username"
            required
            disabled={loading}
          />

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="john@example.com"
            required
            disabled={loading}
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password"
            required
            disabled={loading}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRole('patient')}
                disabled={loading}
                className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                  role === 'patient' 
                    ? 'border-teal-500 bg-teal-50 text-teal-700 ring-1 ring-teal-500' 
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                Patient
              </button>
              <button
                type="button"
                onClick={() => setRole('doctor')}
                disabled={loading}
                className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                  role === 'doctor' 
                    ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500' 
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                Doctor
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full mt-2" isLoading={loading}>
            Register
          </Button>

          <div className="text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-teal-600 hover:text-teal-700 font-medium">
              Login here
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;