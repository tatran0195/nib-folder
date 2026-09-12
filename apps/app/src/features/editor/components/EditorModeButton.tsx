import { SegmentedControlItem } from '@nibleaf/design-system/components/ui/segmented-control';
import type { ReactNode } from 'react';

interface EditorModeButtonProps {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
  disabled?: boolean;
  title?: string;
}

export function EditorModeButton({ active, onClick, icon, children, disabled = false, title }: EditorModeButtonProps) {
  return (
    <SegmentedControlItem
      active={active}
      aria-label={typeof children === 'string' ? children : title}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {icon}
      <span className="hidden sm:inline">{children}</span>
    </SegmentedControlItem>
  );
}

export default EditorModeButton;
