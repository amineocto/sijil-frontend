import { Button as AwbButton, type ButtonProps as AwbButtonProps } from "@awb/ui";
import { twMerge } from "tailwind-merge";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps extends Omit<AwbButtonProps, "variant" | "isLoading"> {
  variant?: ButtonVariant;
  /** Action en cours : bouton désactivé, libellé conservé (celui d'@awb/ui est en anglais). */
  loading?: boolean;
}

/**
 * Teintes d'`@awb/ui` foncées d'un cran dans la même palette : ses boutons n'atteignent pas 4,5:1
 * (blanc sur orange-500 : 3,6:1 ; orange-600 sur blanc : 4,0:1), exigé par 09-fronts.md (ADR 0037).
 */
export const READABLE: Record<ButtonVariant, string> = {
  primary: "bg-orange-700 hover:bg-orange-800 active:bg-orange-900 focus:ring-orange-700",
  secondary: "text-orange-700 border-orange-300",
  ghost: "text-orange-700 border-orange-300",
  danger: "bg-red-700 text-white border-0 hover:bg-red-800 active:bg-red-900 focus:ring-red-700",
};

const AWB_VARIANT = {
  primary: "primary",
  secondary: "secondary",
  ghost: "ghost",
  danger: "primary",
} as const;

/** Bouton de la charte AWB. */
export function Button({
  variant = "primary",
  loading = false,
  disabled,
  classes,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <AwbButton
      {...props}
      type={type}
      variant={AWB_VARIANT[variant]}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      classes={{ button: twMerge(READABLE[variant], classes?.button) }}
    />
  );
}
