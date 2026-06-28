import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Lock, Mail, RefreshCw } from 'lucide-react';
import { login } from '../api/client';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await login({ email, password });
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/documents');
      window.location.reload(); // Refresh to rebuild layout sidebar with role checks
    } catch (err) {
      setError(err.detail || 'Incorrect email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 select-none">
      <div className="max-w-md w-full bg-surface-card border border-surface-border rounded-lg shadow-2xl p-8 space-y-6">
        
        {/* Logo and title */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-accent-blue/10 border border-accent-blue/20 rounded-full text-accent-blue mb-2">
            <Database className="w-8 h-8 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">
            AIKI Operations Brain
          </h2>
          <p className="text-xs text-text-secondary">
            Sign in to access industrial procedures, safety audits, and RAG copilot.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-accent-red/10 border border-accent-red/20 text-accent-red text-xs p-3.5 rounded-md leading-relaxed">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-mono tracking-wider text-text-muted font-bold block">
              Email Address
            </label>
            <div className="relative bg-[#161B22] border border-surface-border rounded-md px-3 py-2 flex items-center">
              <Mail className="w-4 h-4 text-text-muted mr-2.5 flex-shrink-0" />
              <input
                type="email"
                required
                placeholder="engineer@plant.ai"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-transparent border-none w-full text-sm text-text-primary placeholder-text-muted focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-mono tracking-wider text-text-muted font-bold block">
              Password
            </label>
            <div className="relative bg-[#161B22] border border-surface-border rounded-md px-3 py-2 flex items-center">
              <Lock className="w-4 h-4 text-text-muted mr-2.5 flex-shrink-0" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-transparent border-none w-full text-sm text-text-primary placeholder-text-muted focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2F81F7] hover:bg-[#2467D9] disabled:bg-[#2F81F7]/50 text-white font-semibold py-2.5 px-4 rounded-md transition-colors text-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Authenticating...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Demo Credentials Helper */}
        <div className="border-t border-surface-border pt-4 text-center select-text">
          <p className="text-[10px] font-mono text-text-muted">
            Demo Credentials:<br />
            Email: <strong className="text-text-secondary">admin@aiki.ai</strong> / PW: <strong className="text-text-secondary">adminpassword</strong>
          </p>
        </div>
        
      </div>
    </div>
  );
}

export default Login;
