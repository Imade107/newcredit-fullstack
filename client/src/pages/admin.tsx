import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { naira, formatDate } from "@shared/loan";
import type { Application } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Check, X, ClipboardList, Hourglass, CircleCheck, CircleX } from "lucide-react";

type Filter = "all" | "pending" | "approved" | "rejected";

interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  pendingAmount: number;
  approvedAmount: number;
}

const statusStyle: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={statusStyle[status] ?? ""}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>
  );
}

export default function Admin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adminKey, setAdminKey] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [reviewTarget, setReviewTarget] = useState<Application | null>(null);
  const [decision, setDecision] = useState<"approved" | "rejected">("approved");
  const [note, setNote] = useState("");

  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/login", { key: adminKey });
      return res.json();
    },
    onSuccess: () => setUnlocked(true),
    onError: () =>
      toast({ title: "Invalid key", description: "That admin key is not correct.", variant: "destructive" }),
  });

  const appsQuery = useQuery<Application[]>({
    queryKey: ["/api/applications", "admin", adminKey],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/applications?key=${encodeURIComponent(adminKey)}`);
      return res.json();
    },
    enabled: unlocked,
  });

  const statsQuery = useQuery<Stats>({
    queryKey: ["/api/admin/stats", adminKey],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/stats?key=${encodeURIComponent(adminKey)}`);
      return res.json();
    },
    enabled: unlocked,
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!reviewTarget) throw new Error("No application selected");
      const res = await apiRequest(
        "POST",
        `/api/applications/${reviewTarget.id}/review?key=${encodeURIComponent(adminKey)}`,
        { decision, note },
      );
      return res.json();
    },
    onSuccess: (app: Application) => {
      toast({
        title: `Application #${app.id} ${app.status}`,
        description: `${app.fullName} has been notified of the decision.`,
      });
      setReviewTarget(null);
      setNote("");
      void queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
    onError: (err: Error) =>
      toast({ title: "Review failed", description: err.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    const apps = appsQuery.data ?? [];
    return filter === "all" ? apps : apps.filter((a) => a.status === filter);
  }, [appsQuery.data, filter]);

  /* ---------- Locked gate ---------- */
  if (!unlocked) {
    return (
      <div className="grid min-h-screen place-items-center bg-neutral-50 px-4">
        <Card className="w-full max-w-sm" data-testid="card-admin-gate">
          <CardHeader>
            <CardTitle className="text-xl">Admin panel</CardTitle>
            <CardDescription>Enter the admin key to review loan applications.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                loginMutation.mutate();
              }}
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="admin-key">Admin key</Label>
                <Input
                  id="admin-key"
                  data-testid="input-admin-key"
                  type="password"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <Button type="submit" disabled={loginMutation.isPending} data-testid="button-unlock">
                {loginMutation.isPending ? "Checking…" : "Unlock"}
              </Button>
              <Link href="/" className="self-center text-sm text-muted-foreground hover:underline">
                ← Back to applications
              </Link>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ---------- Unlocked panel ---------- */
  const stats = statsQuery.data;

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <ClipboardList className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-base font-bold leading-tight">Admin review panel</p>
              <p className="text-xs text-muted-foreground leading-tight">NewCredit demo</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/">
              <Button variant="outline" size="sm" data-testid="link-home">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Applicant view
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              data-testid="button-lock"
              onClick={() => {
                setUnlocked(false);
                setAdminKey("");
              }}
            >
              Lock
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="stats-grid">
          {[
            { label: "Pending", value: stats?.pending ?? "—", icon: Hourglass, tone: "text-amber-600", testId: "text-stat-pending" },
            { label: "Approved", value: stats?.approved ?? "—", icon: CircleCheck, tone: "text-emerald-600", testId: "text-stat-approved" },
            { label: "Rejected", value: stats?.rejected ?? "—", icon: CircleX, tone: "text-red-600", testId: "text-stat-rejected" },
            {
              label: "Approved volume",
              value: stats ? naira(stats.approvedAmount) : "—",
              icon: ClipboardList,
              tone: "text-primary",
              testId: "text-stat-approved-volume",
            },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="flex items-center gap-3 py-4">
                <s.icon className={`h-6 w-6 ${s.tone}`} aria-hidden="true" />
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-lg font-bold leading-tight" data-testid={s.testId}>
                    {s.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter + table */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-xl">Loan applications</CardTitle>
              <CardDescription>
                {filtered.length} of {appsQuery.data?.length ?? 0} shown
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
              {(["all", "pending", "approved", "rejected"] as Filter[]).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? "default" : "outline"}
                  data-testid={`button-filter-${f}`}
                  onClick={() => setFilter(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {appsQuery.isLoading && <p className="text-sm text-muted-foreground">Loading applications…</p>}
            {appsQuery.isError && (
              <p className="text-sm text-destructive">Failed to load applications. Try locking and unlocking again.</p>
            )}

            {filtered.length === 0 && !appsQuery.isLoading && (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground" data-testid="text-admin-empty">
                <p className="font-medium text-foreground">Nothing here yet</p>
                <p className="mt-1 text-sm">
                  Applications submitted from the applicant view appear here for review.
                </p>
              </div>
            )}

            {filtered.length > 0 && (
              <div className="overflow-x-auto">
                <Table data-testid="table-applications">
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Applicant</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>BVN</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Total due</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((app) => (
                      <TableRow key={app.id} data-testid={`row-app-${app.id}`}>
                        <TableCell className="font-mono text-xs">{app.id}</TableCell>
                        <TableCell className="font-medium">{app.fullName}</TableCell>
                        <TableCell className="font-mono text-xs">{app.phone}</TableCell>
                        <TableCell className="font-mono text-xs" data-testid={`text-bvn-${app.id}`}>
                          ••••••{app.bvn.slice(-4)}
                        </TableCell>
                        <TableCell className="text-right font-mono">{naira(app.amount)}</TableCell>
                        <TableCell className="text-right font-mono">{naira(app.totalDue)}</TableCell>
                        <TableCell>{app.termDays}d</TableCell>
                        <TableCell className="text-xs">{formatDate(app.dueDate)}</TableCell>
                        <TableCell>
                          <StatusBadge status={app.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          {app.status === "pending" ? (
                            <div className="flex justify-end gap-1.5">
                              <Button
                                size="sm"
                                data-testid={`button-approve-${app.id}`}
                                onClick={() => {
                                  setReviewTarget(app);
                                  setDecision("approved");
                                }}
                              >
                                <Check className="h-4 w-4" aria-hidden="true" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                data-testid={`button-reject-${app.id}`}
                                onClick={() => {
                                  setReviewTarget(app);
                                  setDecision("rejected");
                                }}
                              >
                                <X className="h-4 w-4" aria-hidden="true" />
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {app.reviewedAt ? formatDate(app.reviewedAt) : "—"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Review dialog */}
      <Dialog open={reviewTarget !== null} onOpenChange={(open) => !open && setReviewTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision === "approved" ? "Approve" : "Reject"} application
              {reviewTarget ? ` #${reviewTarget.id}` : ""}
            </DialogTitle>
            <DialogDescription>
              {reviewTarget
                ? `${reviewTarget.fullName} · ${naira(reviewTarget.amount)} over ${reviewTarget.termDays} days`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="review-note">Note (optional)</Label>
            <Textarea
              id="review-note"
              data-testid="input-review-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                decision === "approved"
                  ? "e.g. Approved at standard rate."
                  : "e.g. Insufficient transaction history."
              }
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReviewTarget(null)} data-testid="button-cancel-review">
              Cancel
            </Button>
            <Button
              variant={decision === "approved" ? "default" : "destructive"}
              disabled={reviewMutation.isPending}
              data-testid="button-confirm-review"
              onClick={() => reviewMutation.mutate()}
            >
              {reviewMutation.isPending
                ? "Saving…"
                : decision === "approved"
                  ? "Confirm approval"
                  : "Confirm rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
