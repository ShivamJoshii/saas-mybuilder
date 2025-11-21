import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import './index.css';

export default function RequestAccess() {
  const [form, setForm] = useState({
    clinic_name: '',
    contact_name: '',
    email: '',
    phone: '',
    has_emr: 'no',
    emr_name: '',
    integration_type: 'manual',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setMessageType('');

    const { error } = await supabase.from('onboard_requests').insert({
      clinic_name: form.clinic_name,
      contact_name: form.contact_name,
      email: form.email,
      phone: form.phone,
      has_emr: form.has_emr === 'yes',
      emr_name: form.has_emr === 'yes' ? form.emr_name : null,
      integration_type: form.integration_type,
    });

    setLoading(false);

    if (error) {
      console.error(error);
      setMessage('Something went wrong. Please try again.');
      setMessageType('error');
    } else {
      setMessage('Request submitted. We will approve your access shortly.');
      setMessageType('success');
      // Clear form
      setForm({
        clinic_name: '',
        contact_name: '',
        email: '',
        phone: '',
        has_emr: 'no',
        emr_name: '',
        integration_type: 'manual',
      });
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '2rem',
      background: 'var(--background)'
    }}>
      <div className="card" style={{ maxWidth: '480px', width: '100%' }}>
        <h1 style={{ 
          fontSize: '1.875rem', 
          fontWeight: '600', 
          marginBottom: '0.5rem',
          color: 'var(--foreground)'
        }}>
          Request Access
        </h1>
        <p style={{ 
          color: 'var(--muted-foreground)', 
          marginBottom: '2rem',
          fontSize: '0.875rem'
        }}>
          Tell us about your clinic and we'll set up your account.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label">
              Clinic Name
            </label>
            <input
              className="input"
              name="clinic_name"
              value={form.clinic_name}
              onChange={handleChange}
              placeholder="Enter your clinic name"
              required
            />
          </div>

          <div className="form-group">
            <label className="label">
              Your Name
            </label>
            <input
              className="input"
              name="contact_name"
              value={form.contact_name}
              onChange={handleChange}
              placeholder="Enter your name"
              required
            />
          </div>

          <div className="form-group">
            <label className="label">
              Email
            </label>
            <input
              className="input"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="form-group">
            <label className="label">
              Phone
            </label>
            <input
              className="input"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              placeholder="Enter your phone number"
            />
          </div>

          <div className="form-group">
            <label className="label">
              Do you use an EMR?
            </label>
            <select 
              className="select"
              name="has_emr" 
              value={form.has_emr} 
              onChange={handleChange}
            >
              <option value="no">No / Not sure</option>
              <option value="yes">Yes</option>
            </select>
          </div>

          {form.has_emr === 'yes' && (
            <div className="form-group">
              <label className="label">
                EMR Name
              </label>
              <input
                className="input"
                name="emr_name"
                value={form.emr_name}
                onChange={handleChange}
                placeholder="Enter your EMR system name"
              />
            </div>
          )}

          <div className="form-group">
            <label className="label">
              Integration Type
            </label>
            <select
              className="select"
              name="integration_type"
              value={form.integration_type}
              onChange={handleChange}
            >
              <option value="manual">Manual (CSV Upload)</option>
              <option value="emr">EMR Integration</option>
            </select>
          </div>

          <button 
            type="submit" 
            className="button"
            disabled={loading}
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            {loading ? 'Submitting...' : 'Request Access'}
          </button>
        </form>

        {message && (
          <div className={`message ${messageType}`} style={{ marginTop: '1rem' }}>
            {message}
          </div>
        )}

        <p style={{ 
          marginTop: '1.5rem', 
          textAlign: 'center',
          fontSize: '0.875rem',
          color: 'var(--muted-foreground)'
        }}>
          Already have an account?{' '}
          <Link to="/login" className="link">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}

