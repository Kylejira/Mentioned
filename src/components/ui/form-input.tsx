"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "./input"
import { Label } from "./label"

interface FormInputProps extends React.ComponentProps<"input"> {
  label: string
  helperText?: string
  error?: string
}

function FormInput({
  label,
  helperText,
  error,
  className,
  id,
  ...props
}: FormInputProps) {
  const inputId = id || React.useId()
  const helperId = `${inputId}-helper`
  const errorId = `${inputId}-error`

  return (
    <div className={cn("space-y-2", className)}>
      <Label
        htmlFor={inputId}
        className="text-sm font-medium text-foreground"
      >
        {label}
      </Label>
      <Input
        id={inputId}
        aria-describedby={error ? errorId : helperText ? helperId : undefined}
        aria-invalid={!!error}
        {...props}
      />
      {error ? (
        <p
          id={errorId}
          className="text-sm text-status-error"
          role="alert"
        >
          {error}
        </p>
      ) : helperText ? (
        <p
          id={helperId}
          className="text-sm text-muted-foreground"
        >
          {helperText}
        </p>
      ) : null}
    </div>
  )
}

export { FormInput }
