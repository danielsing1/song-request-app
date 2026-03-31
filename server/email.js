const nodemailer = require("nodemailer");

let transporter = null;

function init() {
  const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } = process.env;

  if (!EMAIL_USER || !EMAIL_PASS) {
    console.warn(
      "⚠  Email credentials not configured — notifications disabled.\n" +
      "   Set EMAIL_USER and EMAIL_PASS in .env to enable."
    );
    return;
  }

  transporter = nodemailer.createTransport({
    host: EMAIL_HOST || "smtp.gmail.com",
    port: Number(EMAIL_PORT) || 587,
    secure: false,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  });

  transporter.verify((err) => {
    if (err) console.error("✗ Email transport verification failed:", err.message);
    else console.log("✓ Email notifications active");
  });
}

async function sendRequestNotification({ title, artist, requester, timestamp }) {
  if (!transporter) return;

  const to = process.env.EMAIL_TO || process.env.EMAIL_USER;
  const time = new Date(timestamp).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  try {
    await transporter.sendMail({
      from: `"GigRequest" <${process.env.EMAIL_USER}>`,
      to,
      subject: `🎵 Song Request: ${title} — ${artist}`,
      text: [
        `New song request!`,
        ``,
        `Song:      ${title}`,
        `Artist:    ${artist}`,
        `Requested: ${requester}`,
        `Time:      ${time}`,
      ].join("\n"),
      html: `
        <div style="font-family:sans-serif;max-width:480px">
          <h2 style="margin:0 0 12px;color:#1a1a2e">🎵 New Song Request</h2>
          <table style="border-collapse:collapse;width:100%">
            <tr><td style="padding:6px 12px;color:#666">Song</td>
                <td style="padding:6px 12px;font-weight:600">${title}</td></tr>
            <tr style="background:#f8f8fc"><td style="padding:6px 12px;color:#666">Artist</td>
                <td style="padding:6px 12px;font-weight:600">${artist}</td></tr>
            <tr><td style="padding:6px 12px;color:#666">From</td>
                <td style="padding:6px 12px;font-weight:600">${requester}</td></tr>
            <tr style="background:#f8f8fc"><td style="padding:6px 12px;color:#666">Time</td>
                <td style="padding:6px 12px">${time}</td></tr>
          </table>
        </div>`,
    });
    console.log(`  ✉ Email sent for "${title}"`);
  } catch (err) {
    console.error("  ✗ Email send failed:", err.message);
  }
}

module.exports = { init, sendRequestNotification };
