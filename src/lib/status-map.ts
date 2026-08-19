/**
 * Internal state → customer language (docs/UX.md G-12). Complete mapping —
 * every reachable state renders a defined customer text; internal names never
 * leak to the status page.
 */

export interface CustomerStatus {
  title: string;
  sub?: string;
  tone: "progress" | "action" | "done" | "problem";
}

export function requestStatusView(status: string): CustomerStatus {
  switch (status) {
    case "NEW":
    case "NEEDS_REVIEW":
      return { title: "קיבלנו! אנחנו על זה", sub: "רן עובר על הפרטים וחוזר אליכם עם מחיר וזמן", tone: "progress" };
    case "NEEDS_CUSTOMER_INFO":
      return { title: "חסר לנו פרט קטן", sub: "תציצו בהודעה ששלחנו", tone: "action" };
    case "READY_TO_BOOK":
      return { title: "יש לנו הצעה בשבילכם", sub: "בחרו זמן שנוח לכם", tone: "action" };
    case "CONVERTED_TO_JOB":
      return { title: "נקבע", tone: "progress" };
    case "OUT_OF_SCOPE":
      return { title: "כאן אנחנו עוד לא", sub: "נעדכן כשנתחיל לטפל גם בזה", tone: "problem" };
    case "WORKSHOP_REQUIRED":
      return { title: "זו עבודת סדנה", sub: "רן ייצור קשר לתאם פתרון", tone: "action" };
    case "CANCELLED":
      return { title: "הבקשה בוטלה", tone: "problem" };
    default:
      return { title: "קיבלנו", tone: "progress" };
  }
}

export function jobStatusView(status: string): CustomerStatus {
  switch (status) {
    case "DRAFT":
      return { title: "קיבלנו! אנחנו על זה", tone: "progress" };
    case "SCHEDULED":
      return { title: "נקבע", sub: "נשלח תזכורת לפני שנצא", tone: "progress" };
    case "EN_ROUTE":
      return { title: "רן בדרך אליכם", tone: "progress" };
    case "ARRIVED":
    case "INSPECTION":
      return { title: "הגענו · בודקים את האופניים", tone: "progress" };
    case "AWAITING_APPROVAL":
      return { title: "מצאנו משהו — מחכה לאישור שלכם", sub: "תציצו למטה ותחליטו", tone: "action" };
    case "IN_SERVICE":
    case "FINAL_SAFETY_CHECK":
      return { title: "עובדים על זה", tone: "progress" };
    case "PAYMENT_PENDING":
      return { title: "סיימנו — סוגרים חשבון", tone: "progress" };
    case "COMPLETED":
      return { title: "מוכן לרכיבה 🤘", tone: "done" };
    case "UNRESOLVED":
      return { title: "לא הסתדר הפעם", sub: "דברו איתנו ונסגור את זה", tone: "problem" };
    case "CANCELLED":
      return { title: "הביקור בוטל", tone: "problem" };
    default:
      return { title: "בתהליך", tone: "progress" };
  }
}

/** Ordered milestones for the visual timeline. */
export const JOB_TIMELINE: Array<{ statuses: string[]; label: string }> = [
  { statuses: ["DRAFT", "SCHEDULED"], label: "נקבע" },
  { statuses: ["EN_ROUTE"], label: "רן בדרך" },
  { statuses: ["ARRIVED", "INSPECTION", "AWAITING_APPROVAL"], label: "בודקים" },
  { statuses: ["IN_SERVICE", "FINAL_SAFETY_CHECK", "PAYMENT_PENDING"], label: "עובדים על זה" },
  { statuses: ["COMPLETED"], label: "מוכן לרכיבה" },
];
