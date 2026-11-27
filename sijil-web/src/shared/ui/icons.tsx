import { forwardRef, type ReactNode } from "react";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Ban,
  BookOpen,
  Building2,
  CalendarCheck,
  ChevronDown,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  Compass,
  Database,
  Eye,
  FileSignature,
  FileText,
  Gavel,
  HandCoins,
  Hourglass,
  House,
  IdCard,
  Landmark,
  Link,
  ListChecks,
  Lock,
  LogOut,
  Pencil,
  PencilLine,
  Plus,
  ScanText,
  Search,
  Send,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Snowflake,
  Tags,
  Trash2,
  TriangleAlert,
  Upload,
  User,
  UserCheck,
  Wallet,
  X,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

/**
 * Icônes de l'interface (ADR 0040) : `lucide-react`, le jeu déjà embarqué par `@awb/ui`.
 * Décoratives (`aria-hidden` posé par lucide) : le libellé voisin, ou l'`aria-label` du bouton,
 * porte le sens. Un écran ne choisit pas l'icône d'un code métier : il la prend ici.
 */
export type { LucideIcon };

/** Taille d'origine des icônes du menu (20 px) ; un `className` de taille la remplace. */
function sized(Icon: LucideIcon): LucideIcon {
  const Sized = forwardRef<SVGSVGElement, LucideProps>((props, ref) => (
    <Icon ref={ref} size={20} {...props} />
  ));
  Sized.displayName = Icon.displayName;
  return Sized as LucideIcon;
}

// Menu et en-tête.
export const SearchIcon = sized(Search);
export const ClientIcon = sized(User);
export const UploadIcon = sized(Upload);
export const CatalogueIcon = sized(FileText);
export const DictionaryIcon = sized(BookOpen);
export const ChecklistIcon = sized(ListChecks);
export const ReviewIcon = sized(ClipboardCheck);
export const ShareIcon = sized(Share2);
export const DocumentIcon = sized(FileText);
export const CompassIcon = sized(Compass);
export const LogoutIcon = sized(LogOut);
export const CollapseIcon = sized(ChevronsLeft);
export const ExpandIcon = sized(ChevronsRight);
export const CloseIcon = sized(X);
/** Chevron vers la gauche (réduire) ; tourné d'un demi-tour, vers la droite (déplier). */
export const ChevronIcon = sized(ChevronLeft);

// Actions.
export const EditIcon = Pencil;
export const ViewIcon = Eye;
export const DeleteIcon = Trash2;
export const AddIcon = Plus;
export const MoveUpIcon = ArrowUp;
export const MoveDownIcon = ArrowDown;

/** Rubriques de l'éditeur de type, par identifiant (`RUBRIQUES`). */
export const RUBRIC_ICONS: Record<string, LucideIcon> = {
  identite: IdCard,
  metadonnees: Tags,
  validite: CalendarCheck,
  retention: Hourglass,
  stockage: Database,
  traitements: ScanText,
  sensibilite: ShieldCheck,
  filenet: Link,
};

/** Statut d'une version de type. */
export const TYPE_STATUS_ICONS: Record<string, LucideIcon> = {
  BROUILLON: PencilLine,
  SOUMIS: Send,
  EN_REVUE: Eye,
  PUBLIE: CircleCheck,
  DEPRECIE: TriangleAlert,
  RETIRE: Ban,
};

/** Sensibilité d'un type ou d'un document. */
export const SENSITIVITY_ICONS: Record<string, LucideIcon> = {
  STANDARD: Shield,
  SENSIBLE: ShieldAlert,
  RESTREINT: Lock,
};

/** Famille de pièces. */
export const FAMILY_ICONS: Record<string, LucideIcon> = {
  IDENTITE: IdCard,
  REVENUS: Wallet,
  COMPTE: Landmark,
  CREDIT: HandCoins,
  CONTRAT: FileSignature,
  GARANTIE: House,
  ENTREPRISE: Building2,
  MANDAT: UserCheck,
  CONTENTIEUX: Gavel,
};

/** État du cycle de vie d'un document. */
export const LIFECYCLE_ICONS: Record<string, LucideIcon> = {
  EN_QUARANTAINE: ShieldQuestion,
  ACTIF: CircleCheck,
  REJETE_TECHNIQUE: CircleX,
  SUPPRIME_LOGIQUE: Trash2,
  ARCHIVE_FROID: Snowflake,
  RESTAURATION_EN_COURS: Archive,
  ACTIF_TEMPORAIRE: Archive,
  RETENTION_ECHUE: Hourglass,
};

/** Icône d'un code, à la taille du texte voisin ; rien si le code n'a pas d'icône. */
export function CodeIcon({
  icons,
  code,
  className = "size-3.5 shrink-0",
}: {
  icons: Record<string, LucideIcon>;
  code: string | null | undefined;
  className?: string;
}) {
  const Icon = code ? icons[code] : undefined;
  return Icon ? <Icon className={className} /> : null;
}

/** Flèche de la liste de choix (celle du navigateur est masquée : même rendu partout). */
export function Chevron({ className = "end-3" }: { className?: string }) {
  return (
    <ChevronDown
      className={`pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-gray-500 ${className}`}
    />
  );
}

/** Libellé précédé de l'icône de son code (famille, sensibilité…). */
export function Labelled({
  icons,
  code,
  children,
}: {
  icons: Record<string, LucideIcon>;
  code: string | null | undefined;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <CodeIcon icons={icons} code={code} />
      {children}
    </span>
  );
}
