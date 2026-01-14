export interface Member {
  id: string;
  name: string;
  status: "active" | "alert" | "suspended" | "unknown";
  memberNumber: string;
  householdId?: string;
}

export interface Produce {
  id: string;
  name: string;
  price: string;
  priceUnit: "per pound" | "each" | "unknown";
  organic: boolean;
  growingPractice: string;
  origin: string;
}

export interface Shift {
  id: string;
  date: string;
  time: string;
  squad: string;
  location: string;
  status: "scheduled" | "available" | "completed" | "missed";
}

export interface AuthSession {
  authenticated: boolean;
  member?: Member;
  cookies?: string;
  expiresAt?: number;
}
