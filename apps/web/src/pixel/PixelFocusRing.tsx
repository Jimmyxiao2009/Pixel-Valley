import type { ButtonHTMLAttributes, ReactNode } from "react";

const FOCUS_CLASS = "pv-focus-ring";

export function pixelFocusClass(className?: string): string {
  return className ? `${FOCUS_CLASS} ${className}` : FOCUS_CLASS;
}

type PixelFocusRingProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function PixelFocusRing({
  children,
  className,
  type = "button",
  ...props
}: PixelFocusRingProps) {
  return (
    <button type={type} className={pixelFocusClass(className)} {...props}>
      {children}
    </button>
  );
}
