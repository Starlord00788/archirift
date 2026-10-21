"use client";

import Link from "next/link";
import { motion, type HTMLMotionProps } from "motion/react";
import { forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "choice";

const base =
  "relative inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flow focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-45";

export const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-flow px-5 py-2.5 text-bg shadow-glow hover:brightness-110",
  secondary: "border border-line-strong bg-surface/70 px-4 py-2.5 text-ink hover:border-flow hover:text-flow",
  ghost: "px-3 py-2 text-ink-quiet hover:bg-surface-2 hover:text-ink",
  danger: "border border-fail/60 px-4 py-2.5 text-fail hover:bg-fail/10",
  choice: "w-full justify-start border border-line bg-surface/80 px-4 py-3 text-left font-medium text-ink hover:border-flow hover:bg-surface-2",
};

type Props = HTMLMotionProps<"button"> & { variant?: ButtonVariant };

/** The one button. Springs on press; respects reduced motion through <MotionConfig>. */
export const Button = forwardRef<HTMLButtonElement, Props>(function Button({ variant = "secondary", className = "", type = "button", ...rest }, ref) {
  return (
    <motion.button
      ref={ref}
      type={type}
      whileHover={rest.disabled ? undefined : { y: -1 }}
      whileTap={rest.disabled ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`${base} ${buttonStyles[variant]} ${className}`}
      {...rest}
    />
  );
});

export function ButtonLink({
  href,
  variant = "secondary",
  className = "",
  children,
  ...rest
}: { href: string; variant?: ButtonVariant; className?: string; children: React.ReactNode } & Omit<React.ComponentProps<typeof Link>, "href" | "className">) {
  return (
    <Link href={href} className={`${base} ${buttonStyles[variant]} ${className}`} {...rest}>
      {children}
    </Link>
  );
}
