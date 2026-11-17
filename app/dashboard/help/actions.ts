"use server";

// Intentionally disabled at the server boundary, including direct action calls.
export async function sendSupportEmail(_payload: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) {
  void _payload;
  return { success: false, error: "EMAIL_DISABLED" };
}
