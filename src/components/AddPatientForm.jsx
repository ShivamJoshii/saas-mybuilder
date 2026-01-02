import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AddPatientForm({ clinicId, onClose, onSaved }) {
  const [form, setForm] = useState({
    patient_name: "",
    phone: "",
    appointment_day: "",
    appointment_time: "",
    doctor_name: "",
    appointment_reason: "",
  });

  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    if (!form.patient_name || !form.phone || !form.appointment_day) {
      alert("Patient name, phone, and date are required");
      return;
    }

    setSaving(true);

    let appointmentTimestamp = null;

    if (form.appointment_day && form.appointment_time) {
      // interpret the picked values as LOCAL time, then store as ISO (UTC)
      const localValue = `${form.appointment_day}T${form.appointment_time}`; // "2025-12-26T10:00"
      appointmentTimestamp = new Date(localValue).toISOString();
    }

    const { error } = await supabase.from("appointments").insert({
      clinic_id: clinicId,
      patient_name: form.patient_name,
      phone: form.phone.replace(/\D/g, ""),
      appointment_day: form.appointment_day,
      appointment_time: appointmentTimestamp,
      doctor_name: form.doctor_name || null,
      summary: form.appointment_reason || null,
      status: "pending",
    });

    setSaving(false);

    if (error) {
      console.error(error);
      alert("Failed to add patient");
      return;
    }

    onSaved();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <input
        name="patient_name"
        placeholder="Patient name"
        onChange={handleChange}
        style={{
          width: "100%",
          padding: "0.5rem",
          borderRadius: 6,
          border: "1px solid var(--border)",
          fontSize: "0.875rem",
        }}
      />
      <input
        name="phone"
        placeholder="Phone (10 digits)"
        onChange={handleChange}
        style={{
          width: "100%",
          padding: "0.5rem",
          borderRadius: 6,
          border: "1px solid var(--border)",
          fontSize: "0.875rem",
        }}
      />
      <div
        onClick={(e) => {
          const input = e.currentTarget.querySelector("input");
          input?.showPicker?.();
          input?.focus();
        }}
      >
        <input
          name="appointment_day"
          type="date"
          value={form.appointment_day}
          onChange={handleChange}
          style={{
            width: "100%",
            padding: "0.5rem",
            borderRadius: 6,
            border: "1px solid var(--border)",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        />
      </div>
      <div
        onClick={(e) => {
          const input = e.currentTarget.querySelector("input");
          input?.showPicker?.();
          input?.focus();
        }}
      >
        <input
          name="appointment_time"
          type="time"
          value={form.appointment_time}
          onChange={handleChange}
          style={{
            width: "100%",
            padding: "0.5rem",
            borderRadius: 6,
            border: "1px solid var(--border)",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        />
      </div>
      <input
        name="doctor_name"
        placeholder="Doctor (optional)"
        onChange={handleChange}
        style={{
          width: "100%",
          padding: "0.5rem",
          borderRadius: 6,
          border: "1px solid var(--border)",
          fontSize: "0.875rem",
        }}
      />
      <input
        name="appointment_reason"
        placeholder="Reason (optional)"
        onChange={handleChange}
        style={{
          width: "100%",
          padding: "0.5rem",
          borderRadius: 6,
          border: "1px solid var(--border)",
          fontSize: "0.875rem",
        }}
      />

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", paddingTop: "0.5rem" }}>
        <button
          onClick={onClose}
          className="button"
          style={{
            background: "var(--muted)",
            color: "var(--foreground)",
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="button"
          style={{
            background: "var(--primary)",
            color: "var(--primary-foreground)",
          }}
        >
          {saving ? "Saving..." : "Add Patient"}
        </button>
      </div>
    </div>
  );
}

