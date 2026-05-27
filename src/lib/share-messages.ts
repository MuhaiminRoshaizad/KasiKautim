import { formatMYR } from "./money";

/*
 * WhatsApp `wa.me/?text=` deep link. No recipient — opens the contact picker.
 * encodeURIComponent on every interpolated piece (titles with `&` would break).
 */

export function whatsappShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function genericShareMessage(args: {
  title: string;
  link: string;
}): string {
  const { title, link } = args;
  return `Kasi kautim — *${title}*. Tap your name to settle.\n${link}`;
}

export function privateShareMessage(args: {
  name: string;
  title: string;
  amountCents: number;
  link: string;
  dueDate?: string | null;
}): string {
  const { name, title, amountCents, link, dueDate } = args;
  const amount = formatMYR(amountCents);
  const dueLine = dueDate ? `\nDue ${dueDate}.` : "";
  return `Hi ${name}! Your share for *${title}* — ${amount}.${dueLine}\nTap to settle.\n${link}`;
}

/**
 * Item-mode bills: the recipient's share is computed from what they tap,
 * so we don't have a fixed amount to put in the message.
 */
export function privateItemModeShareMessage(args: {
  name: string;
  title: string;
  link: string;
  dueDate?: string | null;
}): string {
  const { name, title, link, dueDate } = args;
  const dueLine = dueDate ? `\nDue ${dueDate}.` : "";
  return `Hi ${name}! Tap the items you ordered for *${title}* — we'll compute your share automatically.${dueLine}\n${link}`;
}
