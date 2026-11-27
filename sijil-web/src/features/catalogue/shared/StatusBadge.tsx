import type { TypeStatus } from "@/shared/api";
import { STATUS_COLORS, STATUS_LABELS } from "@/features/catalogue/shared/labels";
import { Tag } from "@/shared/ui";
import { CodeIcon, TYPE_STATUS_ICONS } from "@/shared/ui/icons";

export function StatusBadge({ status }: { status: TypeStatus }) {
  return (
    <Tag variant={STATUS_COLORS[status]}>
      <CodeIcon icons={TYPE_STATUS_ICONS} code={status} />
      {STATUS_LABELS[status]}
    </Tag>
  );
}
