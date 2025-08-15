import React, { useState } from 'react';
import { hybridCloudService, UnifiedAuthState } from '../services/hybridCloudService';

interface LoginProps {
  onAuthChange: (authState: UnifiedAuthState) => void;
}

export const Login: React.FC<LoginProps> = ({ onAuthChange }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    companyName: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let authState: UnifiedAuthState;
      
      if (isLogin) {
        authState = await hybridCloudService.login(formData.email, formData.password);
      } else {
        authState = await hybridCloudService.register(formData.email, formData.password, formData.companyName);
      }

      // Initialize cloud sync after successful auth
      await hybridCloudService.initializeSync();
      
      onAuthChange(authState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-20 w-20 flex items-center justify-center">
            <img 
              src="/49a17683-5076-4438-802b-1f127b406df3 copy.JPG" 
              alt="Bhavishya Road Carrier Logo" 
              className="h-20 w-20 object-contain rounded-lg shadow-lg"
              onError={(e) => {
                // Fallback to icon if image fails to load
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="hidden mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Bhavishya Road Carrier
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {isLogin ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className={`appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 ${!isLogin ? '' : 'rounded-b-md'} focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm`}
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
              />
            </div>
            {!isLogin && (
              <div>
                <label htmlFor="companyName" className="sr-only">Company Name</label>
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Company Name"
                  value={formData.companyName}
                  onChange={handleChange}
                />
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              className="text-blue-600 hover:text-blue-500 text-sm"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </form>

        <div className="mt-6 border-t border-gray-200 pt-6">
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">📧 Quick Setup:</h3>
            <div className="space-y-2 text-sm text-blue-700">
              <div><strong>Step 1:</strong> Click "Create Account" below</div>
              <div><strong>Step 2:</strong> Use your email & any password</div>
              <div><strong>Step 3:</strong> Login from any device with same credentials</div>
              <button
                type="button"
                onClick={() => {
                  setFormData({
                    email: 'balankaswan14@gmail.com',
                    password: 'demo123',
                    companyName: 'Bhavishya Road Carriers'
                  });
                  setIsLogin(false);
                }}
                className="mt-2 px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
              >
                Create Account with Demo Email
              </button>
            </div>
          </div>
        </div>
        <div className="mt-6 border-t border-gray-200 pt-6">
          <div className="text-sm text-gray-600">
            <h3 className="font-medium text-gray-900 mb-2">Cloud Sync Features:</h3>
            <ul className="space-y-1 text-xs">
              <li>• Access your data from any device</li>
              <li>• Automatic synchronization every 30 seconds</li>
              <li>• Secure cloud storage</li>
              <li>• Real-time updates across devices</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
