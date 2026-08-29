import React from 'react';

export function ChronosDock() {
  return (
    <div className="h-10 bg-[#0D0D0E] border-t border-[#1F1F21] flex items-center px-6 justify-between text-xs text-[#A1A1AA] shrink-0 w-full z-50">
      <div className="flex items-center gap-4">
        <div className="w-48 h-2 bg-[#1A1A1C] rounded-full overflow-hidden flex">
          <div className="h-full bg-blue-500 w-[65%] border-r border-[#0D0D0E]"></div>
          <div className="h-full bg-purple-500 w-[15%]"></div>
        </div>
        <span className="font-medium">65% Day Scheduled</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
        <span className="text-white">Next Task:</span>
        <span className="italic">"Review Architecture"</span>
        <span>at 11:00 AM</span>
      </div>
    </div>
  );
}
