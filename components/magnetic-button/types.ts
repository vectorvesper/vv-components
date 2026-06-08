import { ButtonHTMLAttributes, ReactNode } from "react";

export interface MagneticButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  range?: number;
  actionArea?: "self" | "parent";
  strength?: number;
}
