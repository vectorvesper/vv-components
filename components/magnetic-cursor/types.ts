import { HTMLAttributes, ReactNode } from "react";

export interface MagneticCursorProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  range?: number;
  strength?: number;
}
