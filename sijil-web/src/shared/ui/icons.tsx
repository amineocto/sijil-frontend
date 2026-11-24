import type { SVGProps } from "react";

/**
 * Icônes de trait (24 × 24, couleur du texte), dessinées ici plutôt qu'ajoutées en dépendance
 * (principe P9). Décoratives : le libellé voisin, ou l'`aria-label` du bouton, porte le sens.
 */
function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

type IconProps = SVGProps<SVGSVGElement>;

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
);

export const ClientIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </Icon>
);

export const UploadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v4h16v-4" />
  </Icon>
);

export const CatalogueIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 4h11l3 3v13H5z" />
    <path d="M9 10h6M9 14h6" />
  </Icon>
);

export const ChecklistIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m4 7 2 2 3-3M4 15l2 2 3-3M13 8h7M13 16h7" />
  </Icon>
);

export const ReviewIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 5h16v10H9l-5 4z" />
    <path d="m9 10 2 2 4-4" />
  </Icon>
);

export const ShareIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="6" r="2.5" />
    <circle cx="18" cy="18" r="2.5" />
    <path d="m8.3 10.8 7.4-3.6M8.3 13.2l7.4 3.6" />
  </Icon>
);

export const DocumentIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 3h9l4 4v14H6z" />
    <path d="M9 12h7M9 16h5" />
  </Icon>
);

export const CompassIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2 5-5 2 2-5z" />
  </Icon>
);

export const LogoutIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
  </Icon>
);

export const CollapseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m11 17-5-5 5-5M18 17l-5-5 5-5" />
  </Icon>
);

export const ExpandIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m13 7 5 5-5 5M6 7l5 5-5 5" />
  </Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);
