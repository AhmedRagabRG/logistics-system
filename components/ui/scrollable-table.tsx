import { ReactNode } from 'react';

interface ScrollableTableProps {
  children: ReactNode;
  maxHeight?: string;
}

export default function ScrollableTable({ children, maxHeight = 'max-h-[600px]' }: ScrollableTableProps) {
  return (
    <div className={`scroll-container ${maxHeight}`}>
      {children}
    </div>
  );
}
