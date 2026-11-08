import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TERMS, computeLoan, naira, formatDate, MIN_AMOUNT, MAX_AMOUNT } from "@shared/loan";
import type { Application } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Lock, Search } from "lucide-react";

const statusStyle: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={statusStyle[status] ?? ""} data-testid={`badge-status-${status}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export default function Home() {
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [bvn, setBvn] = useState("");
  const [amount, setAmount] = useState(50_000);
  const [termDays, setTermDays] = useState(180);
  const [trackPhone, setTrackPhone] = useState("");

  const figures = useMemo(() => computeLoan(amount, termDays), [amount, termDays]);

  const applyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/applications", {
        fullName,
        phone,
        bvn,
        amount,
        termDays,
      });
      return res.json();
    },
    onSuccess: (app: Application) => {
      toast({
        title: "Application submitted",
        description: `Reference #${app.id}. Track it below with your phone number.`,
      });
      setTrackPhone(phone.replace(/\D/g, ""));
      queryClientRefetch();
    },
    onError: (err: Error) => {
      toast({ title: "Could not submit", description: err.message, variant: "destructive" });
    },
  });

  const trackQuery = useQuery<Application[]>({
    queryKey: ["/api/applications", { phone: trackPhone }],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/applications?phone=${encodeURIComponent(trackPhone.replace(/\D/g, ""))}`,
      );
      return res.json();
    },
    enabled: false, // run only on explicit submit
  });

  function queryClientRefetch() {
    if (trackPhone.replace(/\D/g, "").length === 11) {
      void trackQuery.refetch();
    }
  }

  function submitApply(e: React.FormEvent) {
    e.preventDefault();
    applyMutation.mutate();
  }

  function submitTrack(e: React.FormEvent) {
    e.preventDefault();
    if (trackPhone.replace(/\D/g, "").length === 11) void trackQuery.refetch();
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-base font-bold leading-tight">NewCredit</p>
              <p className="text-xs text-muted-foreground leading-tight">Loan applications</p>
            </div>
          </div>
          <Link href="/admin">
            <Button variant="outline" size="sm" data-testid="link-admin">
              <Lock className="h-4 w-4" aria-hidden="true" />
              Admin
            </Button>
          </Link>
        </div>
      </header>

      <div className="bg-neutral-900 px-4 py-2 text-center text-xs text-neutral-300">
        Demo project — no real loans are issued, no data leaves this server.
      </div>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-7">
        {/* Apply */}
        <Card className="lg:col-span-4" data-testid="card-apply">
          <CardHeader>
            <CardTitle className="text-xl">Apply for a loan</CardTitle>
            <CardDescription>
              ₦{MIN_AMOUNT.toLocaleString()} – ₦{MAX_AMOUNT.toLocaleString()}, repaid over 91–365 days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitApply} className="flex flex-col gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    data-testid="input-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ada Obi"
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="phone">Phone number</Label>
                  <Input
                    id="phone"
                    data-testid="input-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="08012345678"
                    inputMode="numeric"
                    required
                  />
                </div>
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor="bvn">BVN</Label>
                  <Input
                    id="bvn"
                    data-testid="input-bvn"
                    value={bvn}
                    onChange={(e) => setBvn(e.target.value)}
                    placeholder="22200001111"
                    inputMode="numeric"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Demo only — nothing is verified. Test BVN: <span className="font-mono">22200001111</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="amount">Loan amount</Label>
                  <span className="font-mono text-lg font-bold text-primary" data-testid="text-amount">
                    {naira(amount)}
                  </span>
                </div>
                <Slider
                  id="amount"
                  data-testid="slider-amount"
                  value={[amount]}
                  min={MIN_AMOUNT}
                  max={MAX_AMOUNT}
                  step={5_000}
                  onValueChange={(v) => setAmount(v[0])}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>₦10k</span>
                  <span>₦300k</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Repayment term</Label>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Loan term">
                  {TERMS.map((t) => (
                    <Button
                      key={t.days}
                      type="button"
                      variant={termDays === t.days ? "default" : "outline"}
                      size="sm"
                      data-testid={`button-term-${t.days}`}
                      onClick={() => setTermDays(t.days)}
                    >
                      {t.days} days
                    </Button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border bg-neutral-50 p-4 text-sm">
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">Monthly interest</span>
                  <span className="font-mono" data-testid="text-rate">
                    {(figures.monthlyRate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">Total interest</span>
                  <span className="font-mono" data-testid="text-interest">
                    {naira(figures.interest)}
                  </span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">Monthly payment</span>
                  <span className="font-mono" data-testid="text-monthly">
                    {naira(figures.monthly)}
                  </span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-semibold">
                  <span>Total repayment</span>
                  <span className="font-mono text-primary" data-testid="text-total">
                    {naira(figures.total)}
                  </span>
                </div>
                <div className="flex justify-between py-0.5 text-xs text-muted-foreground">
                  <span>Due date</span>
                  <span className="font-mono" data-testid="text-due">
                    {formatDate(figures.dueDate)}
                  </span>
                </div>
              </div>

              <Button type="submit" disabled={applyMutation.isPending} data-testid="button-submit">
                {applyMutation.isPending ? "Submitting…" : "Submit application"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Track */}
        <Card className="lg:col-span-3 self-start" data-testid="card-track">
          <CardHeader>
            <CardTitle className="text-xl">Track your applications</CardTitle>
            <CardDescription>Enter the phone number you applied with.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form onSubmit={submitTrack} className="flex gap-2">
              <Input
                data-testid="input-track-phone"
                value={trackPhone}
                onChange={(e) => setTrackPhone(e.target.value)}
                placeholder="08012345678"
                inputMode="numeric"
              />
              <Button type="submit" variant="secondary" data-testid="button-track">
                <Search className="h-4 w-4" aria-hidden="true" />
                Check
              </Button>
            </form>

            {trackQuery.isError && (
              <p className="text-sm text-destructive" data-testid="text-track-error">
                Could not load applications. Check the number and try again.
              </p>
            )}

            {trackQuery.data && trackQuery.data.length === 0 && (
              <p className="text-sm text-muted-foreground" data-testid="text-track-empty">
                No applications found for this number yet.
              </p>
            )}

            <div className="flex flex-col gap-3" data-testid="list-my-applications">
              {trackQuery.data?.map((app) => (
                <div key={app.id} className="rounded-lg border p-3" data-testid={`card-my-app-${app.id}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-bold">{naira(app.amount)}</span>
                    <StatusBadge status={app.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    #{app.id} · {app.termDays} days · due {formatDate(app.dueDate)}
                  </p>
                  {app.reviewNote && (
                    <p className="mt-1 text-xs italic text-muted-foreground">“{app.reviewNote}”</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
