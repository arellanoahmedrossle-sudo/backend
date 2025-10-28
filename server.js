import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import cors from "cors";
import QRCode from "qrcode";



dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("."));

app.post("/generate-qr", async (req, res) => {
  try {
    const { amount, description } = req.body;

    const response = await axios.post(
      "https://api.paymongo.com/v1/checkout_sessions",
      {
        data: {
          attributes: {
            send_email_receipt: false,
            show_description: true,
            show_line_items: true,
            description,
            line_items: [
              {
                name: "Order Payment",
                currency: "PHP",
                amount: amount * 100,
                quantity: 1,
              },
            ],
            payment_method_types: ["qrph"],
            success_url: "https://ssvm-njpa.onrender.com/payment-success",
            cancel_url: "https://ssvm-njpa.onrender.com/payment-cancel",
          },
        },
      },
      {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(process.env.PAYMONGO_SECRET_KEY + ":").toString("base64"),
          "Content-Type": "application/json",
        },
      }
    );

    const checkoutUrl = response.data.data.attributes.checkout_url;
    const checkoutSessionId = response.data.data.id;
    const qrCode = await QRCode.toDataURL(checkoutUrl);

    res.json({ checkoutUrl, qrCode, sessionId: checkoutSessionId });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Failed to generate QR" });
  }
});

app.get("/check-payment/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const response = await axios.get(
      `https://api.paymongo.com/v1/checkout_sessions/${sessionId}`,
      {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(process.env.PAYMONGO_SECRET_KEY + ":").toString("base64"),
        },
      }
    );

    const status = response.data.data.attributes.payment_intent?.attributes?.status || 'pending';
    res.json({ status });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Failed to check payment status" });
  }
});

app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const event = JSON.parse(req.body.toString());
    const eventType = event.data.attributes.type;

    if (eventType === "checkout_session.payment.paid") {
      const checkoutSession = event.data.attributes.data;
      console.log("✅ Payment successful!");
      console.log("Checkout Session ID:", checkoutSession.id);
      console.log("Amount:", checkoutSession.attributes.line_items[0].amount / 100, "PHP");
      console.log("Description:", checkoutSession.attributes.description);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook error:", error.message);
    res.sendStatus(400);
  }
});

app.get("/payment-success", (req, res) => {
  res.send(`
    <html>
      <head>
        <script>
          // Send message to parent window (Flutter app)
          if (window.parent) {
            window.parent.postMessage('payment_success', '*');
          }
          if (window.opener) {
            window.opener.postMessage('payment_success', '*');
          }
          setTimeout(() => {
            try {
              window.close();
            } catch(e) {
              console.log('Cannot close window');
            }
          }, 2000);
        </script>
      </head>
      <body style="font-family: Arial; text-align: center; padding: 50px;">
        <h1 style="color: green;">✅ Payment Successful!</h1>
        <p>Processing your order...</p>
      </body>
    </html>
  `);
});

app.get("/payment-cancel", (req, res) => {
  res.send(`
    <html>
      <head>
        <script>
          // Send message to parent window (Flutter app)
          if (window.parent) {
            window.parent.postMessage('payment_cancel', '*');
          }
          if (window.opener) {
            window.opener.postMessage('payment_cancel', '*');
          }
          setTimeout(() => {
            try {
              window.close();
            } catch(e) {
              console.log('Cannot close window');
            }
          }, 2000);
        </script>
      </head>
      <body style="font-family: Arial; text-align: center; padding: 50px;">
        <h1 style="color: orange;">⚠️ Payment Cancelled</h1>
        <p>Returning to store...</p>
        <br>
        <button onclick="window.parent.postMessage('payment_cancel', '*'); history.back();" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">Return to Store</button>
      </body>
    </html>
  `);
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
