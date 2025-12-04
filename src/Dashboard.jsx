import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { supabase } from "./lib/supabaseClient";
import AppointmentDetailsModal from "./components/AppointmentDetailsModal";
import MergeModal from "./components/MergeModal";
import "./index.css";

// Hash token using Web Crypto API (browser-compatible)
async function hashToken(raw) {
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  return Array
    .from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * SMART UPLOAD RULES
 * Required semantic fields:
 *  - patient_name
 *  - phone
 *  - appointment_reason
 *  - appointment_day (date only)
 *
 * Optional:
 *  - appointment_time
 *  - doctor_name
 *  - health_number
 */

// normalize keys like "Patient Name" -> "patientname"
const normKey = (k) =>
  String(k || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")  // <-- strip EVERYTHING not letter/number
    .trim();

// normalize phone to digits only, keep last 10 if country code included
const normPhone = (v) => {
  const digits = String(v || "").replace(/\D/g, "");
  if (digits.length > 10) return digits.slice(-10);
  return digits;
};

const normHealth = (v) => String(v || "").replace(/\D/g, "");

// normalize name for fuzzy-ish match
const normName = (v) =>
  String(v || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();

// parse date-ish strings to YYYY-MM-DD if possible; else return original trimmed
const normDate = (v) => {
  if (!v) return "";
  const s = String(v).trim();
  // already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // try Date parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return s;
};

// Find the TRUE header row in messy Excel sheets
// It looks for the first row with at least 2 non-empty keys.
const findRealHeaderRowIndex = (rows) => {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const keys = Object.keys(rows[i] || {});
    const nonEmptyKeys = keys.filter(k => String(k).trim() !== "");
    if (nonEmptyKeys.length >= 2) {
      return i; // this row is likely the real header
    }
  }
  return 0; // fallback if nothing found
};

// Map raw row -> canonical fields using synonyms
const mapRowToCanonical = (raw) => {
  const out = {
    patient_name: "",
    phone: "",
    appointment_reason: "",
    appointment_day: "",
    appointment_time: "",
    doctor_name: "",
    health_number: "",
    insurance_number: "",
  };

  // build lookup by normalized key
  const lookup = {};
  Object.keys(raw || {}).forEach((k) => {
    lookup[normKey(k)] = raw[k];
  });

  // ---- COMBINED FIELD: Patient/Description ----
  Object.keys(raw || {}).forEach((key) => {
    const nk = normKey(key);

    if (nk.includes("patient") && nk.includes("description")) {
      const val = String(raw[key] || "").trim();

      if (!val) return;

      // Split cases: "John Doe - Chest Pain"
      if (val.includes("-")) {
        const [namePart, descPart] = val.split("-").map(s => s.trim());
        if (!out.patient_name) out.patient_name = namePart;
        if (!out.appointment_reason) out.appointment_reason = descPart;
        return;
      }

      // Split cases: "John Doe: Fever"
      if (val.includes(":")) {
        const [namePart, descPart] = val.split(":").map(s => s.trim());
        if (!out.patient_name) out.patient_name = namePart;
        if (!out.appointment_reason) out.appointment_reason = descPart;
        return;
      }

      // If it's multi-word string, assume first 2 words = name
      const parts = val.split(" ").filter(Boolean);

      if (parts.length >= 2) {
        out.patient_name = parts.slice(0, 2).join(" ");
        out.appointment_reason = parts.slice(2).join(" ") || out.appointment_reason;
      } else {
        // Only one word → assume it's a name
        out.patient_name = val;
      }
    }
  });

  // synonyms
  const get = (keys) => {
    for (const k of keys) {
      const v = lookup[normKey(k)];
      if (v !== undefined && v !== null && String(v).trim() !== "")
        return v;
    }
    return "";
  };

  out.patient_name = get([
    "patient_name",
    "patientname",
    "name",
    "fullname",
    "patient",
    "client",
  ]);

  // ---- SMART PHONE DETECTION ----
  let detectedPhone = "";
  Object.keys(raw || {}).forEach((key) => {
    const nk = normKey(key); // normalized key, e.g. "patientphonenumber"

    if (
      nk.includes("phone") ||
      nk.includes("phonenumber") ||
      nk.includes("cell") ||
      nk.includes("mobile") ||
      nk.includes("contact")
    ) {
      detectedPhone = raw[key];
    }
  });

  out.phone = normPhone(detectedPhone);

  out.health_number = get([
    "healthnumber",
    "health_number",
    "ahn",
    "uhc",
    "hin",
    "phn",
  ]);

  out.appointment_reason = get([
    "reason",
    "appointment_reason",
    "appointmentreason",
    "visitreason",
    "type",
    "service",
  ]);

  out.appointment_day = get([
    "appointment_day",
    "appointmentdate",
    "appointment_date",
    "date",
    "day",
    "apptdate",
    "time_and_date", // new
  ]);

  out.appointment_time = get([
    "appointment_time",
    "time",
    "appttime",
    "starttime",
    "start_time",
    "time_and_date", // new
  ]);

  out.doctor_name = get([
    "doctor",
    "doctor_name",
    "providername",
    "provider",
    "physician",
  ]);

  // Patient/Description -> patient name
  if (!out.patient_name) {
    const key = Object.keys(raw).find(k => normKey(k) === "patientdescription");
    if (key) out.patient_name = String(raw[key] || "").trim();
  }

  // Reason from CONCERN (first)
  if (!out.appointment_reason) {
    const key = Object.keys(raw).find(k => normKey(k) === "concern");
    if (key) out.appointment_reason = String(raw[key]).trim();
  }

  // Reason fallback from TYPE
  if (!out.appointment_reason) {
    const key = Object.keys(raw).find(k => normKey(k) === "type");
    if (key) out.appointment_reason = String(raw[key]).trim();
  }

  // Doctor from Provider
  if (!out.doctor_name) {
    const key = Object.keys(raw).find(k => normKey(k) === "provider");
    if (key) out.doctor_name = String(raw[key]).trim();
  }

  // ---- FALLBACK: Combine Area Code + Phone Number (MedAccess format) ----
  if (!out.phone || out.phone.length < 10) {
    let area = "";
    let num = "";

    // detect area code column
    const areaKey = Object.keys(raw).find(k => {
      const nk = normKey(k);
      return nk === "areacode" || nk.includes("areacode") || nk === "area";
    });
    if (areaKey) {
      area = String(raw[areaKey] || "").replace(/\D/g, "");
    }

    // detect phone number column
    const phoneKey = Object.keys(raw).find(k => {
      const nk = normKey(k);
      return nk.includes("phone") || nk === "phonenumber" || nk === "number";
    });
    if (phoneKey) {
      num = String(raw[phoneKey] || "").replace(/\D/g, "");
    }

    if (area || num) {
      const combined = (area + num).replace(/\D/g, "");
      if (combined.length >= 10) {
        out.phone = combined.slice(-10); // last 10 digits
      }
    }
  }

  // ---- FALLBACK: Extract phone from Concern column ----
  if (!out.phone || out.phone.length < 10) {
    const concernKey = Object.keys(raw).find(k => normKey(k) === "concern");
    if (concernKey) {
      const digits = String(raw[concernKey]).replace(/\D/g, "");
      if (digits.length >= 10) {
        out.phone = digits.slice(-10);
      }
    }
  }

  // ---- FINAL FALLBACK: scan all columns for any 10+ digit number ----
  if (!out.phone || out.phone.length < 10) {
    for (const key of Object.keys(raw)) {
      const digits = String(raw[key] || "").replace(/\D/g, "");
      if (digits.length >= 10) {
        out.phone = digits.slice(-10);
        break;
      }
    }
  }

  // ---- Insurance / Primary ID (common merge key) ----
  if (!out.insurance_number) {
    const key = Object.keys(raw).find(k => {
      const nk = normKey(k);
      return (
        nk === "ins" ||                  // Ins #
        nk.includes("insurance") ||
        nk.includes("primaryid") ||      // Primary ID
        nk.includes("healthnumber") ||
        nk === "hin" ||
        nk.endsWith("id")
      );
    });

    if (key) {
      out.insurance_number = String(raw[key] || "").replace(/\D/g, "");
    }
  }

  // normalize values
  out.patient_name = String(out.patient_name || "").trim();
  out.phone = normPhone(out.phone);
  out.health_number = normHealth(out.health_number);
  out.appointment_reason = String(out.appointment_reason || "").trim();
  out.appointment_day = normDate(out.appointment_day);
  out.appointment_time = String(out.appointment_time || "").trim();
  out.doctor_name = String(out.doctor_name || "").trim();

  // Auto-split time_and_date if appointment_day contains space (date + time)
  if (out.appointment_day && out.appointment_day.includes(" ")) {
    const parts = out.appointment_day.split(" ");
    out.appointment_day = normDate(parts[0]);
    out.appointment_time = parts[1] || out.appointment_time;
  }

  return out;
};

// choose a matching key for merge
const keyCandidates = (row) => {
  const keys = [];
  if (row.insurance_number) keys.push(`ins:${row.insurance_number}`);
  if (row.phone) keys.push(`phone:${row.phone}`);
  if (row.health_number) keys.push(`health:${row.health_number}`);
  if (row.patient_name) keys.push(`name:${normName(row.patient_name)}`);
  return keys;
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [clinic, setClinic] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  // SMART UPLOAD STATE
  const [uploadStep, setUploadStep] = useState(1); // 1=first upload, 2=need more, 3=preview ready
  const [parsedFiles, setParsedFiles] = useState([]); // [{fileName, rows, columnsPresent}]
  const [mergedRows, setMergedRows] = useState([]);
  const [missingFields, setMissingFields] = useState([]); // overall missing required fields after merge
  const [mergeError, setMergeError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingMergedRows, setPendingMergedRows] = useState(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [incompleteRows, setIncompleteRows] = useState([]);
  const [completeRows, setCompleteRows] = useState([]);
  const [rowToFix, setRowToFix] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);

  const REQUIRED_FIELDS = useMemo(
    () => ["patient_name", "phone", "appointment_reason", "appointment_day"],
    []
  );

  // Helper to get missing fields for a single row
  const getRowMissingFields = (row) => {
    return REQUIRED_FIELDS.filter(
      (f) => !row[f] || String(row[f]).trim() === ""
    );
  };

  useEffect(() => {
    const localToken = localStorage.getItem("session_token");
    if (!localToken) {
      window.location.href = "/login";
      return;
    }

    const checkSession = async () => {
      try {
        const hashed = await hashToken(localToken);

        const { data: session } = await supabase
          .from("user_sessions")
          .select("*")
          .eq("token_hash", hashed)
          .single();

        if (!session || new Date(session.expires_at) < new Date()) {
          localStorage.removeItem("session_token");
          window.location.href = "/login";
          return;
        }

        // Fetch clinic using session.user_id
        const { data: clinicRow, error: clinicError } = await supabase
          .from("onboard_requests")
          .select("*")
          .eq("id", session.user_id)
          .maybeSingle();

        if (clinicError || !clinicRow) {
          localStorage.removeItem("session_token");
          window.location.href = "/login";
          return;
        }

        setClinic(clinicRow);
        setLoading(false);
      } catch (err) {
        console.error("checkSession error:", err);
        localStorage.removeItem("session_token");
        window.location.href = "/login";
      }
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

  const logout = async () => {
    const raw = localStorage.getItem("session_token");
    if (raw) {
      const tokenHash = await hashToken(raw);
      await supabase.from("user_sessions").delete().eq("token_hash", tokenHash);
    }
    localStorage.removeItem("session_token");
    window.location.href = "/";
  };

  // Parse a CSV file into canonical rows
  const parseCsvFile = (file) =>
    new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const rawRows = results.data || [];
            const columnsPresent = Object.keys(rawRows[0] || {}).map(normKey);

            const canonicalRows = rawRows.map(mapRowToCanonical);

            resolve({
              fileName: file.name,
              rows: canonicalRows,
              columnsPresent,
            });
          } catch (e) {
            reject(e);
          }
        },
        error: (err) => reject(err),
      });
    });

  // After any new file, attempt merge + validate
  const recomputeMergeState = (filesArr) => {
    setMergeError("");

    if (!filesArr.length) {
      setMergedRows([]);
      setMissingFields(REQUIRED_FIELDS);
      setUploadStep(1);
      setIncompleteRows([]);
      setCompleteRows([]);
      return;
    }

    // 1) merge all rows across files
    const index = new Map(); // key -> mergedRow
    const merged = [];

    filesArr.forEach((pf, i) => {
      pf.rows.forEach((row) => {
        const keys = keyCandidates(row);
        let existing = null;
        let existingKey = null;

        for (const k of keys) {
          if (index.has(k)) {
            existing = index.get(k);
            existingKey = k;
            break;
          }
        }

        if (!existing) {
          // new row
          const newRow = { 
            id: crypto.randomUUID(),   // <---- ADD THIS
            ...row 
          };
          merged.push(newRow);
          // add all keys to index
          keyCandidates(newRow).forEach((k) => index.set(k, newRow));
        } else {
          // merge into existing, fill blanks only
          REQUIRED_FIELDS.concat([
            "appointment_time",
            "doctor_name",
            "health_number",
          ]).forEach((f) => {
            if (!existing[f] && row[f]) existing[f] = row[f];
          });

          // refresh index if new identifiers were added
          keyCandidates(existing).forEach((k) => index.set(k, existing));

          // If it matched by name but phone now added, keep stable
          if (existingKey && !index.has(existingKey)) {
            index.set(existingKey, existing);
          }
        }
      });
    });

    // Deduplicate merged rows
    const unique = [];
    const seen = new Set();

    for (const r of merged) {
      const key = r.insurance_number || r.phone || r.patient_name;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(r);
      }
    }

    // 2) compute missing required fields overall (do ANY rows still miss stuff?)
    const missingOverall = new Set();
    unique.forEach((r) => {
      REQUIRED_FIELDS.forEach((f) => {
        if (!r[f] || String(r[f]).trim() === "") missingOverall.add(f);
      });
    });

    // 3) Validate single appointment date if days exist
    const uniqueDays = Array.from(
      new Set(unique.map((r) => r.appointment_day).filter(Boolean))
    );
    if (uniqueDays.length > 1) {
      setMergeError(
        `Multiple appointment dates detected: ${uniqueDays.join(
          ", "
        )}. Please upload files containing ONLY ONE date.`
      );
      setMergedRows(unique);
      setMissingFields(Array.from(missingOverall));
      setUploadStep(2);
      return;
    }

    setMergedRows(unique);
    setMissingFields(Array.from(missingOverall));

    // Build complete and incomplete rows lists
    const incomplete = [];
    const complete = [];

    unique.forEach(row => {
      const missing = getRowMissingFields(row);
      if (missing.length > 0) {
        incomplete.push({ ...row, missing, _id: row.id });
      } else {
        complete.push(row);
      }
    });

    setIncompleteRows(incomplete);
    setCompleteRows(complete);

    if (missingOverall.size === 0) {
      setUploadStep(3); // ready to preview/confirm
    } else {
      setUploadStep(2); // need more files
    }
  };

  // SMART MULTI FILE UPLOAD HANDLER (supports CSV + XLSX)
  const handleUploadSmart = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const parsedBatch = [];

    try {
      for (const file of files) {
        const ext = file.name.toLowerCase().split('.').pop();

        if (ext === "csv") {
          // ---- Parse CSV ----
          const parsed = await parseCsvFile(file);
          parsedBatch.push(parsed);
        } 
        else if (ext === "xlsx" || ext === "xls") {
          const data = await file.arrayBuffer();
          const workbook = XLSX.read(data, { type: "array", cellDates: true });

          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];

          // Raw rows EXACTLY as Excel gives them
          const rawRows = XLSX.utils.sheet_to_json(sheet, {
            header: 1,      // return as arrays (easier to detect header)
            defval: "",
            blankrows: false
          });

          // 1) Locate real header row
          const headerRowIndex = rawRows.findIndex(row =>
            Array.isArray(row) && row.filter(col => String(col).trim() !== "").length >= 2
          );

          if (headerRowIndex === -1) {
            throw new Error("Could not find a valid header row in Excel file.");
          }

          const headerRow = rawRows[headerRowIndex];

          // 2) Build objects for all rows AFTER header row
          const bodyRows = rawRows.slice(headerRowIndex + 1);

          const jsonRows = bodyRows
            .filter(r => r.some(cell => String(cell).trim() !== "")) // remove empty rows
            .map(r => {
              const obj = {};
              headerRow.forEach((colName, i) => {
                obj[colName] = r[i] || "";
              });
              return obj;
            });

          // 3) Map into canonical format
          const canonicalRows = jsonRows.map(mapRowToCanonical);

          parsedBatch.push({
            fileName: file.name,
            rows: canonicalRows,
            columnsPresent: headerRow,
          });
        }
      }

      const nextParsedFiles = [...parsedFiles, ...parsedBatch];
      setParsedFiles(nextParsedFiles);
      recomputeMergeState(nextParsedFiles);

      e.target.value = ""; // allow re-upload of same file
    } catch (err) {
      console.error("Upload error:", err);
      alert("Error processing file. Make sure it's a valid CSV or Excel file.");
    }
  };

  const resetUploads = () => {
    setParsedFiles([]);
    setMergedRows([]);
    setMissingFields(REQUIRED_FIELDS);
    setMergeError("");
    setUploadStep(1);
    setIncompleteRows([]);
    setCompleteRows([]);
    setRowToFix(null);
  };

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async function (results) {
        const rows = results.data;

        // Instead of direct insert → pass to merge logic
        setPendingMergedRows(rows);
        setShowMergeModal(true);
      },
    });
  };

  const handleConfirmSave = async () => {
    if (!pendingMergedRows) return;

    // ✅ 1. Clean every row before inserting
    const cleanedRows = pendingMergedRows.map(r => {
      let appointmentDateTime = null;

      if (r.Date && r.Time) {
        // Convert "26Nov2025" → "26 Nov 2025"
        const cleanedDate = r.Date.replace(
          /(\d{2})([A-Za-z]{3})(\d{4})/,
          "$1 $2 $3"
        );

        // Build a proper JS Date object
        const jsDate = new Date(`${cleanedDate} ${r.Time}`);

        // Convert to YYYY-MM-DD
        const yyyy = jsDate.getFullYear();
        const mm = String(jsDate.getMonth() + 1).padStart(2, "0");
        const dd = String(jsDate.getDate()).padStart(2, "0");

        // Convert time to HH:MM (24h)
        const hh = String(jsDate.getHours()).padStart(2, "0");
        const min = String(jsDate.getMinutes()).padStart(2, "0");

        // FINAL FORMAT → "2025-01-15T14:00"
        appointmentDateTime = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
      }

      return {
        clinic_id: clinic.id,

        patient_name:
          r.name ||
          r.patient_name ||
          r["Patient/Description"] ||
          null,

        phone:
          r.phone ||
          r.phoneNumber ||
          null,

        appointment_time:
          r.appointment_time ||
          appointmentDateTime,

        doctor_name:
          r.doctor ||
          r.doctor_name ||
          r.Provider ||
          null,

        status: "pending",
      };
    });

    // ❗ 2. Ensure ONLY these 6 keys remain
    console.log("FINAL ROWS:", cleanedRows);

    // ⭐ 3. INSERT using the cleaned rows
    console.log("FINAL PAYLOAD BEING SENT TO SUPABASE:", cleanedRows);
    const { error } = await supabase
      .from("appointments")
      .insert(cleanedRows);

    if (error) {
      console.log("SUPABASE INSERT ERROR:", error);
      alert("Insert failed. Check console.");
      return;
    }

    alert("Imported successfully!");
    setShowMergeModal(false);
    setPendingMergedRows(null);

    // Refresh list
    const { data } = await supabase
      .from("appointments")
      .select("*")
      .eq("clinic_id", clinic.id)
      .order("created_at", { ascending: false });

    setAppointments(data);
  };

  const saveFixedRow = (updatedRow) => {
    if (editingIndex === null) return;

    const newMerged = [...mergedRows];

    // Update the real row
    newMerged[editingIndex] = {
      ...newMerged[editingIndex],
      ...updatedRow
    };

    // Recompute missing fields row-by-row
    const newComplete = [];
    const newIncomplete = [];
    const overallMissing = new Set();

    newMerged.forEach((row) => {
      const missing = REQUIRED_FIELDS.filter(
        (f) => !row[f] || String(row[f]).trim() === ""
      );

      if (missing.length === 0) {
        newComplete.push(row);
      } else {
        newIncomplete.push({ ...row, missing, _id: row.id });
        missing.forEach((m) => overallMissing.add(m));
      }
    });

    // Update the state
    setMergedRows(newMerged);
    setCompleteRows(newComplete);
    setIncompleteRows(newIncomplete);

    // 🔥 This is the missing piece: update missingFields + uploadStep
    const missingFieldsArray = Array.from(overallMissing);
    setMissingFields(missingFieldsArray);

    if (missingFieldsArray.length === 0) {
      setUploadStep(3); // all required fields complete → ready to save
    } else {
      setUploadStep(2);
    }

    // Close modal
    setRowToFix(null);
    setEditingIndex(null);
  };

  const runPendingCalls = async () => {
    const { data: pending, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("clinic_id", clinic.id)
      .eq("status", "pending");

    if (!pending?.length) {
      alert("No pending appointments.");
      return;
    }

    let success = 0;
    let failed = 0;

    for (const appt of pending) {
      try {
        const response = await fetch("/.netlify/functions/manual-call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appointmentId: appt.id }),
        });

        if (!response.ok) failed++;
        else success++;
      } catch (e) {
        failed++;
      }
    }

    alert(`Calls started: ${success}, Failed triggers: ${failed}`);
  };

  const confirmAndSave = async () => {
    if (!mergedRows.length) return;

    // Must have at least 1 complete row
    if (completeRows.length === 0) {
      alert("All rows are missing required fields. Fix them before saving.");
      return;
    }

    // If some rows are incomplete → warn user
    if (incompleteRows.length > 0) {
      const ok = confirm(
        `${incompleteRows.length} row(s) still missing required fields.\n\n` +
        `Do you want to save ONLY the ${completeRows.length} complete rows?`
      );
      if (!ok) return;
    }

    if (mergeError) {
      alert("Fix merge error before saving.");
      return;
    }

    setSaving(true);

    try {
      const payload = completeRows.map((r) => {
        let apptTime = r.appointment_time || null;

        // Fix corrupted strings like "V04:45 PM"
        if (apptTime && typeof apptTime === "string") {
          apptTime = apptTime.replace(/^[^\d]*/, ""); // remove leading non-numeric chars
        }

        // Ensure we have a valid date+time
        const apptDay = r.appointment_day || null;

        // If we have a day but time is missing or invalid, default to 09:00
        if (apptDay) {
          if (!apptTime || !/^\d{1,2}:\d{2}/.test(apptTime)) {
            apptTime = "09:00 AM";
          }
        }

        let fullTimestamp = null;
        if (apptDay && apptTime) {
          fullTimestamp = `${apptDay} ${apptTime}`;
        }

        console.log("FINAL ROW:", r);
        console.log("TIMESTAMP:", fullTimestamp);

        return {
          clinic_id: clinic.id,
          patient_name: r.patient_name || null,
          phone: r.phone || null,
          doctor_name: r.doctor_name || null,
          appointment_day: apptDay,
          appointment_time: fullTimestamp, // final corrected timestamp
          summary: r.appointment_reason || null,
          status: "pending"
        };
      });

      console.log("FINAL PAYLOAD:", JSON.stringify(payload, null, 2));

      const { error } = await supabase
        .from("appointments")
        .insert(payload);

      if (error) {
        console.log("SUPABASE INSERT ERROR:", error);
        alert("Insert failed. Check console.");
      } else {
        alert("Appointments uploaded!");

        // Reset state
        resetUploads();

        const { data } = await supabase
          .from("appointments")
          .select("*")
          .eq("clinic_id", clinic.id)
          .order("created_at", { ascending: false });

        setAppointments(data || []);
      }
    } finally {
      setSaving(false);
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(mergedRows.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const previewRows = useMemo(() => mergedRows.slice(startIndex, endIndex), [mergedRows, startIndex, endIndex]);

  // Reset to page 1 when mergedRows changes
  useEffect(() => {
    setCurrentPage(1);
  }, [mergedRows.length]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--background)",
        }}
      >
        <p style={{ color: "var(--foreground)" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "2rem",
        background: "var(--background)",
        color: "var(--foreground)",
        maxWidth: "1200px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.875rem",
              fontWeight: "600",
              marginBottom: "0.5rem",
              color: "var(--foreground)",
            }}
          >
            Welcome, {clinic.contact_name}
          </h1>
          <p style={{ color: "var(--muted-foreground)", fontSize: "0.875rem" }}>
            <b>Clinic:</b> {clinic.clinic_name}
          </p>
          <p style={{ color: "var(--muted-foreground)", fontSize: "0.875rem" }}>
            <b>Integration:</b> {clinic.integration_type}
          </p>
        </div>
        <button
          onClick={logout}
          className="button"
          style={{
            background: "var(--secondary)",
            color: "var(--secondary-foreground)",
          }}
        >
          Logout
        </button>
      </div>

      <hr
        style={{
          margin: "2rem 0",
          border: "none",
          borderTop: "1px solid var(--border)",
        }}
      />

      {/* MANUAL MODE */}
      {clinic.integration_type === "manual" && (
        <>
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: "600",
              marginBottom: "0.5rem",
              color: "var(--foreground)",
            }}
          >
            Upload Appointments (Smart CSV)
          </h2>
          <p
            style={{
              color: "var(--muted-foreground)",
              marginBottom: "1rem",
              fontSize: "0.875rem",
            }}
          >
            Upload tomorrow's schedule. If your CSV is missing fields, you can
            upload another CSV and we'll merge them automatically.
          </p>

          {/* SMART UPLOAD BOX */}
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "1rem",
              marginBottom: "1.5rem",
              background: "var(--card)",
            }}
          >
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                multiple
                onChange={handleUploadSmart}
                style={{
                  flex: 1,
                  minWidth: 240,
                  padding: "0.625rem",
                  background: "var(--input)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  color: "var(--foreground)",
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.875rem",
                  cursor: "pointer",
                }}
              />

              {showMergeModal && (
                <MergeModal
                  rows={pendingMergedRows}
                  onSave={handleConfirmSave}
                  onCancel={() => setShowMergeModal(false)}
                />
              )}

              <button
                className="button"
                onClick={resetUploads}
                style={{
                  background: "var(--muted)",
                  color: "var(--foreground)",
                }}
                disabled={!parsedFiles.length}
              >
                Reset Uploads
              </button>

              <button
                className="button"
                onClick={confirmAndSave}
                disabled={
                  uploadStep !== 3 ||
                  !!mergeError ||
                  saving
                }
              >
                {saving ? "Saving..." : "Confirm & Save"}
              </button>
            </div>

            {/* Status / Step */}
            <div style={{ marginTop: "0.75rem", fontSize: "0.875rem" }}>
              {uploadStep === 1 && (
                <p style={{ color: "var(--muted-foreground)" }}>
                  Step 1: Upload your first CSV.
                </p>
              )}
              {uploadStep === 2 && (
                <p style={{ color: "var(--muted-foreground)" }}>
                  Step 2: Missing fields detected. Upload another CSV to fill
                  them.
                </p>
              )}
              {uploadStep === 3 && (
                <p style={{ color: "var(--muted-foreground)" }}>
                  Step 3: Ready. Preview looks complete — click Confirm & Save.
                </p>
              )}
            </div>

            {/* Uploaded files list */}
            {parsedFiles.length > 0 && (
              <div style={{ marginTop: "0.75rem" }}>
                <p style={{ fontWeight: 600, marginBottom: 6 }}>
                  Uploaded files:
                </p>
                <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                  {parsedFiles.map((f, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      {f.fileName} — {f.rows.length} rows
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Missing fields */}
            {missingFields.length > 0 && (
              <div
                style={{
                  marginTop: "0.75rem",
                  padding: "0.75rem",
                  borderRadius: "var(--radius)",
                  background: "var(--muted)",
                }}
              >
                <p style={{ fontWeight: 600, marginBottom: 4 }}>
                  Missing required fields:
                </p>
                <p style={{ margin: 0 }}>
                  {missingFields.join(", ")}. Upload another CSV that contains
                  these.
                </p>
              </div>
            )}

            {/* Merge error */}
            {mergeError && (
              <div
                style={{
                  marginTop: "0.75rem",
                  padding: "0.75rem",
                  borderRadius: "var(--radius)",
                  background: "rgba(255,0,0,0.08)",
                  border: "1px solid rgba(255,0,0,0.2)",
                  color: "var(--foreground)",
                }}
              >
                <p style={{ fontWeight: 600, marginBottom: 4 }}>Error</p>
                <p style={{ margin: 0 }}>{mergeError}</p>
              </div>
            )}

            {/* Preview */}
            {mergedRows.length > 0 && (
              <div
                style={{
                  marginTop: "1rem",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  overflowX: "auto",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.85rem",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "var(--muted)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <th style={{ padding: "0.6rem", textAlign: "left" }}>
                        Patient
                      </th>
                      <th style={{ padding: "0.6rem", textAlign: "left" }}>
                        Phone
                      </th>
                      <th style={{ padding: "0.6rem", textAlign: "left" }}>
                        Reason
                      </th>
                      <th style={{ padding: "0.6rem", textAlign: "left" }}>
                        Day
                      </th>
                      <th style={{ padding: "0.6rem", textAlign: "left" }}>
                        Time
                      </th>
                      <th style={{ padding: "0.6rem", textAlign: "left" }}>
                        Doctor
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "0.6rem" }}>
                          {r.patient_name || "—"}
                        </td>
                        <td style={{ padding: "0.6rem" }}>{r.phone || "—"}</td>
                        <td style={{ padding: "0.6rem" }}>
                          {r.appointment_reason || "—"}
                        </td>
                        <td style={{ padding: "0.6rem" }}>
                          {r.appointment_day || "—"}
                        </td>
                        <td style={{ padding: "0.6rem" }}>
                          {r.appointment_time || "—"}
                        </td>
                        <td style={{ padding: "0.6rem" }}>
                          {r.doctor_name || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Missing Info Table */}
            {incompleteRows.length > 0 && (
              <div style={{ marginTop: "1.5rem" }}>
                <h3 style={{ fontWeight: 600, marginBottom: 8 }}>
                  Rows With Missing Information ({incompleteRows.length})
                </h3>

                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--muted)" }}>
                      <th style={{ padding: "8px" }}>Patient</th>
                      <th style={{ padding: "8px" }}>Phone</th>
                      <th style={{ padding: "8px" }}>Reason</th>
                      <th style={{ padding: "8px" }}>Date</th>
                      <th style={{ padding: "8px" }}>Missing Fields</th>
                      <th style={{ padding: "8px" }}>Fix</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incompleteRows.map((r, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: "8px" }}>{r.patient_name || "—"}</td>
                        <td style={{ padding: "8px" }}>{r.phone || "—"}</td>
                        <td style={{ padding: "8px" }}>{r.appointment_reason || "—"}</td>
                        <td style={{ padding: "8px" }}>{r.appointment_day || "—"}</td>
                        <td style={{ padding: "8px", color: "red" }}>
                          {r.missing.join(", ")}
                        </td>
                        <td style={{ padding: "8px" }}>
                          <button
                            className="button"
                            onClick={() => {
                              setRowToFix({ ...r, _id: r._id }); // <-- ensure _id is preserved
                              const mergedIndex = mergedRows.findIndex(mr => mr.id === r._id);
                              setEditingIndex(mergedIndex);
                            }}
                          >
                            Fix
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {mergedRows.length > itemsPerPage && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "1rem",
                  padding: "0.75rem",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  background: "var(--muted)",
                }}
              >
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: "0.5rem 1rem",
                    background: currentPage === 1 ? "var(--muted)" : "var(--primary)",
                    color: currentPage === 1 ? "var(--muted-foreground)" : "var(--primary-foreground)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    opacity: currentPage === 1 ? 0.5 : 1,
                  }}
                >
                  ← Previous
                </button>
                <span
                  style={{
                    color: "var(--foreground)",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                  }}
                >
                  Page {currentPage} of {totalPages} ({mergedRows.length} total rows)
                </span>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: "0.5rem 1rem",
                    background: currentPage === totalPages ? "var(--muted)" : "var(--primary)",
                    color: currentPage === totalPages ? "var(--muted-foreground)" : "var(--primary-foreground)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    opacity: currentPage === totalPages ? 0.5 : 1,
                  }}
                >
                  Next →
                </button>
              </div>
            )}
          </div>

          {/* Recent appointments table (unchanged) */}
          <h3
            style={{
              fontSize: "1.25rem",
              fontWeight: "600",
              marginTop: "2rem",
              marginBottom: "0.75rem",
              color: "var(--foreground)",
            }}
          >
            Recent Appointments
          </h3>

          <button
            className="button"
            onClick={runPendingCalls}
            style={{ marginTop: 20 }}
          >
            Run Pending Calls
          </button>

          <div
            style={{
              overflowX: "auto",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              marginTop: 12,
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: "var(--font-sans)",
                fontSize: "0.875rem",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "var(--muted)",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <th
                    style={{
                      padding: "0.75rem",
                      textAlign: "left",
                      fontWeight: "600",
                      color: "var(--foreground)",
                    }}
                  >
                    Patient
                  </th>
                  <th
                    style={{
                      padding: "0.75rem",
                      textAlign: "left",
                      fontWeight: "600",
                      color: "var(--foreground)",
                    }}
                  >
                    Phone
                  </th>
                  <th
                    style={{
                      padding: "0.75rem",
                      textAlign: "left",
                      fontWeight: "600",
                      color: "var(--foreground)",
                    }}
                  >
                    Time
                  </th>
                  <th
                    style={{
                      padding: "0.75rem",
                      textAlign: "left",
                      fontWeight: "600",
                      color: "var(--foreground)",
                    }}
                  >
                    Doctor
                  </th>
                  <th
                    style={{
                      padding: "0.75rem",
                      textAlign: "left",
                      fontWeight: "600",
                      color: "var(--foreground)",
                    }}
                  >
                    Status
                  </th>
                  <th
                    style={{
                      padding: "0.75rem",
                      textAlign: "left",
                      fontWeight: "600",
                      color: "var(--foreground)",
                    }}
                  >
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
                        padding: "1.5rem",
                        textAlign: "center",
                        color: "var(--muted-foreground)",
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
                        borderBottom: "1px solid var(--border)",
                        transition: "background 0.2s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "var(--muted)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <td style={{ padding: "0.75rem" }}>
                        {a.patient_name || "N/A"}
                      </td>
                      <td style={{ padding: "0.75rem" }}>{a.phone || "N/A"}</td>
                      <td style={{ padding: "0.75rem" }}>
                        {a.appointment_time || "N/A"}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        {a.doctor_name || "N/A"}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        {a.status || "pending"}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        <button
                          onClick={() => setSelectedAppointment(a)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--primary)",
                            textDecoration: "underline",
                            cursor: "pointer",
                            fontSize: "0.875rem",
                            padding: 0,
                            fontFamily: "var(--font-sans)",
                          }}
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

      {/* Fix Missing Information Modal */}
      {rowToFix && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
        >
          <div
            style={{
              background: "white",
              padding: "1.5rem",
              borderRadius: 8,
              width: 400
            }}
          >
            <h3 style={{ marginBottom: 10 }}>Fix Missing Fields</h3>

            {rowToFix.missing.map((field) => (
              <div key={field} style={{ marginBottom: 12 }}>
                <label>{field}</label>
                <input
                  type="text"
                  style={{
                    width: "100%",
                    padding: 8,
                    marginTop: 4,
                    border: "1px solid #ccc"
                  }}
                  value={rowToFix[field] || ""}
                  onChange={(e) =>
                    setRowToFix({ ...rowToFix, [field]: e.target.value })
                  }
                />
              </div>
            ))}

            <button
              className="button"
              onClick={() => saveFixedRow(rowToFix)}
            >
              Save
            </button>

            <button
              className="button"
              style={{ marginLeft: 8 }}
              onClick={() => {
                setRowToFix(null);
                setEditingIndex(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* EMR MODE */}
      {clinic.integration_type === "emr" && (
        <div className="card">
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: "600",
              marginBottom: "0.5rem",
              color: "var(--foreground)",
            }}
          >
            EMR Integration
          </h2>
          <p
            style={{
              color: "var(--muted-foreground)",
              marginBottom: "1.5rem",
              fontSize: "0.875rem",
            }}
          >
            Your EMR integration is being set up.
          </p>
          <button
            className="button"
            disabled
            style={{
              background: "var(--muted)",
              color: "var(--muted-foreground)",
              cursor: "not-allowed",
              opacity: 0.6,
            }}
          >
            Setup in progress
          </button>
        </div>
      )}
    </div>
  );
}

