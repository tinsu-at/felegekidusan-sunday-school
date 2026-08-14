/**
 * Registration confirmation email to the school inbox.
 *
 * Sending real email requires a verified sender domain for this project.
 * Until that is set up, this helper reports `email_not_configured` instead of
 * pretending an email was sent. Nothing here reads or logs credentials.
 */

export type RegistrationEmailInput = {
  registrationId: string;
  fullName: string;
  christianName: string;
  gender: string;
  birthDateEc: string;
  motherName: string;
  fatherName: string;
  createdAt: string;
};

export type RegistrationEmailResult =
  | { sent: true }
  | { sent: false; reason: "email_not_configured" | "no_recipient" | "send_failed" };

export function buildRegistrationEmail(input: RegistrationEmailInput) {
  const subject = `ሰንበት ት/ቤት Registration Confirmation - ${input.registrationId}`;
  const lines = [
    `Registration ID: ${input.registrationId}`,
    `Student full name: ${input.fullName}`,
    `Christian name: ${input.christianName}`,
    `Gender: ${input.gender}`,
    `Birth date (Ethiopian calendar): ${input.birthDateEc}`,
    `Mother's name: ${input.motherName}`,
    `Father's name: ${input.fatherName}`,
    `Registration date: ${new Date(input.createdAt).toISOString().slice(0, 10)}`,
    "",
    "Contact information:",
    "Public Relations - Betlehem Alem - 0977966450",
    "Education Department - Deacon Tinsae Tsegaye - 0902872151",
  ];
  return { subject, text: lines.join("\n") };
}

export async function sendRegistrationEmail(
  input: RegistrationEmailInput,
): Promise<RegistrationEmailResult> {
  const to = process.env["SCHOOL_NOTIFICATION_EMAIL"];
  if (!to) return { sent: false, reason: "no_recipient" };

  // The managed email templates/helper are generated once a verified sender
  // domain exists for the project. Until then there is no real send path.
  const senderDomain = process.env["EMAIL_SENDER_DOMAIN"];
  if (!senderDomain) {
    console.warn(
      `Registration ${input.registrationId}: confirmation email skipped — sender domain not configured`,
    );
    return { sent: false, reason: "email_not_configured" };
  }

  try {
    const { sendTemplateEmail } = await import(
      /* @vite-ignore */ "@/lib/email-templates/send-email"
    );
    const result = await (
      sendTemplateEmail as (
        template: string,
        to: string,
        opts: { templateData: Record<string, unknown>; idempotencyKey: string },
      ) => Promise<{ sent: boolean }>
    )("registration-confirmation", to, {
      templateData: { ...input },
      idempotencyKey: `registration-confirmation-${input.registrationId}`,
    });
    return result.sent ? { sent: true } : { sent: false, reason: "send_failed" };
  } catch {
    console.error(
      `Registration ${input.registrationId}: confirmation email send failed`,
    );
    return { sent: false, reason: "send_failed" };
  }
}
