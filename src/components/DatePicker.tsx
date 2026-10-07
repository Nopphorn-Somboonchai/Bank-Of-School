import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerProps {
  value: string;
  onChange: (val: string) => void;
}

export default function DatePicker({ value, onChange }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  // Parse current YYYY-MM-DD value
  const currentDate = useMemo(() => {
    const parts = value.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    return new Date();
  }, [value]);

  // Keep track of the month/year currently shown in the picker
  const [viewDate, setViewDate] = useState(() => currentDate);

  // Sync viewDate when popover opens or value changes
  useEffect(() => {
    if (isOpen) {
      setViewDate(currentDate);
    }
  }, [isOpen, currentDate]);

  // Handle clicking outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const monthsAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthsFullThai = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  // Format date as "28-Jun-2026"
  const formattedDisplay = useMemo(() => {
    const parts = value.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (monthIdx >= 0 && monthIdx < 12) {
        return `${day.toString().padStart(2, '0')}-${monthsAbbr[monthIdx]}-${year}`;
      }
    }
    return value;
  }, [value]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const handlePrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleMonthChange = (newMonth: number) => {
    setViewDate(new Date(year, newMonth, 1));
  };

  const handleYearChange = (newYear: number) => {
    setViewDate(new Date(newYear, month, 1));
  };

  // Generate calendar days
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Generate years list (current year - 10 to current year + 10)
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const list = [];
    for (let y = currentYear - 10; y <= currentYear + 10; y++) {
      list.push(y);
    }
    return list;
  }, []);

  const handleSelectDay = (day: number) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const selectedDateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
    onChange(selectedDateStr);
    setIsOpen(false);
  };

  interface CalendarDay {
    day: number;
    isCurrentMonth: boolean;
    isPrevMonth: boolean;
    isNextMonth?: boolean;
  }

  const days: CalendarDay[] = [];
  
  // Previous month's overlapping days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    days.push({
      day: daysInPrevMonth - i,
      isCurrentMonth: false,
      isPrevMonth: true
    });
  }

  // Current month's days
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({
      day: d,
      isCurrentMonth: true,
      isPrevMonth: false
    });
  }

  // Next month's overlapping days to fill 42 cells (6 weeks)
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    days.push({
      day: d,
      isCurrentMonth: false,
      isPrevMonth: false,
      isNextMonth: true
    });
  }

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Date button styled to match mockup */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-4 bg-slate-950/40 backdrop-blur-md border border-white/15 rounded-xl px-3.5 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-sky-400 mt-1 cursor-pointer min-w-[190px] text-left hover:border-sky-400/50 hover:bg-white/5 transition-all select-none shadow-sm"
      >
        <span className="text-white text-base tracking-wide font-extrabold">{formattedDisplay}</span>
        <Calendar className="w-4 h-4 text-sky-400 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 bg-slate-900/90 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl p-4 z-50 animate-scaleUp text-slate-100 font-sans">
          {/* Header Controls: Month & Year Selector */}
          <div className="flex items-center justify-between gap-1 mb-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4.5 h-4.5" />
            </button>

            <div className="flex items-center gap-1.5">
              {/* Month Dropdown */}
              <select
                value={month}
                onChange={(e) => handleMonthChange(parseInt(e.target.value))}
                className="bg-slate-950/50 border border-white/15 text-xs font-semibold text-slate-100 rounded-lg px-2 py-1 focus:outline-none focus:border-sky-400 cursor-pointer"
              >
                {monthsFullThai.map((m, idx) => (
                  <option key={idx} value={idx}>{m}</option>
                ))}
              </select>

              {/* Year Dropdown */}
              <select
                value={year}
                onChange={(e) => handleYearChange(parseInt(e.target.value))}
                className="bg-slate-950/50 border border-white/15 text-xs font-semibold text-slate-100 rounded-lg px-2 py-1 focus:outline-none focus:border-sky-400 cursor-pointer"
              >
                {years.map((y) => (
                  <option key={y} value={y}>พ.ศ. {y + 543} ({y})</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Weekdays */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-1">
            <span className="text-rose-400">อา</span>
            <span>จ</span>
            <span>อ</span>
            <span>พ</span>
            <span>พฤ</span>
            <span>ศ</span>
            <span>ส</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((item, index) => {
              const isSelected = item.isCurrentMonth && 
                currentDate.getDate() === item.day && 
                currentDate.getMonth() === month && 
                currentDate.getFullYear() === year;

              const isToday = item.isCurrentMonth &&
                new Date().getDate() === item.day &&
                new Date().getMonth() === month &&
                new Date().getFullYear() === year;

              let btnClass = "w-9 h-9 flex items-center justify-center text-xs font-semibold rounded-lg transition-colors cursor-pointer ";
              
              if (!item.isCurrentMonth) {
                btnClass += "text-slate-600 hover:bg-white/5 hover:text-slate-400";
              } else if (isSelected) {
                btnClass += "bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-extrabold shadow-md shadow-sky-500/30";
              } else if (isToday) {
                btnClass += "border border-sky-400/50 text-sky-300 font-bold hover:bg-white/10";
              } else {
                btnClass += "text-slate-200 hover:bg-white/10 hover:text-white";
              }

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    if (item.isCurrentMonth) {
                      handleSelectDay(item.day);
                    } else if (item.isPrevMonth) {
                      const prevDate = new Date(year, month - 1, item.day);
                      const pad = (n: number) => n.toString().padStart(2, '0');
                      onChange(`${prevDate.getFullYear()}-${pad(prevDate.getMonth() + 1)}-${pad(item.day)}`);
                      setIsOpen(false);
                    } else if (item.isNextMonth) {
                      const nextDate = new Date(year, month + 1, item.day);
                      const pad = (n: number) => n.toString().padStart(2, '0');
                      onChange(`${nextDate.getFullYear()}-${pad(nextDate.getMonth() + 1)}-${pad(item.day)}`);
                      setIsOpen(false);
                    }
                  }}
                  className={btnClass}
                >
                  {item.day}
                </button>
              );
            })}
          </div>
          
          {/* Quick Select Today */}
          <div className="border-t border-white/10 mt-3 pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
                onChange(todayStr);
                setIsOpen(false);
              }}
              className="text-[11px] font-bold text-sky-400 hover:text-sky-300 px-2 py-1 rounded hover:bg-sky-500/15 cursor-pointer"
            >
              เลือกวันนี้ (Today)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
