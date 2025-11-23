import React from "react";
import '../index.css';

export default function MergeModal({ rows, onSave, onCancel }) {
  if (!rows || !rows.length) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      padding: '1rem'
    }}>
      <div style={{
        background: 'var(--card)',
        width: '100%',
        maxWidth: '800px',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-2xl)',
        padding: '1.5rem',
        overflowY: 'auto',
        maxHeight: '90vh',
        color: 'var(--card-foreground)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem'
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            color: 'var(--foreground)'
          }}>
            Review & Merge Appointments
          </h2>
          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              color: 'var(--muted-foreground)',
              cursor: 'pointer',
              padding: '0.25rem',
              lineHeight: 1
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--foreground)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted-foreground)'}
          >
            ✕
          </button>
        </div>

        {/* Preview Table */}
        <div style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          overflowX: 'auto',
          marginBottom: '1.5rem',
          maxHeight: '400px',
          overflowY: 'auto'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: 'var(--font-sans)',
            fontSize: '0.875rem'
          }}>
            <thead>
              <tr style={{
                background: 'var(--muted)',
                borderBottom: '1px solid var(--border)',
                position: 'sticky',
                top: 0
              }}>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>
                  Name
                </th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>
                  Phone
                </th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>
                  Time
                </th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600' }}>
                  Doctor
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem' }}>
                    {r.name || r.patient_name || '—'}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {r.phone || '—'}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {r.appointment_time || r.time || '—'}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {r.doctor || r.doctor_name || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem'
        }}>
          <button
            onClick={onCancel}
            className="button"
            style={{
              background: 'var(--secondary)',
              color: 'var(--secondary-foreground)'
            }}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="button"
          >
            Confirm & Save
          </button>
        </div>
      </div>
    </div>
  );
}

