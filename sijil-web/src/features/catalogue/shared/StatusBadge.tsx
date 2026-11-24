import type { TypeStatus } from "@/shared/api";
import { STATUS_COLORS, STATUS_LABELS } from "@/features/catalogue/shared/labels";
import { Tag } from "@/shared/ui";

export function StatusBadge({ status }: { status: TypeStatus }) {
  return <Tag variant={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Tag>;
}
