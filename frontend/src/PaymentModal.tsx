import React, { useState } from 'react';

interface PaymentModalProps {
  userEmail: string;
  onClose: () => void;
}

export function PaymentModal({ userEmail, onClose }: PaymentModalProps) {
  const [method, setMethod] = useState<'Western Union' | 'BTC'>('Western Union');
  const [senderName, setSenderName] = useState('');
  const [senderCountry, setSenderCountry] = useState('');
  const [mtcn, setMtcn] = useState('');
  const [txHash, setTxHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  // Replace with your actual BTC deposit address from Binance
  const btcDepositAddress = 'bc1phtw0vpp9g3a736fhj9g0xk9p52f94nwcun8k52wreptud6e247wq36tghq';

  const handleCopyAddress = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const payload = {
      user_email: userEmail,
      plan_name: 'Pro Subscription',
      payment_method: method,
      sender_full_name: method === 'Western Union' ? senderName : undefined,
      sender_country: method === 'Western Union' ? senderCountry : undefined,
      mtcn: method === 'Western Union' ? mtcn.replace(/\s+/g, '') : undefined,
      tx_hash: method === 'BTC' ? txHash.trim() : undefined,
    };

    try {
      const response = await fetch('http://localhost:8000/api/auth/submit-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage('Payment details submitted successfully! Your account will be upgraded upon verification.');
        setTimeout(() => onClose(), 2500);
      } else {
        setMessage(data.detail || 'Failed to submit payment proof.');
      }
    } catch (err) {
      setMessage('Error connecting to backend server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: '#0f172a' }}>Upgrade to Pro ($29/mo)</h3>
          <button onClick={onClose} style={closeButtonStyle}>✕</button>
        </div>

        {/* Method Switcher Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <button
            type="button"
            onClick={() => setMethod('Western Union')}
            style={method === 'Western Union' ? activeTabStyle : inactiveTabStyle}
          >
            Western Union
          </button>
          <button
            type="button"
            onClick={() => setMethod('BTC')}
            style={method === 'BTC' ? activeTabStyle : inactiveTabStyle}
          >
            Bitcoin (BTC)
          </button>
        </div>

        {message && (
          <div style={{ padding: '10px', borderRadius: '6px', backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '14px', marginBottom: '16px' }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {method === 'Western Union' ? (
            <>
              <div style={instructionsStyle}>
                <strong>Western Union Instructions:</strong><br />
                Send payment to: <em>Aung Khine</em> (Yangon, Myanmar).<br />
                Enter your details and 10-digit MTCN below:
              </div>
              <input
                type="text"
                placeholder="Sender Full Name"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                required
                style={inputStyle}
              />
              <input
                type="text"
                placeholder="Sender Country"
                value={senderCountry}
                onChange={(e) => setSenderCountry(e.target.value)}
                required
                style={inputStyle}
              />
              <input
                type="text"
                placeholder="MTCN Number (10 digits)"
                value={mtcn}
                maxLength={10}
                pattern="[0-9]{10}"
                title="MTCN must be a 10-digit number"
                onChange={(e) => setMtcn(e.target.value)}
                required
                style={inputStyle}
              />
            </>
          ) : (
            <>
              <div style={instructionsStyle}>
                <strong>Bitcoin Transfer Instructions:</strong><br />
                Send BTC (Bitcoin Network) to deposit address:<br />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                  <code style={{ fontSize: '11px', wordBreak: 'break-all', background: '#e2e8f0', padding: '4px 6px', borderRadius: '4px' }}>
                    {btcDepositAddress}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopyAddress(btcDepositAddress)}
                    style={copyButtonStyle}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <input
                type="text"
                placeholder="Bitcoin Transaction Hash (TxID)"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                required
                style={inputStyle}
              />
            </>
          )}

          <button type="submit" disabled={loading} style={submitButtonStyle}>
            {loading ? 'Submitting...' : 'Submit Payment Proof'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Inline Styles
const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  padding: '24px',
  borderRadius: '12px',
  width: '100%',
  maxWidth: '450px',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  marginBottom: '12px',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  boxSizing: 'border-box',
};

const activeTabStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px',
  border: 'none',
  borderRadius: '6px',
  backgroundColor: '#0284c7',
  color: '#fff',
  fontWeight: 'bold',
  cursor: 'pointer',
};

const inactiveTabStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  backgroundColor: '#f8fafc',
  color: '#64748b',
  cursor: 'pointer',
};

const instructionsStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#334155',
  backgroundColor: '#f1f5f9',
  padding: '10px',
  borderRadius: '6px',
  marginBottom: '14px',
};

const submitButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  backgroundColor: '#16a34a',
  color: '#ffffff',
  border: 'none',
  borderRadius: '6px',
  fontWeight: 'bold',
  cursor: 'pointer',
  marginTop: '8px',
};

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '18px',
  cursor: 'pointer',
  color: '#64748b',
};

const copyButtonStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: '11px',
  backgroundColor: '#0284c7',
  color: '#ffffff',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

export default PaymentModal;