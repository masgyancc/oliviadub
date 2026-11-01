import { StatusBadge, Tooltip } from "@dub/ui";

export const DisabledLinkTooltip = () => {
  return (
    <Tooltip content="This link is disabled. It will redirect to its domain's not found URL, and its stats will be excluded from your overall stats.">
      <StatusBadge variant="neutral" size="sm" icon={null}>
        Disabled
      </StatusBadge>
    </Tooltip>
  );
};
