// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import { AppShell, Badge, Button, ErrorState, PermissionState, SignInPage, Skeleton, type NavItem } from "@junctura/health-ui";
import { ClipboardCheck, Eye, Home, Settings as Cog, Siren, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Access } from "./Access";
import { ApiError, getConfig, getMe } from "./api";
import { buildLogoutUrl, clearSession, completeLogin, loadSession, startLogin } from "./auth";
import { Consents } from "./Consents";
import { Emergency } from "./Emergency";
import { Landing } from "./Landing";
import { Overview } from "./Overview";
import { Profile } from "./Profile";
import { navigate, useLocation } from "./router";
import { NotFound, SessionProvider } from "./session";
import { Settings } from "./Settings";
import type { Me, PublicConfig } from "./types";

type State =
  | { kind: "loading" }
  | { kind: "signed-out"; message?: string }
  | { kind: "forbidden" }
  | { kind: "ready"; me: Me }
  | { kind: "error" };

const icon = (Icon: typeof Home) => <Icon aria-hidden className="size-5" />;
export const NAV: NavItem[] = [
  { id: "/", label: "Tổng quan", icon: icon(Home) },
  { id: "/dong-thuan", label: "Đồng thuận", icon: icon(ClipboardCheck) },
  { id: "/ai-da-xem", label: "Ai đã xem", icon: icon(Eye) },
  { id: "/cap-cuu", label: "Cấp cứu", icon: icon(Siren) },
  { id: "/thong-tin", label: "Của tôi", icon: icon(UserRound) },
  { id: "/cai-dat", label: "Cài đặt", icon: icon(Cog) },
];

export const currentNav = (path: string) => NAV.find(item => item.id === path)?.id ?? "";

export function App() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [state, setState] = useState<State>({ kind: "loading" });
  const { path } = useLocation();
  const settings = useMemo(() => (config ? { issuer: config.issuer, clientId: config.clientId } : null), [config]);
  const expire = useCallback(() => { clearSession(); setState({ kind: "signed-out", message: "Phiên đăng nhập đã hết hạn." }); }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await getConfig();
        if (cancelled) return;
        setConfig(loaded);
        const oidc = { issuer: loaded.issuer, clientId: loaded.clientId };
        let signedIn = loadSession() !== null;
        if (location.search.includes("code=") || location.search.includes("error=")) {
          try {
            signedIn = (await completeLogin(oidc, location.search)) !== null;
          } catch {
            history.replaceState(null, "", "/");
            return setState({ kind: "signed-out", message: "Đăng nhập không thành công. Hãy thử lại." });
          }
          history.replaceState(null, "", "/");
        }
        if (!signedIn) return setState({ kind: "signed-out" });
        setState({ kind: "ready", me: await getMe(oidc) });
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 403) setState({ kind: "forbidden" });
        else if (error instanceof ApiError && error.status === 401) { clearSession(); setState({ kind: "signed-out" }); }
        else setState({ kind: "error" });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const signOut = () => {
    if (!settings) return;
    const idToken = loadSession()?.idToken;
    clearSession();
    location.assign(buildLogoutUrl(settings, `${location.origin}/`, idToken));
  };

  if (state.kind === "loading") return <div className="mx-auto max-w-3xl p-8"><Skeleton lines={4} /></div>;
  if (state.kind === "error") return <div className="mx-auto max-w-xl p-8"><ErrorState onRetry={() => location.reload()}>Không kết nối được máy chủ MyHealth hoặc Junctura. Thử lại sau.</ErrorState></div>;
  if (state.kind === "forbidden") {
    return <div className="mx-auto max-w-xl space-y-4 p-8"><PermissionState>Tài khoản này không phải tài khoản người bệnh nên không dùng được MyHealth.</PermissionState><Button variant="secondary" onClick={signOut}>Đăng xuất</Button></div>;
  }
  if (state.kind === "signed-out") {
    const signIn = () => settings && startLogin(settings);
    if (state.message) {
      return <SignInPage product="MyHealth" subtitle="Đăng nhập bằng tài khoản Junctura của bạn." onSignIn={signIn} onBack={() => navigate("/")} message={state.message}
        note="Mật khẩu chỉ nhập trên trang của Junctura." />;
    }
    return <Landing onSignIn={signIn} />;
  }

  let page;
  if (path === "/") page = <Overview />;
  else if (path === "/dong-thuan") page = <Consents />;
  else if (path === "/ai-da-xem") page = <Access />;
  else if (path === "/cap-cuu") page = <Emergency />;
  else if (path === "/thong-tin") page = <Profile />;
  else if (path === "/cai-dat") page = <Settings />;
  else page = <NotFound />;

  return (
    <SessionProvider value={{ settings: settings!, me: state.me, expire }}>
      <AppShell product="MyHealth" nav={NAV} current={currentNav(path)} onNavigate={navigate}
        status={<Badge tone="neutral">Bản demo · dữ liệu giả lập</Badge>}
        user={{ name: state.me.displayName, role: "Người bệnh" }} onSignOut={signOut}>
        {page}
      </AppShell>
    </SessionProvider>
  );
}
