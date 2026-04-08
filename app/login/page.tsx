"use client";

import { FormEvent, Suspense, lazy, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/src/lib/supabase/client";
import { LoginV2Form } from "@/components/ui/login-v2-form";

const Spline = lazy(() => import("@splinetool/react-spline"));

const SPLINE_SCENE_URL =
  "https://prod.spline.design/iHbk9P8RmnBW-3C2/scene.splinecode";

export default function LoginPage() {
  const [sceneLoaded, setSceneLoaded] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createBrowserSupabase();

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
    <div className="login-v2-root">
      {/* Loading overlay — fades out once Spline scene is ready */}
      <div
        className={`login-v2-loader ${sceneLoaded ? "login-v2-loader--hidden" : ""}`}
        aria-hidden={sceneLoaded}
      >
        <div className="login-v2-spinner" />
        <p className="login-v2-loader-text">Loading 3D Scene…</p>
      </div>

      {/* Spline 3D background */}
      <div className="login-v2-scene">
        <Suspense fallback={null}>
          <Spline
            scene={SPLINE_SCENE_URL}
            onLoad={() => setSceneLoaded(true)}
            style={{ width: "100%", height: "100%" }}
          />
        </Suspense>
      </div>

      {/* Glassmorphism login form — floats above the 3D scene */}
      <div className="login-v2-content">
        <LoginV2Form
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
  );
}
