"use server";

import { headers } from "next/headers";
import { Resend } from "resend";
import { auth } from "@/utils/auth/server";

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? "support@lumium.app";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

export async function sendSupportEmail(payload: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  if (
    !payload ||
    typeof payload.name !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.subject !== "string" ||
    typeof payload.message !== "string"
  ) {
    return { success: false, error: "Invalid message." };
  }

  const name = payload.name.trim();
  const email = payload.email.trim();
  const subject = payload.subject.trim();
  const message = payload.message.trim();

  if (
    !name ||
    !email ||
    !subject ||
    !message ||
    name.length > 120 ||
    email.length > 254 ||
    subject.length > 200 ||
    message.length > 5000 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    /[\r\n]/.test(email) ||
    /[\r\n]/.test(subject)
  ) {
    return { success: false, error: "All fields are required." };
  }

  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("RESEND_API_KEY is not configured");
      return { success: false, error: "Support email is not configured." };
    }
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: "Lumium Support <onboarding@resend.dev>",
      to: [SUPPORT_EMAIL],
      replyTo: email,
      subject: `[Lumium Support] ${subject}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;padding:24px">
          <h2 style="margin:0 0 16px;color:#0f172a">New support message</h2>
          <table style="border-collapse:collapse;width:100%">
            <tr><td style="padding:8px 0;color:#64748b;font-size:13px;width:80px">From</td>
                <td style="padding:8px 0;font-size:14px;font-weight:600">${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;font-size:13px">Subject</td>
                <td style="padding:8px 0;font-size:14px;font-weight:600">${escapeHtml(subject)}</td></tr>
          </table>
          <hr style="margin:16px 0;border:none;border-top:1px solid #e2e8f0"/>
          <div style="white-space:pre-wrap;font-size:14px;line-height:1.6;color:#1e293b">${escapeHtml(message)}</div>
          <hr style="margin:16px 0;border:none;border-top:1px solid #e2e8f0"/>
          <p style="font-size:11px;color:#94a3b8">Sent via Lumium Help &amp; Support · lumium.app</p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error: error.message };
    }

    console.log("Email sent, id:", data?.id);
    return { success: true };
  } catch (err) {
    console.error("sendSupportEmail error:", err);
    return { success: false, error: "Failed to send. Please try again later." };
  }
}
