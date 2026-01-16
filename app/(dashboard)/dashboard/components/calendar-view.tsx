"use client";

import { useMemo } from "react";
import { Calendar, momentLocalizer, Event } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import type { Post } from "@/lib/db/schema";

// Dynamic import to avoid SSR issues
let localizer: ReturnType<typeof momentLocalizer> | null = null;

if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const moment = require("moment");
  localizer = momentLocalizer(moment);
}

interface CalendarViewProps {
  posts: Post[];
}

interface CalendarEvent extends Event {
  post: Post;
  status: string;
}

const statusColors: Record<string, string> = {
  draft: "#94a3b8",
  scheduled: "#3b82f6",
  publishing: "#eab308",
  published: "#10b981",
  failed: "#ef4444",
};

export function CalendarView({ posts }: CalendarViewProps) {
  const events: CalendarEvent[] = useMemo(() => {
    return posts.map((post) => {
      // Use scheduledFor if available, otherwise use createdAt
      const date = post.scheduledFor
        ? new Date(post.scheduledFor)
        : new Date(post.createdAt);

      return {
        id: post.id,
        title: post.content.substring(0, 50) + (post.content.length > 50 ? "..." : ""),
        start: date,
        end: new Date(date.getTime() + 30 * 60 * 1000), // 30 minutes duration
        post,
        status: post.status,
      };
    });
  }, [posts]);

  const eventStyleGetter = (event: CalendarEvent) => {
    const color = statusColors[event.status] || "#94a3b8";
    return {
      style: {
        backgroundColor: color,
        borderColor: color,
        color: "#ffffff",
        borderRadius: "4px",
        padding: "2px 4px",
        fontSize: "11px",
        fontWeight: "500",
      },
    };
  };

  if (!localizer) {
    return (
      <div className="h-[400px] md:h-[600px] rounded-xl md:rounded-2xl border border-[#E8F0FF] bg-white p-4 flex items-center justify-center">
        <p className="text-zinc-500">Loading calendar...</p>
      </div>
    );
  }

  return (
    <div className="h-[400px] md:h-[600px] lg:h-[700px] rounded-xl md:rounded-2xl border border-[#E8F0FF] bg-white p-2 md:p-3 shadow-xl shadow-[#C4D9FF]/15">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: "100%" }}
        eventPropGetter={eventStyleGetter}
        views={["month", "week", "day", "agenda"]}
        defaultView="month"
        popup
        showMultiDayTimes
        step={60}
        timeslots={1}
        className="text-xs md:text-sm"
        messages={{
          next: "Next",
          previous: "Previous",
          today: "Today",
          month: "Month",
          week: "Week",
          day: "Day",
          agenda: "Agenda",
          date: "Date",
          time: "Time",
          event: "Event",
          noEventsInRange: "No posts in this range",
        }}
      />
    </div>
  );
}
