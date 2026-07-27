import { useUser } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const apiBase = `${BASE_URL}/api`;

export type StudentIdentity = {
  id: number;
  name: string;
  email: string;
  studentId: string;
  year: number;
  major: string;
  role: "student";
};

export type IdentityResult =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "error" }      // fetch failed — fail closed, deny all privileged routes
  | { status: "admin" }      // explicit 403 with isAdmin:true from backend
  | { status: "student"; profile: StudentIdentity };

/**
 * Resolve the signed-in Clerk user's role by calling /api/me/profile.
 *
 * Role is determined ONLY by explicit positive signals:
 *   - 200 + JSON body → student
 *   - 403 with { isAdmin: true } → admin
 * Any other outcome (network failure, 5xx, unexpected shape) → "error",
 * which causes privileged routes to deny access rather than fall back to admin.
 */
export function useStudentIdentity(): IdentityResult {
  const { isLoaded, isSignedIn } = useUser();

  const { data, isLoading, isError } = useQuery<
    { kind: "student"; profile: StudentIdentity } | { kind: "admin" }
  >({
    queryKey: ["me/profile"],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/me/profile`, { credentials: "include" });

      if (res.ok) {
        const body = await res.json();
        // Validate that the response looks like a student profile
        if (body && typeof body.id === "number" && body.role === "student") {
          return { kind: "student", profile: body as StudentIdentity };
        }
        // Unexpected 2xx body — fail closed
        throw new Error("Unexpected profile response shape");
      }

      if (res.status === 403) {
        // Backend explicitly says: signed-in but no student record → admin
        const body = await res.json().catch(() => ({}));
        if (body?.isAdmin === true) {
          return { kind: "admin" };
        }
      }

      // 401, 5xx, or unexpected status — throw so react-query sets isError
      throw new Error(`Profile request failed: ${res.status}`);
    },
    enabled: isLoaded && !!isSignedIn,
    // Never retry admin-signal or student-signal responses; retry transient errors twice
    retry: (failureCount, _error) => failureCount < 2,
    staleTime: 60_000,
  });

  if (!isLoaded || (isSignedIn && isLoading)) return { status: "loading" };
  if (!isSignedIn) return { status: "unauthenticated" };

  // Any fetch/parse failure → error (fail closed)
  if (isError || !data) return { status: "error" };

  if (data.kind === "admin") return { status: "admin" };
  return { status: "student", profile: data.profile };
}
