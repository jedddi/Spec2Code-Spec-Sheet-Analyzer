"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { LayoutBottomIcon } from "@hugeicons/core-free-icons";
import { LoginForm } from "@/components/login-form";
import { createBrowserSupabase } from "@/src/lib/supabase/client";

const LOGIN_VIDEO_SRC = "/loginpage_video.mp4";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    el.muted = true;
    el.defaultMuted = true;
    el.setAttribute("playsinline", "");
    el.setAttribute("webkit-playsinline", "true");

    const kickPlay = () => {
      void el.play().catch(() => {});
    };

    kickPlay();
    el.addEventListener("canplay", kickPlay);
    el.addEventListener("loadeddata", kickPlay);

    return () => {
      el.removeEventListener("canplay", kickPlay);
      el.removeEventListener("loadeddata", kickPlay);
    };
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (isSignUp) {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
      } else {
        setMessage("Check your email for a confirmation link, then sign in.");
        setIsSignUp(false);
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
      } else {
        router.push("/");
        router.refresh();
      }
    }

    setLoading(false);
  }

  return (
    <div className="grid min-h-svh grid-rows-1 lg:grid-cols-2">
      <div className="flex min-h-svh flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <HugeiconsIcon
                icon={LayoutBottomIcon}
                strokeWidth={2}
                className="size-4"
              />
            </div>
            Spec2Code
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm
              email={email}
              password={password}
              onEmailChange={setEmail}
              onPasswordChange={setPassword}
              onSubmit={handleSubmit}
              loading={loading}
              error={error}
              message={message}
              isSignUp={isSignUp}
              onToggleSignUp={() => {
                setIsSignUp((v) => !v);
                setError(null);
                setMessage(null);
              }}
            />
          </div>
        </div>
      </div>
      <div className="relative hidden min-h-svh w-full overflow-hidden bg-muted lg:block">
        <video
          ref={videoRef}
          className="absolute inset-0 z-0 h-full w-full min-h-full min-w-full object-cover dark:brightness-[0.55]"
          src={LOGIN_VIDEO_SRC}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-br from-primary/15 via-transparent to-background/25 dark:from-primary/20 dark:to-background/40"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 z-10 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,var(--border)_1px,transparent_0)] [background-size:24px_24px] dark:opacity-12"
          aria-hidden
        />
      </div>
    </div>
  );
}
