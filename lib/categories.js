// The five shelves every piece of open work sits on, in the order Ankit reads them — in the
// brief, in *list* and on the board. One module decides, so the three can never disagree.
//
// A task stores its KIND (what the work is); its shelf follows from the kind and the owner:
//
//   kind "payment"  → 💰 Payment and recovery   code P12   (whoever it is with)
//   kind "meeting"  → 📅 Meetings ahead         code A12 / T12
//   kind "other"    → 🗂 Other tasks            code O12   (personal, travel, errands)
//   kind "work"     → 🙋 Open tasks on me       code A12   (Ankit's own)
//                   → 👥 Open tasks on team     code T12   (anyone else's)
//
// Meetings themselves (the meetings collection) are M-numbered and sit on 📅 too.
// The number in a code is always the task id, so a code stays unique, and any letter with the
// right number still finds the task if it changes shelf (T12 that became P12 still answers to T12).

export const CATEGORY_ORDER = ["meetings", "payment", "me", "team", "other"];

export const CATEGORY = {
  meetings: { label: "Meetings ahead", icon: "📅" },
  payment: { label: "Payment and recovery", icon: "💰" },
  me: { label: "Open tasks on me", icon: "🙋" },
  team: { label: "Open tasks on team", icon: "👥" },
  other: { label: "Other tasks", icon: "🗂" },
};

export const KINDS = ["work", "payment", "meeting", "other"];

// Words that make a task about money owed or received. Deliberately not bare "collect":
// "collect the Saltoris rejoinder" is a document, not a payment.
const PAYMENT_WORDS = /\b(payments?|payable|paid|pay|dues|outstanding|recover(y|ies|ed)?|receivables?|invoices?|invoiced|billing|bills?|fees?|refunds?|advance payment|cheques?|neft|rtgs|upi|emi|udhaa?r|paisa|paise|rupees?|rs\.?|inr|lakh|lac|crore|collections?|collect\w*\s+(the\s+)?(payment|dues|money|amount|fees?|cheque|balance)|follow ?up (on|for) (payment|dues))\b|₹/i;
const MEETING_WORDS = /\b(meeting|meet with|appointment|con-?call|zoom call|video call)\b/i;
const OTHER_WORDS = /\b(flight|train|tickets?|trip|travel|hotel|holiday|vacation|insurance|birthday|anniversary|family|wife|husband|son|daughter|kids?|school|doctor|dentist|gym|grocer(y|ies)|shopping|personal|home|house|car service|movie|dinner|party|wedding|gift)\b/i;

// The kind a task most likely is, from its words — used when the parser gave none, and for
// tasks created before categories existed.
export function guessKind(text) {
  const s = String(text || "");
  if (PAYMENT_WORDS.test(s)) return "payment";
  if (MEETING_WORDS.test(s)) return "meeting";
  if (OTHER_WORDS.test(s)) return "other";
  return "work";
}

// What Ankit types after a code to move a task to another shelf.
export function kindFromWord(word) {
  const w = String(word || "").toLowerCase();
  if (/^(payment|payments|recovery|money|dues|collection|collections|finance|billing|p)$/.test(w)) return "payment";
  if (/^(meeting|meetings|calendar)$/.test(w)) return "meeting";
  if (/^(other|others|personal|misc|o)$/.test(w)) return "other";
  if (/^(work|task|tasks|team|me|mine|office)$/.test(w)) return "work";
  return null;
}

// T12 / A12 / P12 / O12 (or #12) → 12. M-codes are meetings and are not matched here.
export const TASK_CODE = /^(?:[tapo]-?|#)(\d{1,6})$/i;
export const MEETING_CODE = /^m-?(\d{1,6})$/i;
