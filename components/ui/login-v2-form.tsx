"use client";

import { type FormEvent } from "react";
import { User, Lock, ArrowRight, Loader2 } from "lucide-react";

export type LoginV2FormProps = {
  email: string;
  password: string;
  onEmailChange: (email: string) => void;
  onPasswordChange: (password: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  loading: boolean;
  error: string | null;
  message: string | null;
  isSignUp: boolean;
  onToggleSignUp: () => void;
};

export function LoginV2Form({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  loading,
  error,
  message,
  isSignUp,
  onToggleSignUp,
}: LoginV2FormProps) {
  return (
    <div className="login-v2-glass">
      {/* Header */}
      <div className="login-v2-glass__header">
        <h2 className="login-v2-glass__title">
          {isSignUp ? "Create Account" : "Welcome Back"}
        </h2>
        <p className="login-v2-glass__subtitle">
          {isSignUp
            ? "Enter your details to get started"
            : "Sign in to continue"}
        </p>
      </div>

      <form className="login-v2-glass__form" onSubmit={onSubmit}>
        {/* Email */}
        <div className="login-v2-field">
          <input
            type="email"
            id="login-v2-email"
            className="login-v2-field__input"
            placeholder=" "
            required
            autoComplete="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            disabled={loading}
            aria-invalid={error ? true : undefined}
            aria-label="Email Address"
          />
          <label htmlFor="login-v2-email" className="login-v2-field__label">
            <User
              className="login-v2-field__icon"
              size={15}
              aria-hidden="true"
            />
            Email Address
          </label>
        </div>

        {/* Password */}
        <div className="login-v2-field">
          <input
            type="password"
            id="login-v2-password"
            className="login-v2-field__input"
            placeholder=" "
            required
            minLength={6}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            disabled={loading}
            aria-invalid={error ? true : undefined}
            aria-label="Password"
          />
          <label htmlFor="login-v2-password" className="login-v2-field__label">
            <Lock
              className="login-v2-field__icon"
              size={15}
              aria-hidden="true"
            />
            Password
          </label>
        </div>

        {/* Error / Message feedback */}
        {error && (
          <div className="login-v2-feedback login-v2-feedback--error" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="login-v2-feedback login-v2-feedback--success" role="status">
            {message}
          </div>
        )}

        {/* Forgot password (only for sign-in) */}
        {!isSignUp && (
          <div className="login-v2-glass__aux">
            <button
              type="button"
              className="login-v2-link login-v2-link--dim"
              tabIndex={-1}
            >
              Forgot Password?
            </button>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          className="login-v2-btn login-v2-btn--primary"
          disabled={loading}
          id="login-v2-submit"
        >
          {loading ? (
            <>
              <Loader2 className="login-v2-btn__spinner" size={18} />
              Please wait…
            </>
          ) : (
            <>
              {isSignUp ? "Sign Up" : "Sign In"}
              <ArrowRight className="login-v2-btn__arrow" size={18} />
            </>
          )}
        </button>


      </form>

      {/* Toggle sign-up / sign-in */}
      <p className="login-v2-glass__footer">
        {isSignUp ? "Already have an account? " : "Don't have an account? "}
        <button
          type="button"
          className="login-v2-link login-v2-link--accent"
          onClick={onToggleSignUp}
          disabled={loading}
        >
          {isSignUp ? "Sign In" : "Sign Up"}
        </button>
      </p>
    </div>
  );
}
