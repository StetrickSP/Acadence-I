import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, ArrowRight, Loader2, AlertCircle } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const apiBase = `${BASE_URL}/api`;

export default function Claim() {
  const { user } = useUser();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBase}/me/claim`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: studentId.trim().toUpperCase() }),
      });

      if (res.ok) {
        // Invalidate identity cache so DashboardOrPortal re-resolves as student
        await queryClient.invalidateQueries({ queryKey: ["me/profile"] });
        navigate("/dashboard");
        return;
      }

      const body = await res.json().catch(() => ({}));
      if (res.status === 404) {
        setError("No student record found with that ID. Double-check and try again.");
      } else if (res.status === 409) {
        setError("That student ID is already linked to another account. Contact your administrator.");
      } else {
        setError(body?.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        <span className="text-lg font-bold text-gray-900">Grade Tracker</span>
      </div>

      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-bold">Claim your student account</CardTitle>
          <CardDescription>
            Enter your Student ID to link your login to your student record. You only need to do this once.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {user && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border mb-6">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                {user.firstName?.[0] ?? user.emailAddresses[0]?.emailAddress[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.fullName ?? "Signed in"}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user.primaryEmailAddress?.emailAddress}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleClaim} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="studentId">Student ID</Label>
              <Input
                id="studentId"
                placeholder="e.g. S001"
                value={studentId}
                onChange={(e) => {
                  setStudentId(e.target.value);
                  setError(null);
                }}
                disabled={loading}
                autoFocus
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Your Student ID was provided by your institution (e.g. S001, S002…).
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || !studentId.trim()}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Linking account…
                </>
              ) : (
                <>
                  Link my account
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t text-center text-xs text-muted-foreground space-y-1">
            <p>Not a student?</p>
            <a
              href={`${BASE_URL}/dashboard`}
              className="text-primary hover:underline font-medium"
            >
              Continue as administrator →
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
