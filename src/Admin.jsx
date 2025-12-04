import { useEffect, useState } from "react";

export default function Admin() {
  const [allowed, setAllowed] = useState(null);
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem("session_token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    fetch("/.netlify/functions/get-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    })
      .then(res => res.json())
      .then(user => {
        if (!user) {
          window.location.href = "/login";
          return;
        }

        // HARD-CODED ADMIN EMAIL HERE
        if (user.email !== "shivamjoshi.close@gmail.com") {
          window.location.href = "/";
          return;
        }

        setAllowed(true);
        loadRequests();
      });
  }, []);

  const loadRequests = async () => {
    const res = await fetch("/.netlify/functions/admin-get-requests");
    const data = await res.json();
    setRequests(data);
  };

  const approveUser = async (email) => {
    const res = await fetch("/.netlify/functions/approve-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    const data = await res.json();

    if (data.error) {
      alert(data.error);
      return;
    }

    alert("User approved! Setup link copied:\n\n" + data.setupLink);
    navigator.clipboard.writeText(data.setupLink);
    loadRequests();
  };

  if (!allowed) return <p>Loading...</p>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Admin Dashboard</h2>
      <h3>Pending Access Requests</h3>

      {requests.map((r) => (
        <div key={r.id} style={{ padding: 10, borderBottom: "1px solid #ccc" }}>
          <p><b>{r.name}</b> — {r.email}</p>
          <button onClick={() => approveUser(r.email)}>
            Approve
          </button>
        </div>
      ))}
    </div>
  );
}

