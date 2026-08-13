import React, { useState, useEffect } from 'react';
import { LasUploader } from './LasUploader';
import AuthModal, { type UserSession } from './AuthModal';
import { PaymentModal } from './PaymentModal';

export default function App() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  useEffect(() => {
    const savedSession = localStorage.getItem('user_session');
    if (savedSession) {
      try {
        setUser(JSON.parse(savedSession));
      } catch {
        localStorage.removeItem('user_session');
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user_session');
    setUser(null);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'sans-serif' }}>
      {/* Navigation Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', backgroundColor: '#0f172a', color: '#ffffff' }}>
        <h1 style={{ fontSize: '20px', margin: 0, fontWeight: 'bold' }}>AKZ Petroleum Engineering Forum</h1>
        <div>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Account Status Badge */}
              {user.is_paid ? (
                <span style={proBadgeStyle}>PRO MEMBER</span>
              ) : (
                <span style={trialBadgeStyle}>
                  {user.trial_days_remaining !== undefined 
                    ? `${user.trial_days_remaining} Days Trial` 
                    : 'Free Trial'}
                </span>
              )}

              <span style={{ fontSize: '14px', color: '#cbd5e1' }}>{user.user_email}</span>

              {/* Upgrade Button */}
              {!user.is_paid && (
                <button onClick={() => setIsPaymentOpen(true)} style={upgradeButtonStyle}>
                  Upgrade to Pro
                </button>
              )}

              <button onClick={handleLogout} style={secondaryButtonStyle}>Sign Out</button>
            </div>
          ) : (
            <button onClick={() => setIsAuthOpen(true)} style={primaryButtonStyle}>
              Sign In / Register
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ maxWidth: '1000px', margin: '40px auto', padding: '0 20px' }}>
        {user ? (
          <div style={{ backgroundColor: '#ffffff', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <h2 style={{ textAlign: 'center', marginTop: 0, color: '#0f172a' }}>
              Petrophysical Log Visualizer & Interpretation Engine
            </h2>
            
            <LasUploader />
          </div>
        ) : (
          <div style={{ backgroundColor: '#ffffff', padding: '40px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <h2 style={{ marginTop: 0, color: '#1e293b' }}>Access Reservoir Log Interpretation Engine</h2>
            <p style={{ color: '#64748b', lineHeight: 1.6, maxWidth: '600px', margin: '0 auto 24px' }}>
              Please register an account or sign in to upload LAS log files, calculate Net Pay thickness, and render interactive Gamma Ray, Vsh, and Sw depth plots.
            </p>
            <button onClick={() => setIsAuthOpen(true)} style={largeButtonStyle}>
              Register / Sign In to Unlock
            </button>
          </div>
        )}
      </main>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(session) => setUser(session)}
      />

      {/* Payment Modal */}
      {isPaymentOpen && user && (
        <PaymentModal
          userEmail={user.user_email}
          onClose={() => setIsPaymentOpen(false)}
        />
      )}
    </div>
  );
}

// Inline Styles
const primaryButtonStyle: React.CSSProperties = {
  backgroundColor: '#0284c7',
  color: '#ffffff',
  border: 'none',
  padding: '8px 16px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 600,
};

const upgradeButtonStyle: React.CSSProperties = {
  backgroundColor: '#16a34a',
  color: '#ffffff',
  border: 'none',
  padding: '6px 14px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '13px',
};

const secondaryButtonStyle: React.CSSProperties = {
  backgroundColor: 'transparent',
  color: '#94a3b8',
  border: '1px solid #475569',
  padding: '6px 12px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '13px',
};

const largeButtonStyle: React.CSSProperties = {
  backgroundColor: '#0284c7',
  color: '#ffffff',
  border: 'none',
  padding: '12px 28px',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '16px',
};

const proBadgeStyle: React.CSSProperties = {
  backgroundColor: '#1e293b',
  color: '#38bdf8',
  border: '1px solid #0284c7',
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '11px',
  fontWeight: 'bold',
  letterSpacing: '0.5px',
};

const trialBadgeStyle: React.CSSProperties = {
  backgroundColor: '#334155',
  color: '#f1f5f9',
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '12px',
};