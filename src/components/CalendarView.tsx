import React, { useState } from 'react';
import { useAppContext } from '../AppContext';
import { format, startOfWeek, addDays, startOfMonth, endOfMonth, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Block } from '../types';

export function CalendarView() {
  const { blocks, updateBlock, createBlock, activeSpaceId } = useAppContext();
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = startOfWeek(addDays(monthEnd, 6));

  const dateFormat = "d";
  const rows = [];
  let days = [];
  let day = startDate;
  let formattedDate = "";

  const eventBlocks = blocks.filter(b => b.properties?.date || b.properties?.dueDate);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const handleDateClick = async (date: Date) => {
    if (!activeSpaceId) {
      alert("Please select a Space in the sidebar first.");
      return;
    }
    const title = prompt("Event title:");
    if (title) {
      await createBlock({
        type: 'event',
        content: title,
        properties: { date: date.toISOString() },
        parentId: activeSpaceId, // Place it in the current space for now
      });
    }
  };

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      formattedDate = format(day, dateFormat);
      const cloneDay = day;
      
      const dayEvents = eventBlocks.filter(b => {
        const d = b.properties?.date || b.properties?.dueDate;
        if (!d) return false;
        return isSameDay(new Date(d), cloneDay);
      });

      days.push(
        <div
          className={`min-h-[100px] p-2 border border-[#1F1F21] ${
            !isSameMonth(day, monthStart)
              ? "text-[#52525B] bg-[#0A0A0B]"
              : isSameDay(day, new Date()) ? "bg-[#111113] text-white" : "text-[#A1A1AA] bg-[#0D0D0E]"
          } hover:bg-[#1A1A1C] transition-colors cursor-pointer relative group`}
          key={day.toISOString()}
          onClick={() => handleDateClick(cloneDay)}
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium">{formattedDate}</span>
            <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 text-[#52525B]" />
          </div>
          <div className="mt-1 space-y-1">
            {dayEvents.map(event => (
              <div key={event.id} onClick={(e) => e.stopPropagation()} className="bg-blue-900/30 text-blue-300 text-[10px] px-1.5 py-0.5 rounded truncate border border-blue-800/50">
                {event.content}
              </div>
            ))}
          </div>
        </div>
      );
      day = addDays(day, 1);
    }
    rows.push(
      <div className="grid grid-cols-7" key={day.toISOString()}>
        {days}
      </div>
    );
    days = [];
  }

  return (
    <div className="flex-1 bg-[#0A0A0B] overflow-y-auto flex flex-col">
      <div className="p-6 border-b border-[#1F1F21] flex justify-between items-center bg-[#0A0A0B] sticky top-0 z-10">
        <h1 className="text-xl font-medium text-white">Calendar</h1>
        <div className="flex items-center gap-4">
          <button onClick={prevMonth} className="text-[#52525B] hover:text-white"><ChevronLeft className="w-5 h-5" /></button>
          <span className="text-sm font-medium w-32 text-center">{format(currentDate, "MMMM yyyy")}</span>
          <button onClick={nextMonth} className="text-[#52525B] hover:text-white"><ChevronRight className="w-5 h-5" /></button>
        </div>
      </div>
      <div className="p-6 flex-1">
        <div className="grid grid-cols-7 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-[10px] uppercase tracking-wider text-[#52525B] font-semibold text-center">{d}</div>
          ))}
        </div>
        <div className="bg-[#0D0D0E] rounded-lg overflow-hidden border border-[#1F1F21]">
          {rows}
        </div>
      </div>
    </div>
  );
}
