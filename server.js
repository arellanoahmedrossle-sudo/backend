import express from "express";
import axios from "axios";
import QRCode from "qrcode";
import dotenv from "dotenv";
import cors from "cors";


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
            success_url: "https://yourdomain.com/success",
            cancel_url: "https://yourdomain.com/cancel",
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
    const qrCode = await QRCode.toDataURL(checkoutUrl);

    res.json({ checkoutUrl, qrCode });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Failed to generate QR" });
  }
});


app.listen(3000, () => console.log("Server running on http://localhost:3000"));