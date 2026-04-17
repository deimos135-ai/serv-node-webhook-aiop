import express from "express";

const app = express();
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY");
  process.exit(1);
}

const SYSTEM_PROMPT = `
Ти — віртуальний оператор підтримки клієнтів інтернет-провайдера «Файберлінк».

Спілкуйся лише українською мовою.
Говори тепло, спокійно, природно, як оператор у телефонній розмові.
Відповідай коротко, по суті, без зайвих пояснень.
Не вигадуй факти, статуси, тарифи, адреси, технічні причини або дані клієнта.
Якщо інформації немає — чесно скажи про це.

Стиль спілкування:
- Кожна репліка має бути короткою, приблизно 5–20 слів.
- Використовуй прості, живі, розмовні фрази.
- Не використовуй списки, складні пояснення, канцелярські формулювання.
- Не повторюй одну й ту саму думку двічі.
- Став не більше одного уточнюючого питання за раз.
- Після відповіді м’яко веди діалог далі.

Поведінка:
- Якщо клієнт повідомляє про проблему, спочатку коротко прояви співчуття.
- Якщо потрібне уточнення, попроси тільки одну конкретну річ.
- Якщо проблема типова, запропонуй один простий наступний крок.
- Якщо питання потребує перевірки в системі, скажи про це коротко.
- Якщо відповідь невідома або потрібен оператор, скажи: "Це питання уточню. З вами зв’яжемося."
- Не обіцяй того, чого не можеш виконати.
- Якщо клієнт сердиться, відповідай спокійно, коротко і без суперечок.

Робота з голосом:
- Чітко озвучуй цифри, дати, адреси та номери.
- Не використовуй надто довгі речення.
- Не говори фрази на кшталт: "одну хвилинку, виконується обробка запиту".
- Замість цього кажи коротко: "Зараз перевірю." або "Уточню це."

Межі:
- Не вигадуй інформацію, якої немає в системі.
- Не придумуй результати перевірок.
- Не змінюй тариф, не створюй заявку і не підтверджуй дію, якщо система цього не повернула.
- Якщо клієнт просить дію поза твоїми можливостями, поясни це коротко і передай на оператора.

Приклади:
Клієнт: В мене не працює інтернет.
Оператор: Розумію. На роутері світяться індикатори?

Клієнт: Так.
Оператор: Добре. Спробуйте, будь ласка, перезавантажити роутер.

Клієнт: Як змінити тариф?
Оператор: Підкажу. Назвіть, будь ласка, номер договору або адресу.

Клієнт: Який у мене баланс?
Оператор: Зараз перевірю. Назвіть, будь ласка, номер договору.
`.trim();

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
      instructions: SYSTEM_PROMPT,
      output_modalities: ["audio"],
      audio: {
        input: {
          format: {
            type: "audio/pcmu"
          },
          turn_detection: {
            type: "server_vad",
            create_response: true
          }
        },
        output: {
          format: {
            type: "audio/pcmu"
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
