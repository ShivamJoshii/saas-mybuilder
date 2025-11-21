import { useEffect, useState } from "react";
import Papa from "papaparse";
import { supabase } from "./lib/supabaseClient";
import AppointmentDetailsModal from "./components/AppointmentDetailsModal";
import './index.css';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [clinic, setClinic] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("session_token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    const checkSession = async () => {
      const { data: session } = await supabase
        .from("sessions")
        .select("*, onboard_requests(*)")
        .eq("session_token", token)
        .single();

      if (!session) {
        window.location.href = "/login";
        return;
      }

      setClinic(session.onboard_requests);
      setLoading(false);
    };

    checkSession();
  }, []);

  useEffect(() => {
    if (!clinic) return;

    const fetchAppointments = async () => {
      const { data } = await supabase
        .from("appointments")
        .select("*")
        .eq("clinic_id", clinic.id)
        .order("created_at", { ascending: false });

      setAppointments(data || []);
    };

    fetchAppointments();
  }, [clinic]);

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async function (results) {
        const rows = results.data;

        // Now insert into Supabase
        const appointmentsToInsert = rows.map((r) => ({
          clinic_id: clinic.id,
          patient_name: r.patient_name || r.name || r.Name,
          phone: r.phone || r.Phone || r.Mobile,
          appointment_time: r.time || r.appointment_time || r.AppointmentTime,
          doctor_name: r.doctor || r.Doctor,
        }));

        const { error } = await supabase
          .from("appointments")
          .insert(appointmentsToInsert);

        if (error) {
          console.error("Insert error:", error);
          alert("Error inserting appointments");
        } else {
          alert("Appointments uploaded successfully!");
          // Refresh appointments list
          const { data } = await supabase
            .from("appointments")
            .select("*")
            .eq("clinic_id", clinic.id)
            .order("created_at", { ascending: false });
          setAppointments(data || []);
        }
      },
    });
  };

  const logout = () => {
    localStorage.removeItem("session_token");
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'var(--background)'
      }}>
        <p style={{ color: 'var(--foreground)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      padding: '2rem',
      background: 'var(--background)',
      color: 'var(--foreground)',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <div>
          <h1 style={{ 
            fontSize: '1.875rem', 
            fontWeight: '600', 
            marginBottom: '0.5rem',
            color: 'var(--foreground)'
          }}>
            Welcome, {clinic.contact_name}
          </h1>
          <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
            <b>Clinic:</b> {clinic.clinic_name}
          </p>
          <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
            <b>Integration:</b> {clinic.integration_type}
          </p>
        </div>
        <button 
          onClick={logout}
          className="button"
          style={{ 
            background: 'var(--secondary)',
            color: 'var(--secondary-foreground)'
          }}
        >
          Logout
        </button>
      </div>

      <hr style={{ 
        margin: "2rem 0", 
        border: 'none',
        borderTop: '1px solid var(--border)'
      }} />

      {/* MANUAL MODE */}
      {clinic.integration_type === "manual" && (
        <>
          <h2 style={{ 
            fontSize: '1.5rem', 
            fontWeight: '600', 
            marginBottom: '0.5rem',
            color: 'var(--foreground)'
          }}>
            Upload Appointments (CSV)
          </h2>
          <p style={{ 
            color: 'var(--muted-foreground)', 
            marginBottom: '1rem',
            fontSize: '0.875rem'
          }}>
            Upload tomorrow's schedule and we will automatically call each patient.
          </p>

          <input 
            type="file" 
            accept=".csv"
            onChange={handleCSVUpload}
            style={{
              marginTop: 12,
              marginBottom: 20,
              width: '100%',
              padding: '0.625rem',
              background: 'var(--input)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--foreground)',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          />

          <h3 style={{ 
            fontSize: '1.25rem', 
            fontWeight: '600', 
            marginTop: '2rem',
            marginBottom: '0.75rem',
            color: 'var(--foreground)'
          }}>
            Recent Appointments
          </h3>

          <div style={{ 
            overflowX: 'auto',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            marginTop: 12
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
                  borderBottom: '1px solid var(--border)'
                }}>
                  <th style={{ 
                    padding: '0.75rem',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: 'var(--foreground)'
                  }}>
                    Patient
                  </th>
                  <th style={{ 
                    padding: '0.75rem',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: 'var(--foreground)'
                  }}>
                    Phone
                  </th>
                  <th style={{ 
                    padding: '0.75rem',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: 'var(--foreground)'
                  }}>
                    Time
                  </th>
                  <th style={{ 
                    padding: '0.75rem',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: 'var(--foreground)'
                  }}>
                    Doctor
                  </th>
                  <th style={{ 
                    padding: '0.75rem',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: 'var(--foreground)'
                  }}>
                    Status
                  </th>
                  <th style={{ 
                    padding: '0.75rem',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: 'var(--foreground)'
                  }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {appointments.length === 0 ? (
                  <tr>
                    <td 
                      colSpan="6" 
                      style={{ 
                        padding: '1.5rem',
                        textAlign: 'center',
                        color: 'var(--muted-foreground)'
                      }}
                    >
                      No appointments uploaded yet.
                    </td>
                  </tr>
                ) : (
                  appointments.map((a) => (
                    <tr 
                      key={a.id}
                      style={{ 
                        borderBottom: '1px solid var(--border)',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--muted)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ 
                        padding: '0.75rem',
                        color: 'var(--foreground)'
                      }}>
                        {a.patient_name || 'N/A'}
                      </td>
                      <td style={{ 
                        padding: '0.75rem',
                        color: 'var(--foreground)'
                      }}>
                        {a.phone || 'N/A'}
                      </td>
                      <td style={{ 
                        padding: '0.75rem',
                        color: 'var(--foreground)'
                      }}>
                        {a.appointment_time || 'N/A'}
                      </td>
                      <td style={{ 
                        padding: '0.75rem',
                        color: 'var(--foreground)'
                      }}>
                        {a.doctor_name || 'N/A'}
                      </td>
                      <td style={{ 
                        padding: '0.75rem',
                        color: 'var(--foreground)'
                      }}>
                        {a.status || 'pending'}
                      </td>
                      <td style={{ 
                        padding: '0.75rem',
                        color: 'var(--foreground)'
                      }}>
                        <button
                          onClick={() => setSelectedAppointment(a)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            padding: 0,
                            fontFamily: 'var(--font-sans)'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Appointment Details Modal */}
      <AppointmentDetailsModal
        appointment={selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
      />

      {/* EMR MODE */}
      {clinic.integration_type === "emr" && (
        <div className="card">
          <h2 style={{ 
            fontSize: '1.5rem', 
            fontWeight: '600', 
            marginBottom: '0.5rem',
            color: 'var(--foreground)'
          }}>
            EMR Integration
          </h2>
          <p style={{ 
            color: 'var(--muted-foreground)', 
            marginBottom: '1.5rem',
            fontSize: '0.875rem'
          }}>
            Your EMR integration is being set up.
          </p>
          <button
            className="button"
            disabled
            style={{ 
              background: 'var(--muted)',
              color: 'var(--muted-foreground)',
              cursor: 'not-allowed',
              opacity: 0.6
            }}
          >
            Setup in progress
          </button>
        </div>
      )}
    </div>
  );
}

