import { Badge } from "@mantine/core";
import type { TypeStatus } from "@/shared/api";
import { STATUS_COLORS, STATUS_LABELS } from "@/shared/labels";

export function StatusBadge({ status }: { status: TypeStatus }) {
  return (
    <Badge color={STATUS_COLORS[status]} variant="light">
      {STATUS_LABELS[status]}
    </Badge>
  );
}
