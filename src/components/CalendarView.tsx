import { getAccessToken } from "../auth";
import React, { useState } from 'react';
import { useAppContext } from '../AppContext';
import { format, startOfWeek, addDays, startOfMonth, endOfMonth, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Zap, Calendar as CalendarIcon, Bot } from 'lucide-react';
import { Block } from '../types';
import { workspaceApi } from '../workspace';

export function CalendarView() {
  const { blocks, updateBlock, createBlock, activeSpaceId } = useAppContext();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [warnings, setWarnings] = useState<string[]>([]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = startOfWeek(addDays(monthEnd, 6));

  const dateFormat = "d";
  const rows = [];
  let days = [];
  let day = startDate;
  let formattedDate = "";

  const eventBlocks = blocks.filter(b => b.properties?.date || b.properties?.dueDate || b.properties?.scheduledStart);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const handleDateClick = async (date: Date) => {
    if (!activeSpaceId) {
      alert("Please select a Space in the sidebar first.");
      return;
    }
    const title = prompt("Event title:");
    if (title) {
      const startISO = date.toISOString();
      const end = new Date(date);
      end.setHours(end.getHours() + 1);
      const endISO = end.toISOString();
      
      let calendarEventId = undefined;
      const res = await workspaceApi.createCalendarEvent(title, startISO, endISO);
      if (res && res.id) calendarEventId = res.id;

      await createBlock({
        type: 'event',
        content: title,
        properties: { date: startISO, scheduledStart: startISO, scheduledEnd: endISO, calendarEventId },
        parentId: activeSpaceId,
      });
    }
  };

  const handleScheduleDay = async () => {
    setWarnings([]);
    const fluidTasks = blocks.filter(b => 
      b.type === 'task' && 
      b.properties?.anchoring === 'fluid' && 
      !b.properties?.scheduledStart
    );
    
    if (fluidTasks.length === 0) {
      alert('No unscheduled fluid tasks found. Create tasks with anchoring: "fluid" to schedule.');
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      alert('Please connect Google Calendar (sign in) first.');
      return;
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    try {
      const res = await fetch('/api/chronos/schedule', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ tasks: fluidTasks, timezone })
      });
      const data = await res.json();
      
      if (data.warnings && data.warnings.length > 0) {
        setWarnings(data.warnings);
      }
      
      if (data.scheduledTasks && data.scheduledTasks.length > 0) {
        for (const sched of data.scheduledTasks) {
          const originalBlock = fluidTasks.find(t => t.id === sched.id);
          if (originalBlock) {
            const isSplit = sched.chunkTotal && sched.chunkTotal > 1;
            const title = isSplit ? `${originalBlock.content} (${sched.chunkIndex}/${sched.chunkTotal})` : originalBlock.content;
            
            let calendarEventId = originalBlock.properties?.calendarEventId;
            if (sched.chunkIndex > 1) calendarEventId = undefined;
            
            if (calendarEventId && (!isSplit || sched.chunkIndex === 1)) {
              await workspaceApi.updateCalendarEvent(calendarEventId, title, sched.scheduledStart, sched.scheduledEnd);
            } else {
              const res = await workspaceApi.createCalendarEvent(title, sched.scheduledStart, sched.scheduledEnd);
              if (res && res.id) calendarEventId = res.id;
            }

            const propertiesUpdate = {
              ...originalBlock.properties,
              scheduledStart: sched.scheduledStart,
              scheduledEnd: sched.scheduledEnd,
              calendarEventId,
              chunkIndex: sched.chunkIndex,
              chunkTotal: sched.chunkTotal
            };

            if (sched.chunkIndex > 1) {
              await createBlock({
                type: 'task',
                content: originalBlock.content,
                parentId: originalBlock.parentId,
                properties: propertiesUpdate
              });
            } else {
              await updateBlock(sched.id, { properties: propertiesUpdate });
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
      alert('Failed to schedule tasks');
    }
  };

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      formattedDate = format(day, dateFormat);
      const cloneDay = day;
      
      const dayEvents = eventBlocks.filter(b => {
        if (b.type === 'task' && b.properties?.scheduledStart) {
          return isSameDay(new Date(b.properties.scheduledStart), cloneDay);
        }
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
            {dayEvents.map(event => {
              const isChronos = event.type === 'task' && event.properties?.scheduledStart;
              const isPipeline = event.properties?.source === 'pipeline';
              const isAi = event.properties?.source === 'ai';
              const displayContent = (event.properties?.chunkTotal && event.properties?.chunkTotal > 1) 
                ? `${event.content} (${event.properties.chunkIndex}/${event.properties.chunkTotal})` 
                : event.content;
              return (
                <div key={event.id} onClick={(e) => e.stopPropagation()} 
                     className={`text-[10px] px-1.5 py-0.5 rounded truncate border flex items-center ${
                       isChronos ? 'bg-purple-900/30 text-purple-300 border-purple-800/50' : 'bg-blue-900/30 text-blue-300 border-blue-800/50'
                     }`}>
                  {isChronos && <Zap className="w-2.5 h-2.5 inline mr-1 shrink-0 text-purple-400" title="Scheduled by Chronos" />}
                  {isPipeline && <Zap className="w-2.5 h-2.5 inline mr-1 shrink-0 text-yellow-500" title="Created by automation" />}
                  {isAi && <Bot className="w-2.5 h-2.5 inline mr-1 shrink-0 text-blue-400" title="Created by AI assistant" />}
                  <span className="truncate">{displayContent}</span>
                </div>
              );
            })}
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
        <h1 className="text-xl font-medium text-white flex items-center gap-2">
          Calendar
        </h1>
        <div className="flex items-center gap-6">
          <button onClick={handleScheduleDay} className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-4 py-2 rounded text-sm font-medium transition-all shadow-lg border border-purple-500/30">
            <Zap className="w-4 h-4 text-purple-200" />
            Schedule my day
          </button>
          <div className="h-6 w-px bg-[#2D2D30]"></div>
          <div className="flex items-center gap-4">
            <button onClick={prevMonth} className="text-[#52525B] hover:text-white"><ChevronLeft className="w-5 h-5" /></button>
            <span className="text-sm font-medium w-32 text-center">{format(currentDate, "MMMM yyyy")}</span>
            <button onClick={nextMonth} className="text-[#52525B] hover:text-white"><ChevronRight className="w-5 h-5" /></button>
          </div>
        </div>
      </div>
      {warnings.length > 0 && (
        <div className="bg-yellow-900/30 border-b border-yellow-700/50 text-yellow-200 p-4 px-6 text-sm flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <h4 className="font-semibold text-yellow-500">Scheduling Warnings</h4>
            <button onClick={() => setWarnings([])} className="text-xs text-yellow-400 hover:text-yellow-300">Dismiss</button>
          </div>
          <ul className="list-disc pl-5 space-y-1">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
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
