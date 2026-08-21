import React, { useState } from 'react';

const API_BASE_URL = 'http://localhost:8000';

export default function AdminPayments() {
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch payments list from FastAPI backend
  const fetchPayments = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/payments?admin_secret_key=${encodeURIComponent(adminKey)}`
      );
      if (!response.ok) {
        throw new Error('Invalid admin key or failed to fetch data.');
      }
      const data = await response.json();
      setPayments(data);
      setIsAuthenticated(true);
    } catch (err) {
      setError(err.message || 'Something went wrong');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  // Update status (Approve or Reject)
  const handleStatusChange = async (paymentId, newStatus) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/payments/${paymentId}/status?admin_secret_key=${encodeURIComponent(adminKey)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      // Refresh table after updating
      fetchPayments();
    } catch (err) {
      alert(err.message || 'Failed to update payment status');
    }
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    fetchPayments();
  };

  if (!isAuthenticated) {
    return (
      <div style={{ padding: '40px', maxWidth: '400px', margin: '0 auto' }}>
        <h2>Admin Authentication</h2>
        <form onSubmit={handleLoginSubmit}>
          <input
            type="password"
            placeholder="Enter Admin Secret Key"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
            required
          />
          <button type="submit" style={{ padding: '8px 16px', cursor: 'pointer' }}>
            Access Dashboard
          </button>
        </form>
        {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <h2>Western Union Payment Submissions</h2>
      <button onClick={fetchPayments} style={{ marginBottom: '15px', padding: '6px 12px', cursor: 'pointer' }}>
        Refresh Table
      </button>

      {loading ? (
        <p>Loading payments...</p>
      ) : (
        <table border="1" cellPadding="8" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f2f2f2' }}>
              <th>ID</th>
              <th>User Email</th>
              <th>MTCN Number</th>
              <th>Sender Name</th>
              <th>Country</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center' }}>
                  No payment submissions found.
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{p.user_email}</td>
                  <td><strong>{p.mtcn || 'N/A'}</strong></td>
                  <td>{p.sender_full_name || 'N/A'}</td>
                  <td>{p.sender_country || 'N/A'}</td>
                  <td>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        backgroundColor:
                          p.status?.toLowerCase() === 'approved'
                            ? '#dcfce7'
                            : p.status?.toLowerCase() === 'rejected'
                            ? '#fee2e2'
                            : '#fef3c7',
                        color:
                          p.status?.toLowerCase() === 'approved'
                            ? '#15803d'
                            : p.status?.toLowerCase() === 'rejected'
                            ? '#b91c1c'
                            : '#b45309',
                      }}
                    >
                      {p.status?.toUpperCase() || 'PENDING'}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => handleStatusChange(p.id, 'approved')}
                      style={{
                        backgroundColor: '#16a34a',
                        color: '#fff',
                        border: 'none',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        marginRight: '6px',
                      }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleStatusChange(p.id, 'rejected')}
                      style={{
                        backgroundColor: '#dc2626',
                        color: '#fff',
                        border: 'none',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}