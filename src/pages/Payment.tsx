import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "@/components/Header";
import Landing from "@/pages/Landing";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";

type ProviderCode = "MIDTRANS" | "DUITKU" | "PAKKASIR";
type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "CANCELED";

type PaymentOptionsResponse = {
  amount: number;
  productName: string;
  profile: {
    isPremium: boolean;
    premiumProvider?: ProviderCode | null;
    premiumSince?: string | null;
    premiumUntil?: string | null;
  } | null;
  providers: Array<{ code: ProviderCode; enabled: boolean }>;
};

type PaymentStatusResponse = {
  transaction: {
    id: string;
    provider: ProviderCode;
    status: PaymentStatus;
    orderId: string;
    amount: number;
    createdAt: string;
    paidAt?: string | null;
  } | null;
  profile: PaymentOptionsResponse["profile"];
};

const providerLabels: Record<ProviderCode, string> = {
  MIDTRANS: "Midtrans",
  DUITKU: "Duitku",
  PAKKASIR: "Pakkasir",
};

const Payment: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [isCreating, setIsCreating] = useState<ProviderCode | null>(null);
  const [options, setOptions] = useState<PaymentOptionsResponse | null>(null);
  const [latestStatus, setLatestStatus] = useState<PaymentStatusResponse["transaction"] | null>(null);

  const getAuthHeaders = useCallback(async () => {
    if (!user) throw new Error("Not authenticated");
    const token = await user.getIdToken(true);
    return { Authorization: `Bearer ${token}` };
  }, [user]);

  const fetchOptions = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/payments/options", { headers });
      if (!res.ok) throw new Error("Failed to load payment options");
      const data = (await res.json()) as PaymentOptionsResponse;
      setOptions(data);
    } catch (error) {
      console.error(error);
      toast.error(t("payment.errors.loadOptions"));
    } finally {
      setIsLoading(false);
    }
  }, [user, getAuthHeaders, t]);

  const checkStatus = useCallback(
    async (orderId?: string) => {
      if (!user) return;
      setIsChecking(true);
      try {
        const headers = await getAuthHeaders();
        const query = orderId ? `?orderId=${encodeURIComponent(orderId)}` : "";
        const res = await fetch(`/api/payments/status${query}`, { headers });
        if (!res.ok) throw new Error("Failed to check payment status");
        const data = (await res.json()) as PaymentStatusResponse;
        setLatestStatus(data.transaction);
        if (data.profile) {
          setOptions((prev) =>
            prev
              ? {
                  ...prev,
                  profile: data.profile,
                }
              : prev,
          );
        }
        if (data.transaction?.status === "PAID") {
          toast.success(t("payment.messages.paymentSuccess"));
        }
      } catch (error) {
        console.error(error);
        toast.error(t("payment.errors.checkStatus"));
      } finally {
        setIsChecking(false);
      }
    },
    [user, getAuthHeaders, t],
  );

  useEffect(() => {
    if (!user) return;
    void fetchOptions();
  }, [user, fetchOptions]);

  useEffect(() => {
    if (!user) return;
    const orderId = searchParams.get("orderId") ?? searchParams.get("merchantOrderId") ?? undefined;
    if (!orderId) return;
    void checkStatus(orderId);
  }, [user, searchParams, checkStatus]);

  const handleCreateCheckout = async (provider: ProviderCode) => {
    if (!user || isCreating) return;
    setIsCreating(provider);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      if (!res.ok) {
        const message = typeof data?.error === "string" ? data.error : t("payment.errors.createCheckout");
        throw new Error(message);
      }
      if (data.alreadyPremium) {
        toast.success(t("payment.messages.alreadyPremium"));
        await fetchOptions();
        return;
      }
      if (!data.checkoutUrl) throw new Error(t("payment.errors.createCheckout"));
      window.location.assign(data.checkoutUrl as string);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : t("payment.errors.createCheckout"));
    } finally {
      setIsCreating(null);
    }
  };

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language === "id" ? "id-ID" : "en-US", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }),
    [i18n.language],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-tv-body text-muted-foreground">{t("payment.loading")}</p>
      </div>
    );
  }

  if (!user) {
    return <Landing />;
  }

  const isPremium = Boolean(options?.profile?.isPremium);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 md:pt-28 lg:pt-32 pb-8 px-4">
        <div className="container mx-auto max-w-4xl space-y-6">
          <section className="bg-card border border-border rounded-2xl p-6 shadow-md">
            <h2 className="text-tv-subtitle font-semibold text-foreground">{t("payment.title")}</h2>
            <p className="text-tv-body text-muted-foreground mt-2">{t("payment.subtitle")}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-tv-small text-muted-foreground">{t("payment.planLabel")}</span>
              <span className="inline-flex rounded-full bg-primary/10 border border-primary/30 px-3 py-1 text-sm text-primary">
                {options?.productName || t("payment.planNameFallback")}
              </span>
              <span className="text-tv-body font-semibold text-foreground">
                {formatter.format(options?.amount ?? 0)}
              </span>
            </div>
            <div className="mt-4">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-sm border ${
                  isPremium
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                }`}
              >
                {isPremium ? t("payment.status.premiumActive") : t("payment.status.notPremium")}
              </span>
            </div>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6 shadow-md">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-tv-body font-semibold text-foreground">{t("payment.methodsTitle")}</h3>
              <Button variant="secondary" onClick={() => void checkStatus()} disabled={isChecking}>
                {isChecking ? t("payment.checking") : t("payment.checkStatus")}
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              {(options?.providers ?? []).map((provider) => (
                <div key={provider.code} className="border border-border rounded-xl p-4 bg-muted/20">
                  <p className="text-tv-body font-semibold text-foreground">
                    {providerLabels[provider.code]}
                  </p>
                  <p className="text-tv-small text-muted-foreground mt-2">
                    {provider.enabled ? t("payment.available") : t("payment.unavailable")}
                  </p>
                  <Button
                    className="w-full mt-4"
                    disabled={!provider.enabled || isPremium || Boolean(isCreating)}
                    onClick={() => void handleCreateCheckout(provider.code)}
                  >
                    {isCreating === provider.code ? t("payment.processing") : t("payment.payNow")}
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6 shadow-md">
            <h3 className="text-tv-body font-semibold text-foreground">{t("payment.latestTransaction")}</h3>
            {latestStatus ? (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-tv-small text-muted-foreground">{t("payment.orderId")}</p>
                  <p className="text-tv-body text-foreground">{latestStatus.orderId}</p>
                </div>
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-tv-small text-muted-foreground">{t("payment.transactionStatus")}</p>
                  <p className="text-tv-body text-foreground">{latestStatus.status}</p>
                </div>
              </div>
            ) : (
              <p className="text-tv-small text-muted-foreground mt-3">{t("payment.noTransaction")}</p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default Payment;

