import fetch from "node-fetch";

exports.handler = async (event, context) => {
  try {
    const body = JSON.parse(event.body || "{}");

    console.log("Manual call triggered:", body);

    const webhookUrl = "https://mybuilder.app.n8n.cloud/webhook/6887eb00-1f0f-489e-810f-479804e3c28e";

    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "mybuilder-app"
      },
      body: JSON.stringify(body),
    });

    const text = await resp.text();

    console.log("N8N RAW RESPONSE:", text);

    return {
      statusCode: resp.status,
      body: JSON.stringify({
        ok: true,
        raw: text
      })
    };

  } catch (err) {
    console.error("ERROR:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
