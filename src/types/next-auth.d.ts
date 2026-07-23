import "next-auth";
import { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface User {
    role: UserRole;
    schoolId?: string | null;
    studentId?: string | null;
    teacherId?: string | null;
    parentId?: string | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string | null;
      role: UserRole;
      schoolId?: string | null;
      studentId?: string | null;
      teacherId?: string | null;
      parentId?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    schoolId?: string | null;
    studentId?: string | null;
    teacherId?: string | null;
    parentId?: string | null;
  }
}
