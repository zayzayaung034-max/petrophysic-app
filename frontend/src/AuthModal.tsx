import React, { useState } from 'react';

export interface UserSession {
  user_email: string;
  is_paid: boolean;
  has_access: boolean;
  trial_days_remaining: number;
}

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (session: UserSession) => void;
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const endpoint = isRegister
      ? 'http://127.0.0.1:8000/api/auth/register'
      : 'http://127.0.0.1:8000/api/auth/login';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }

      // Handle both boolean (true/false) and SQLite numeric booleans (1/0)
      const isPaidUser = data.is_paid === true || data.is_paid === 1 || Boolean(data.is_paid);

      const session: UserSession = {
        user_email: data.user_email || email,
        is_paid: isPaidUser,
        has_access: data.has_access === true || data.has_access === 1 || Boolean(data.has_access),
        trial_days_remaining: data.trial_days_remaining ?? 0,
      };

      // Persist session to local storage
      localStorage.setItem('user_session', JSON.stringify(session));

      // Update parent React state and close modal
      onAuthSuccess(session);
      onClose();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: '#0f172a' }}>
            {isRegister ? 'Create Account' : 'Sign In'}
          </h2>
          <button onClick={onClose} style={closeButtonStyle}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <button
            type="button"
            onClick={() => { setIsRegister(false); setError(null); }}
            style={{
              ...tabButtonStyle,
              border: !isRegister ? '2px solid #0284c7' : '1px solid #cbd5e1',
              backgroundColor: !isRegister ? '#f0f9ff' : '#ffffff',
              fontWeight: !isRegister ? 'bold' : 'normal',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setError(null); }}
            style={{
              ...tabButtonStyle,
              border: isRegister ? '2px solid #0284c7' : '1px solid #cbd5e1',
              backgroundColor: isRegister ? '#f0f9ff' : '#ffffff',
              fontWeight: isRegister ? 'bold' : 'normal',
            }}
          >
            Register
          </button>
        </div>

        {error && <div style={errorBannerStyle}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Email Address</label>
            <input
              type="email"
              required
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
          </div>

          <button type="submit" disabled={loading} style={submitButtonStyle}>
            {loading ? 'Processing...' : isRegister ? 'Register Account' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.65)',
  backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  padding: '28px',
  borderRadius: '10px',
  width: '100%',
  maxWidth: '400px',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
};

const tabButtonStyle: React.CSSProperties = {
  flex: 1, padding: '8px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#0f172a',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box',
};

const submitButtonStyle: React.CSSProperties = {
  marginTop: '8px', width: '100%', padding: '10px', backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '14px',
};

const closeButtonStyle: React.CSSProperties = {
  border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8',
};

const errorBannerStyle: React.CSSProperties = {
  backgroundColor: '#fef2f2', color: '#dc2626', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '12px', border: '1px solid #fecaca',
};