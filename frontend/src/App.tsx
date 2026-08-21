import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AdminPayments from './AdminPayments';
import { LasUploader } from './LasUploader';
import AuthModal, { type UserSession } from './AuthModal';
import { PaymentModal } from './PaymentModal';

function MainDashboard() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  // Helper function to sync fresh state with backend & localStorage
  const refreshUserSession = async (currentEmail: string, passwordHash?: string) => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentEmail.trim().toLowerCase(), password: passwordHash || 'dummy' }),
      });

      if (response.ok) {
        const freshData = await response.json();
        
        // Ensure integer 1 / 0 from SQLite parses accurately to boolean true / false
        const isPaidUser = freshData.is_paid === true || freshData.is_paid === 1 || Boolean(freshData.is_paid);
        const hasAccessUser = freshData.has_access === true || freshData.has_access === 1 || Boolean(freshData.has_access);

        const updatedSession: UserSession = {
          user_email: freshData.user_email || currentEmail,
          is_paid: isPaidUser,
          has_access: hasAccessUser,
          trial_days_remaining: freshData.trial_days_remaining ?? 0,
        };
        
        setUser(updatedSession);
        localStorage.setItem('user_session', JSON.stringify(updatedSession));
      }
    } catch (error) {
      console.error('Failed to sync user status from server:', error);
    }
  };

  useEffect(() => {
    const savedSession = localStorage.getItem('user_session');
    if (savedSession) {
      try {
        const parsedUser: UserSession = JSON.parse(savedSession);
        setUser(parsedUser);
        
        // Fetch latest status from backend to catch background database changes
        if (parsedUser?.user_email) {
          refreshUserSession(parsedUser.user_email);
        }
      } catch {
        localStorage.removeItem('user_session');
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user_session');
    setUser(null);
  };

  // Determine if user has pro status (supports boolean true or numeric 1)
  const isPro = user ? (user.is_paid === true || (user.is_paid as unknown) === 1) : false;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'sans-serif' }}>
      {/* Navigation Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', backgroundColor: '#0f172a', color: '#ffffff' }}>
        <h1 style={{ fontSize: '20px', margin: 0, fontWeight: 'bold' }}>AKZ Petroleum Engineering Forum</h1>
        <div>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Account Status Badge */}
              {isPro ? (
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
              {!isPro && (
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
        onAuthSuccess={(session) => {
          setUser(session);
          localStorage.setItem('user_session', JSON.stringify(session));
        }}
      />

      {/* Payment Modal */}
      {isPaymentOpen && user && (
        <PaymentModal
          userEmail={user.user_email}
          onClose={() => {
            setIsPaymentOpen(false);
            // Re-check payment status when closing payment modal
            refreshUserSession(user.user_email);
          }}
        />
      )}
    </div>
  );
}

// Router Setup
export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainDashboard />} />
        <Route path="/admin" element={<AdminPayments />} />
      </Routes>
    </Router>
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
  backgroundColor: '#15803d',
  color: '#ffffff',
  border: '1px solid #22c55e',
  padding: '4px 10px',
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