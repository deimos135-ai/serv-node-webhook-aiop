import express from "express";

const app = express();
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY");
  process.exit(1);
}

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.post("/openai/realtime-webhook", async (req, res) => {
  const event = req.body;
  console.log("Webhook event:", JSON.stringify(event, null, 2));

  try {
    if (event?.type !== "realtime.call.incoming") {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const callId = event?.data?.call_id;
    if (!callId) {
      console.log("No call_id in webhook payload, ignoring");
      return res.status(200).json({ ok: true, ignored: "missing_call_id" });
    }

    const payload = {
      type: "realtime",
      model: "gpt-realtime",
      instructions: [
        "Ти голосовий оператор компанії.",
        "Говори українською, коротко і природно.",
        "Привітайся і скажи, що ти віртуальний оператор.",
        "Якщо клієнт питає про стан рахунку — скажи, що зараз перевіриш інформацію.",
        "Якщо не можеш допомогти — скажи, що з'єднаєш з менеджером.",
        "Не вигадуй інформацію."
      ].join(" "),
      output_modalities: ["audio"],
      audio: {
        input: {
          format: {
            type: "audio/pcma"
          },
          turn_detection: {
            type: "server_vad",
            create_response: true
          }
        },
        output: {
          format: {
            type: "audio/pcma"
          },
          voice: "alloy"
        }
      }
    };

    console.log("Accept payload:", JSON.stringify(payload, null, 2));

    const response = await fetch(
      `https://api.openai.com/v1/realtime/calls/${callId}/accept`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const text = await response.text();

    if (!response.ok) {
      console.error("Accept failed:", response.status, text);
      return res.status(500).json({
        ok: false,
        openai_status: response.status,
        openai_body: text
      });
    }

    console.log("Accept OK:", text);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
