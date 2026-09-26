import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import ChatWindow from "@/components/chat/ChatWindow";
import { auth } from "@/lib/auth";
import {
  PUBLIC_SESSION_COOKIE_NAME,
  verifyPublicSessionCookieValue
} from "@/lib/public-session";
import {
  createAppSession,
  findEmptyActiveSession,
  getSessionById,
  isSessionActive
} from "@/lib/session";

type PageProps = {
  searchParams: Promise<{ sid?: string }>;
};

const PUBLIC_BOOTSTRAP_PATH = "/api/session/public/bootstrap" as any;

export default async function ChatPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sidFromUrl = typeof params.sid === "string" ? params.sid : "";

  const signedIn = await auth();

  /* ── Signed-in user: active session ─────────────────────────── */
  if (signedIn?.sessionId && (await isSessionActive(signedIn.sessionId))) {
    if (sidFromUrl !== signedIn.sessionId) {
      redirect(`/chat?sid=${signedIn.sessionId}`);
    }

    const appSession = await getSessionById(signedIn.sessionId);
    if (!appSession || appSession.terminatedAt) {
      redirect("/login");
    }

    return (
      <ChatWindow
        sessionId={signedIn.sessionId}
        initialPersistent={appSession.persistent}
        initialExpiresAt={appSession.expiresAt.toISOString()}
        showSessionControls
      />
    );
  }

  /* ── Signed-in user: session terminated/expired → create new ─ */
  if (signedIn?.sessionId) {
    const oldSession = await getSessionById(signedIn.sessionId);
    if (oldSession) {
      /* If URL already points to a valid active session for this user, render it */
      if (sidFromUrl) {
        const urlSession = await getSessionById(sidFromUrl);
        if (urlSession && !urlSession.terminatedAt && urlSession.userId === oldSession.userId && urlSession.expiresAt.getTime() > Date.now()) {
          return (
            <ChatWindow
              sessionId={urlSession.id}
              initialPersistent={urlSession.persistent}
              initialExpiresAt={urlSession.expiresAt.toISOString()}
              showSessionControls
            />
          );
        }
      }
      const existing = await findEmptyActiveSession(oldSession.userId);
      const fresh = existing ?? await createAppSession(oldSession.userId, true);
      redirect(`/chat?sid=${fresh.id}`);
    }
  }

  const cookieStore = await cookies();
  const publicSessionId = verifyPublicSessionCookieValue(
    cookieStore.get(PUBLIC_SESSION_COOKIE_NAME)?.value
  );

  if (!publicSessionId || !(await isSessionActive(publicSessionId))) {
    redirect(PUBLIC_BOOTSTRAP_PATH);
  }

  if (sidFromUrl !== publicSessionId) {
    redirect(`/chat?sid=${publicSessionId}`);
  }

  const appSession = await getSessionById(publicSessionId);
  if (!appSession || appSession.terminatedAt) {
    redirect(PUBLIC_BOOTSTRAP_PATH);
  }

  return (
    <ChatWindow
      sessionId={publicSessionId}
      initialPersistent={appSession.persistent}
      initialExpiresAt={appSession.expiresAt.toISOString()}
      showSessionControls
    />
  );
}
