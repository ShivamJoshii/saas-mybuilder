import React from "react";
import '../index.css';

export default function AppointmentDetailsModal({ appointment, onClose }) {
  if (!appointment) return null;

  const {
    patient_name,
    doctor_name,
    appointment_time,
    status,
    call_duration,
    detailed_summary,
    transcript,
    call_recording_url,
    disconnection_reason,
  } = appointment;

  const getStatusStyle = () => {
    if (status === "completed") {
      return { background: 'var(--accent)', color: 'var(--accent-foreground)' };
    } else if (status === "not_connected") {
      return { background: 'var(--destructive)', color: 'var(--destructive-foreground)' };
    } else {
      return { background: 'var(--muted)', color: 'var(--muted-foreground)' };
    }
  };

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
        maxWidth: '42rem',
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
            Appointment Details
          </h2>
          <button
            onClick={onClose}
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

        {/* Top Info */}
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ marginBottom: '0.5rem', color: 'var(--foreground)' }}>
            <span style={{ fontWeight: '600' }}>Patient:</span> {patient_name || 'N/A'}
          </p>
          <p style={{ marginBottom: '0.5rem', color: 'var(--foreground)' }}>
            <span style={{ fontWeight: '600' }}>Doctor:</span> {doctor_name || 'N/A'}
          </p>
          <p style={{ marginBottom: '0.5rem', color: 'var(--foreground)' }}>
            <span style={{ fontWeight: '600' }}>Time:</span> {appointment_time || 'N/A'}
          </p>

          <p style={{ marginBottom: '0.5rem', color: 'var(--foreground)' }}>
            <span style={{ fontWeight: '600' }}>Status:</span>{" "}
            <span style={{
              padding: '0.25rem 0.5rem',
              borderRadius: 'var(--radius)',
              fontSize: '0.875rem',
              ...getStatusStyle()
            }}>
              {status || 'pending'}
            </span>
          </p>

          {call_duration !== null && (
            <p style={{ marginBottom: '0.5rem', color: 'var(--foreground)' }}>
              <span style={{ fontWeight: '600' }}>Call Duration:</span> {call_duration} seconds
            </p>
          )}

          {disconnection_reason && (
            <p style={{ marginBottom: '0.5rem', color: 'var(--foreground)' }}>
              <span style={{ fontWeight: '600' }}>Disconnection Reason:</span> {disconnection_reason}
            </p>
          )}
        </div>

        {/* Recording */}
        {call_recording_url && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{
              fontWeight: '600',
              marginBottom: '0.5rem',
              color: 'var(--foreground)'
            }}>
              Call Recording
            </h3>
            <audio
              controls
              src={call_recording_url}
              style={{ width: '100%' }}
            >
              Your browser does not support the audio element.
            </audio>
          </div>
        )}

        {/* Summary */}
        {detailed_summary && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{
              fontWeight: '600',
              marginBottom: '0.5rem',
              color: 'var(--foreground)'
            }}>
              Summary
            </h3>
            <div style={{
              background: 'var(--muted)',
              padding: '1rem',
              borderRadius: 'var(--radius)',
              whiteSpace: 'pre-line',
              fontSize: '0.875rem',
              lineHeight: '1.75',
              border: '1px solid var(--border)',
              color: 'var(--foreground)'
            }}>
              {detailed_summary}
            </div>
          </div>
        )}

        {/* Transcript */}
        {transcript && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{
              fontWeight: '600',
              marginBottom: '0.5rem',
              color: 'var(--foreground)'
            }}>
              Transcript
            </h3>
            <div style={{
              background: 'var(--muted)',
              padding: '1rem',
              borderRadius: 'var(--radius)',
              whiteSpace: 'pre-line',
              fontSize: '0.875rem',
              lineHeight: '1.75',
              border: '1px solid var(--border)',
              maxHeight: '16rem',
              overflowY: 'auto',
              color: 'var(--foreground)'
            }}>
              {transcript}
            </div>
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="button"
          style={{
            width: '100%',
            marginTop: '1rem'
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

