exports.handler = async (event, context) => {
    try {
      const { appointmentId, clinicId } = JSON.parse(event.body || "{}");
  
      console.log("Manual call triggered:", { appointmentId, clinicId });
  
      const webhookUrl = "https://mybuilder.app.n8n.cloud/webhook/6887eb00-1f0f-489e-810f-479804e3c28e";
  
      const resp = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          clinicId, // ✅ pass through
        }),
      });
  
      const data = await resp.json().catch(() => ({}));
  
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, n8nResponse: data })
      };
  
    } catch (err) {
      return {
        statusCode: 500,
        body: JSON.stringify({ ok: false, error: err.message })
      };
    }
  };
  