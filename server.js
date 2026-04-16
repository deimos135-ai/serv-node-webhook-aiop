import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: "2mb" }));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PORT = process.env.PORT || 3000;

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
    if (event?.type === "realtime.call.incoming") {
      const callId = event?.data?.call_id;
      if (!callId) {
        return res.status(400).json({ error: "Missing call_id" });
      }

      const acceptBody = {
        type: "realtime",
        model: "gpt-realtime",
        voice: "alloy",
        instructions: `
Ти голосовий оператор компанії.
Говори українською, коротко і природно.
Привітайся і скажи, що ти віртуальний оператор.
Якщо клієнт питає про стан рахунку — скажи, що зараз перевіриш.
Якщо не можеш відповісти — скажи, що з'єднаєш з менеджером.
Не вигадуй інформацію.
        `.trim()
      };

      const response = await fetch(
        `https://api.openai.com/v1/realtime/calls/${callId}/accept`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(acceptBody)
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
    }

    return res.status(200).json({ ok: true, ignored: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Listening on :${PORT}`);
});
