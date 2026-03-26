"use client"

import { type ComponentProps, type FormEvent } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export type LoginFormProps = {
  email: string
  password: string
  onEmailChange: (email: string) => void
  onPasswordChange: (password: string) => void
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  loading: boolean
  error: string | null
  message: string | null
  isSignUp: boolean
  onToggleSignUp: () => void
} & Omit<ComponentProps<"form">, "onSubmit">

export function LoginForm({
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
  className,
  ...props
}: LoginFormProps) {
  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={onSubmit}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">
            {isSignUp ? "Create your account" : "Login to your account"}
          </h1>
          <p className="text-sm text-balance text-muted-foreground">
            {isSignUp
              ? "Enter your email and password to sign up"
              : "Enter your email below to login to your account"}
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            disabled={loading}
            className="bg-background"
            aria-invalid={error ? true : undefined}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            placeholder="At least 6 characters"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            disabled={loading}
            className="bg-background"
            aria-invalid={error ? true : undefined}
          />
        </Field>
        {error ? <FieldError>{error}</FieldError> : null}
        {message ? (
          <p
            role="status"
            className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-center text-sm text-foreground"
          >
            {message}
          </p>
        ) : null}
        <Field>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? "Please wait..."
              : isSignUp
                ? "Sign up"
                : "Login"}
          </Button>
        </Field>
        <FieldDescription className="text-center">
          {isSignUp ? "Already have an account? " : "Don't have an account? "}
          <button
            type="button"
            className="underline underline-offset-4 hover:text-primary"
            onClick={onToggleSignUp}
            disabled={loading}
          >
            {isSignUp ? "Sign in" : "Sign up"}
          </button>
        </FieldDescription>
      </FieldGroup>
    </form>
  )
}
