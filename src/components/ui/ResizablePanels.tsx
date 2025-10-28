
import React, { useState, useCallback, useRef, useEffect } from 'react';

interface ResizablePanelsProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  initialLeftWidthPercent?: number;
}

const ResizablePanels: React.FC<ResizablePanelsProps> = ({
  leftPanel,
  rightPanel,
  initialLeftWidthPercent = 40,
}) => {
  const [leftWidth, setLeftWidth] = useState(initialLeftWidthPercent);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(() => {
    setIsResizing(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    if (newLeftWidth >= 15 && newLeftWidth <= 85) { // Min/max width constraints
      setLeftWidth(newLeftWidth);
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden bg-slate-900">
      <div style={{ width: `${leftWidth}%` }} className="h-full overflow-auto">
        {leftPanel}
      </div>
      <div
        onMouseDown={handleMouseDown}
        className="w-2 h-full bg-slate-700 hover:bg-sky-600 cursor-col-resize flex-shrink-0"
        title="Resize panels"
      />
      <div style={{ width: `${100 - leftWidth}%` }} className="h-full overflow-auto">
        {rightPanel}
      </div>
    </div>
  );
};

export default ResizablePanels;
    