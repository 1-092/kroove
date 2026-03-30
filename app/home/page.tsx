"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

type ClassCategory = "regular" | "volunteer";

type FilterKey = "all" | ClassCategory | "my";

type Course = {
  id: string;
  category: ClassCategory;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  title: string;
  description?: string;
  currentSeats: number;
  maxSeats: number;
  participants: string[];
  videoId: string;
  youtubeUrl?: string;
  isRegistered: boolean;
  waitlist?: string[]; // isRegistered=false인 상태에서의 대기순번
};

const INITIAL_USER_NAME = "Kroove Member";

function formatDateKorean(yyyyMmDd: string) {
  const d = new Date(`${yyyyMmDd}T00:00:00`);
  return new Intl.DateTimeFormat("ko-KR", {
    weekday: "short",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function getCourseDateTimeKey(course: Course) {
  return new Date(`${course.date}T${course.time}:00`).getTime();
}

function toLocalISODateString(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function generateTimeOptions(startHH: number, endHH: number) {
  const times: string[] = [];

  for (let hh = startHH; hh <= endHH; hh++) {
    for (const mm of [0, 10, 20, 30, 40, 50]) {
      if (hh === endHH && mm > 0) continue;
      times.push(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
    }
  }

  // 19:10 포함 보장
  if (!times.includes("19:10")) times.push("19:10");
  times.sort();
  return times;
}

function extractYouTubeVideoId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // Typical: https://www.youtube.com/watch?v=VIDEO_ID
  const vMatch = raw.match(/[?&]v=([A-Za-z0-9_-]{6,})/);
  if (vMatch?.[1]) return vMatch[1];

  // Typical: https://youtu.be/VIDEO_ID
  const shortMatch = raw.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/);
  if (shortMatch?.[1]) return shortMatch[1];

  // Typical embed/vi formats
  const embedMatch = raw.match(/\/(?:embed|vi)\/([A-Za-z0-9_-]{6,})/);
  if (embedMatch?.[1]) return embedMatch[1];

  // Allow direct "VIDEO_ID" input
  if (/^[A-Za-z0-9_-]{6,}$/.test(raw)) return raw;

  return null;
}

export default function HomePage() {
  const courses: Course[] = useMemo(
    () => [
      {
        id: "c1",
        category: "regular",
        date: "2026-04-02",
        time: "19:30",
        title: "Neon Pop Groove",
        currentSeats: 8,
        maxSeats: 12,
        participants: ["Mina", "Jin", "Sora", "Hana", "Leo", "Nami", "Arin", INITIAL_USER_NAME],
        videoId: "dQw4w9WgXcQ",
        isRegistered: true,
      },
      {
        id: "c2",
        category: "volunteer",
        date: "2026-04-01",
        time: "20:00",
        title: "Street Warm-Up",
        currentSeats: 14,
        maxSeats: 16,
        participants: [
          "Artem",
          "Yuna",
          "Sumi",
          "Tae",
          "Bora",
          "Daeho",
          "Eunji",
          "Minwoo",
          "Hyeon",
          "Jae",
          "Rin",
          "Kari",
          "Nayeon",
          "Sang",
        ],
        videoId: "3GwjfUFyY6M",
        isRegistered: false,
      },
      {
        id: "c3",
        category: "regular",
        date: "2026-03-31",
        time: "18:00",
        title: "Rhythm Control",
        currentSeats: 6,
        maxSeats: 8,
        participants: ["Rina", "Chulsoo", "Seth", "Dani", "Jinwoo", "Momo"],
        videoId: "9bZkp7q19f0",
        isRegistered: false,
      },
      {
        id: "c4",
        category: "regular",
        date: "2026-04-02",
        time: "21:00",
        title: "K-Pop Choreo Lab",
        currentSeats: 11,
        maxSeats: 14,
        participants: ["Haru", "Yong", "Eun", "Sol", "Jin", "Bomi", "Cha", "Soo", "Min", "Nari", "Ken"],
        videoId: "kJQP7kiw5Fk",
        isRegistered: false,
      },
      {
        id: "c5",
        category: "volunteer",
        date: "2026-03-30",
        time: "19:00",
        title: "Beginner Friendly",
        currentSeats: 16,
        maxSeats: 16,
        participants: [
          "Nana",
          "Kyeong",
          "Taeyang",
          "Ivy",
          "Beom",
          "Seok",
          "Ro",
          "Yori",
          "Sana",
          "Gyu",
          "Eli",
          "Bae",
          "Jisu",
          "Sora",
          "Hyejin",
          "Mira",
        ],
        videoId: "V-_O7nl0Ii0",
        isRegistered: false,
      },
      {
        id: "c6",
        category: "volunteer",
        date: "2026-03-29",
        time: "20:30",
        title: "Body Isolation",
        currentSeats: 3,
        maxSeats: 10,
        participants: ["Hana", "Rook", "Daeun"],
        videoId: "tAGn5s-Wy2c",
        isRegistered: false,
      },
      {
        id: "c7",
        category: "regular",
        date: "2026-03-28",
        time: "19:30",
        title: "Vocal Groove + Footwork",
        currentSeats: 9,
        maxSeats: 12,
        participants: ["Mina", "Sora", "Leo", "Nami", "Arin", "Hyeon", "Jin", "Sumi", "Yuna"],
        videoId: "fJ9rUzIMcZQ",
        isRegistered: false,
      },
      {
        id: "c8",
        category: "volunteer",
        date: "2026-03-27",
        time: "18:30",
        title: "Freestyle Jam",
        currentSeats: 5,
        maxSeats: 8,
        participants: ["Rin", "Kari", "Bora", "Tae", "Eunji"],
        videoId: "e-ORhEE9VVg",
        isRegistered: false,
      },
      {
        id: "c9",
        category: "regular",
        date: "2026-03-26",
        time: "19:00",
        title: "Stage Presence",
        currentSeats: 2,
        maxSeats: 6,
        participants: ["Momo", "Rina"],
        videoId: "kxopViU98fc",
        isRegistered: true,
      },
      {
        id: "c10",
        category: "regular",
        date: "2026-03-25",
        time: "20:00",
        title: "Hip-Hop Foundations",
        currentSeats: 10,
        maxSeats: 15,
        participants: ["Jae", "Minwoo", "Ken", "Sol", "Cha", "Jinwoo", "Haru", "Soo", "Eli", "Ro"],
        videoId: "CevxZvSJLk8",
        isRegistered: false,
      },
      {
        id: "c11",
        category: "volunteer",
        date: "2026-03-24",
        time: "19:30",
        title: "Old-School Bounce",
        currentSeats: 7,
        maxSeats: 10,
        participants: ["Beom", "Seok", "Yori", "Sana", "Gyu", "Bae", "Jisu"],
        videoId: "DLzxrzFCyOs",
        isRegistered: false,
      },
      {
        id: "c12",
        category: "volunteer",
        date: "2026-03-23",
        time: "20:15",
        title: "Power Turns",
        currentSeats: 9,
        maxSeats: 10,
        participants: ["Rina", "Chulsoo", "Seth", "Dani", "Jinwoo", "Momo", "Mina", "Jae", "Hyeon"],
        videoId: "hTWKbfoikeg",
        isRegistered: false,
      },
      {
        id: "c13",
        category: "regular",
        date: "2026-03-22",
        time: "18:45",
        title: "K-Pop Smooth Transitions",
        currentSeats: 13,
        maxSeats: 13,
        participants: [
          "Hyejin",
          "Mira",
          "Nana",
          "Kyeong",
          "Taeyang",
          "Ivy",
          "Beom",
          "Seok",
          "Ro",
          "Yori",
          "Sana",
          "Gyu",
          INITIAL_USER_NAME,
        ],
        videoId: "ktvTqknDobU",
        isRegistered: true,
      },
      {
        id: "c14",
        category: "volunteer",
        date: "2026-03-21",
        time: "20:30",
        title: "Kidz to Teens",
        currentSeats: 4,
        maxSeats: 7,
        participants: ["Artem", "Yuna", "Sumi", "Tae"],
        videoId: "RgKAFK5djSk",
        isRegistered: false,
      },
      {
        id: "c15",
        category: "regular",
        date: "2026-03-20",
        time: "19:00",
        title: "Neon Footwork Party",
        currentSeats: 12,
        maxSeats: 18,
        participants: [
          "Mina",
          "Jin",
          "Sora",
          "Hana",
          "Leo",
          "Nami",
          "Arin",
          "Ken",
          "Cha",
          "Soo",
          "Min",
          "Nari",
        ],
        videoId: "Zi_XLOBDo_Y",
        isRegistered: false,
      },
    ],
    []
  );

  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [visibleCount, setVisibleCount] = useState(5);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const [customCourses, setCustomCourses] = useState<Course[]>([]);

  const [courseState, setCourseState] = useState<Record<string, Course>>(() => {
    const initial: Record<string, Course> = {};
    for (const c of courses) initial[c.id] = c;
    return initial;
  });

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createDate, setCreateDate] = useState("");
  const [createTime, setCreateTime] = useState("");
  const [createClassName, setCreateClassName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createMaxSeats, setCreateMaxSeats] = useState("");
  const [createYoutubeUrl, setCreateYoutubeUrl] = useState("");

  const todayISO = useMemo(() => toLocalISODateString(new Date()), []);
  const timeOptions = useMemo(() => generateTimeOptions(18, 22), []);

  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
  const timeDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isTimeDropdownOpen) return;

    const onMouseDown = (e: MouseEvent) => {
      const el = timeDropdownRef.current;
      if (!el) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (!el.contains(target)) setIsTimeDropdownOpen(false);
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isTimeDropdownOpen]);

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const calendarDropdownRef = useRef<HTMLDivElement | null>(null);
  const [calendarCurrentDate, setCalendarCurrentDate] = useState<Date>(() => new Date());
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<string>(todayISO);

  useEffect(() => {
    if (!isCalendarOpen) return;

    const onMouseDown = (e: MouseEvent) => {
      const el = calendarDropdownRef.current;
      if (!el) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (!el.contains(target)) setIsCalendarOpen(false);
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isCalendarOpen]);

  const filteredSorted = useMemo(() => {
    const allCourses = [...courses, ...customCourses];
    const list = allCourses
      .map((c) => courseState[c.id] ?? c)
      .filter((c) => {
        if (activeFilter === "all") return c.category === "regular" || c.category === "volunteer";
        if (activeFilter === "my") return c.isRegistered;
        return c.category === activeFilter;
      });

    list.sort((a, b) => getCourseDateTimeKey(b) - getCourseDateTimeKey(a));
    return list;
  }, [activeFilter, courseState, courses, customCourses]);

  const visibleCourses = filteredSorted.slice(0, visibleCount);
  const selectedCourse = selectedCourseId
    ? courseState[selectedCourseId]
    : null;

  const handleMore = () => {
    if (isLoadingMore) return;
    if (visibleCount >= filteredSorted.length) return;

    setIsLoadingMore(true);
    window.setTimeout(() => {
      setVisibleCount((v) => Math.min(v + 5, filteredSorted.length));
      setIsLoadingMore(false);
    }, 700);
  };

  const handleSelectCourse = (id: string) => setSelectedCourseId(id);
  const handleCloseModal = () => setSelectedCourseId(null);

  const updateCourse = (id: string, updater: (prev: Course) => Course) => {
    setCourseState((prev) => {
      const current = prev[id];
      if (!current) return prev;
      return { ...prev, [id]: updater(current) };
    });
  };

  const handleAction = (
    id: string,
    action: "register" | "cancel" | "wait" | "waitCancel"
  ) => {
    const c = courseState[id];
    if (!c) return;

    const remaining = c.maxSeats - c.currentSeats;

    if (action === "wait") {
      updateCourse(id, (prev) => {
        const waitlist = prev.waitlist ?? [];
        const alreadyWaiting = waitlist.includes(INITIAL_USER_NAME);
        if (alreadyWaiting || prev.isRegistered) return prev;
        return {
          ...prev,
          isRegistered: false,
          waitlist: [...waitlist, INITIAL_USER_NAME],
        };
      });

      // Mock: 대기열이 있을 때 누군가 취소하면 대기순번대로 승격되도록 시뮬레이션합니다.
      window.setTimeout(() => {
        setCourseState((prev) => {
          const c = prev[id];
          if (!c) return prev;
          const waitlist = c.waitlist ?? [];
          const isStillWaiting = waitlist.includes(INITIAL_USER_NAME);
          if (!isStillWaiting) return prev;

          const remainingNow = c.maxSeats - c.currentSeats;
          if (remainingNow > 0) return prev; // 이미 자리가 생긴 상태면 승격을 보장하지 않습니다.
          if (waitlist.length === 0) return prev;

          const promoted = waitlist[0];
          const rest = waitlist.slice(1);

          // 누군가 1명이 취소했다고 가정(참가자 명단에서 1명 제거)
          const cancelled =
            c.participants.find((p) => p !== INITIAL_USER_NAME) ??
            c.participants[0];
          const participantsAfterCancel = cancelled
            ? c.participants.filter((p) => p !== cancelled)
            : c.participants;

          const participantsAfterPromote = participantsAfterCancel.includes(promoted)
            ? participantsAfterCancel
            : [...participantsAfterCancel, promoted];

          const seatsAfterCancel = Math.max(0, c.currentSeats - 1);
          const currentSeatsAfterPromote = Math.min(
            c.maxSeats,
            seatsAfterCancel + 1
          );

          return {
            ...prev,
            [id]: {
              ...c,
              isRegistered: promoted === INITIAL_USER_NAME,
              currentSeats: currentSeatsAfterPromote,
              participants: participantsAfterPromote,
              waitlist: rest,
            },
          };
        });
      }, 2500);
      return;
    }

    if (action === "register") {
      if (remaining <= 0) return;

      updateCourse(id, (prev) => {
        const waitlist = prev.waitlist ?? [];
        if (prev.isRegistered) return prev;
        const nextParticipants = prev.participants.includes(INITIAL_USER_NAME)
          ? prev.participants
          : [...prev.participants, INITIAL_USER_NAME];

        const nextWaitlist = waitlist.filter((p) => p !== INITIAL_USER_NAME);
        return {
          ...prev,
          isRegistered: true,
          currentSeats: Math.min(prev.maxSeats, prev.currentSeats + 1),
          participants: nextParticipants,
          waitlist: nextWaitlist,
        };
      });
      return;
    }

    if (action === "waitCancel") {
      updateCourse(id, (prev) => {
        const waitlist = prev.waitlist ?? [];
        if (!waitlist.includes(INITIAL_USER_NAME)) return prev;
        return { ...prev, waitlist: waitlist.filter((p) => p !== INITIAL_USER_NAME) };
      });
      return;
    }

    if (action === "cancel") {
      updateCourse(id, (prev) => {
        const nextWaitlist = (prev.waitlist ?? []).filter(
          (p) => p !== INITIAL_USER_NAME
        );

        // 내 신청 취소 -> 좌석 1석 해제
        const nextParticipants = prev.participants.filter(
          (p) => p !== INITIAL_USER_NAME
        );
        let nextCurrent = Math.max(0, prev.currentSeats - 1);

        // 대기열이 있으면 1명 승격
        if (nextCurrent < prev.maxSeats && nextWaitlist.length > 0) {
          const promoted = nextWaitlist[0];
          const rest = nextWaitlist.slice(1);

          const participantsNoDup = nextParticipants.includes(promoted)
            ? nextParticipants
            : [...nextParticipants, promoted];

          nextCurrent = Math.min(prev.maxSeats, nextCurrent + 1);

          return {
            ...prev,
            isRegistered: promoted === INITIAL_USER_NAME,
            currentSeats: nextCurrent,
            participants: participantsNoDup,
            waitlist: rest,
          };
        }

        return {
          ...prev,
          isRegistered: false,
          currentSeats: nextCurrent,
          participants: nextParticipants,
          waitlist: nextWaitlist,
        };
      });
    }
  };

  const handleCreateSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreateError(null);

    const trimmedName = createClassName.trim();
    const trimmedDesc = createDescription.trim();
    const trimmedYoutube = createYoutubeUrl.trim();
    const trimmedDate = createDate.trim();
    const trimmedTime = createTime.trim();

    const seatsNum = Number(createMaxSeats);

    const missing =
      !trimmedDate ||
      !trimmedTime ||
      !trimmedName ||
      !createMaxSeats ||
      Number.isNaN(seatsNum) ||
      seatsNum <= 0;

    if (missing) {
      setCreateError("입력되지 않은 항목이 있습니다.");
      return;
    }

    const extractedVideoId = trimmedYoutube
      ? extractYouTubeVideoId(trimmedYoutube)
      : null;

    // 썸네일/버튼용 기본값(유튜브 링크가 비어있을 수 있으므로)
    const placeholderVideoId = "dQw4w9WgXcQ";
    const videoId = extractedVideoId ?? placeholderVideoId;

    const newCourse: Course = {
      id: `new-${Date.now()}`,
      category: "regular",
      date: trimmedDate,
      time: trimmedTime,
      title: trimmedName,
      description: trimmedDesc || undefined,
      currentSeats: 0,
      maxSeats: Math.floor(seatsNum),
      participants: [],
      videoId,
      youtubeUrl: trimmedYoutube || undefined,
      isRegistered: false,
      waitlist: [],
    };

    setCustomCourses((prev) => [...prev, newCourse]);
    setCourseState((prev) => ({ ...prev, [newCourse.id]: newCourse }));

    setIsCreateOpen(false);
    setCreateError(null);
    setCreateDate("");
    setCreateTime("");
    setCreateClassName("");
    setCreateDescription("");
    setCreateMaxSeats("");
    setCreateYoutubeUrl("");

    alert("저장되었습니다.");
  };

  const calendarYear = calendarCurrentDate.getFullYear();
  const calendarMonthIndex = calendarCurrentDate.getMonth();
  const calendarDaysInMonth = new Date(
    calendarYear,
    calendarMonthIndex + 1,
    0
  ).getDate();
  const calendarFirstDayOfWeek = new Date(
    calendarYear,
    calendarMonthIndex,
    1
  ).getDay(); // 0: 일요일 ... 6: 토요일
  const calendarGridDays = Array.from({ length: 42 }, (_, i) => {
    const dayNum = i - calendarFirstDayOfWeek + 1;
    if (dayNum < 1 || dayNum > calendarDaysInMonth) return null;
    return dayNum;
  });

  const categoryButtons: Array<{ key: FilterKey; label: string }> = [
    { key: "all", label: "전체" },
    { key: "regular", label: "정규클래스" },
    { key: "volunteer", label: "품앗이" },
    { key: "my", label: "내 클래스" },
  ];

  return (
    <div className="min-h-dvh bg-black text-zinc-50">
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-violet-400 to-cyan-300">
              Kroove
            </span>
          </h1>

          <button
            type="button"
            onClick={() => {
              setCreateError(null);
              setCreateDate(todayISO);
              setCreateTime("19:10");
              setCreateClassName("");
              setCreateDescription("");
              setCreateMaxSeats("");
              setCreateYoutubeUrl("");
              setIsTimeDropdownOpen(false);
              setIsCalendarOpen(false);
              setCalendarCurrentDate(new Date());
              setCalendarSelectedDate(todayISO);
              setIsCreateOpen(true);
              setSelectedCourseId(null);
            }}
            className="shrink-0 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_40px_rgba(192,132,252,0.25)] hover:brightness-110 active:brightness-95 transition"
          >
            클래스열기
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {categoryButtons.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => {
                setActiveFilter(b.key);
                setVisibleCount(5);
              }}
              className={[
                "shrink-0 rounded-full px-4 py-2 text-sm font-semibold border transition",
                activeFilter === b.key
                  ? "border-fuchsia-400/60 bg-fuchsia-500/10 text-fuchsia-200 shadow-[0_0_0_3px_rgba(232,121,249,0.14)]"
                  : "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10",
              ].join(" ")}
            >
              {b.label}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {visibleCourses.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-zinc-400">
              선택한 종류의 수업이 없습니다.
            </div>
          ) : (
            visibleCourses.map((c) => {
              const remaining = c.maxSeats - c.currentSeats;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    if (isCreateOpen) return;
                    handleSelectCourse(c.id);
                  }}
                  className="w-full text-left rounded-2xl border border-white/10 bg-zinc-900/40 hover:bg-zinc-900/60 transition shadow-[0_18px_50px_rgba(0,0,0,0.35)] p-4"
                >
                  <div className="flex gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {c.category === "regular" || c.category === "volunteer" ? (
                            <div
                              className={[
                                "rounded-full px-2 py-1 text-[11px] font-bold",
                                c.category === "regular"
                                  ? "bg-fuchsia-500/15 text-fuchsia-200"
                                  : "bg-cyan-400/15 text-cyan-200",
                              ].join(" ")}
                            >
                              {c.category === "regular" ? "정규" : "품앗이"}
                            </div>
                          ) : null}
                          <div className="text-xs font-semibold text-zinc-300">
                            {formatDateKorean(c.date)} · {c.time}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 text-lg font-black tracking-tight">
                        {c.title}
                      </div>

                      <div className="mt-2 flex items-center gap-2 text-sm text-zinc-300">
                        <span className="font-semibold">
                          수강인원 {c.currentSeats}/{c.maxSeats}
                        </span>
                        {(() => {
                          const isWaiting =
                            (c.waitlist ?? []).includes(INITIAL_USER_NAME);
                          if (c.isRegistered) {
                            return (
                              <span className="ml-1 rounded-full border border-yellow-400/30 bg-yellow-500/10 px-2 py-1 text-[11px] font-bold text-yellow-200">
                                신청 완료
                              </span>
                            );
                          }
                          if (remaining > 0) {
                            return (
                              <span className="ml-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-200">
                                {remaining}석 남음
                              </span>
                            );
                          }
                          if (isWaiting) {
                            return (
                              <span className="ml-1 rounded-full border border-yellow-400/30 bg-yellow-500/10 px-2 py-1 text-[11px] font-bold text-yellow-200">
                                대기 중
                              </span>
                            );
                          }
                          return (
                            <span className="ml-1 rounded-full border border-red-400/30 bg-red-500/10 px-2 py-1 text-[11px] font-bold text-red-200">
                              정원 초과
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="shrink-0">
                      <img
                        src={`https://img.youtube.com/vi/${c.videoId}/0.jpg`}
                        alt={`${c.title} thumbnail`}
                        className="h-20 w-28 rounded-xl border border-white/10 object-cover"
                      />
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="mt-5 flex justify-center">
          {visibleCourses.length < filteredSorted.length ? (
            <button
              type="button"
              onClick={handleMore}
              disabled={isLoadingMore}
              className="w-full max-w-xs rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-zinc-100 hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {isLoadingMore ? "로딩 중..." : "더보기"}
            </button>
          ) : null}
        </div>
      </div>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-60 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-hidden
          />

          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-lg rounded-[1.5rem] border border-white/10 bg-zinc-950/90 shadow-[0_30px_90px_rgba(0,0,0,0.65)]"
          >
            <form onSubmit={handleCreateSubmit}>
              <div className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <label
                      htmlFor="create-date"
                      className="block text-sm font-medium text-zinc-200 mb-2"
                    >
                      날짜
                    </label>
                    <div ref={calendarDropdownRef} className="relative">
                      <button
                        type="button"
                        id="create-date"
                        onClick={() => setIsCalendarOpen((v) => !v)}
                        className="w-full rounded-xl bg-zinc-800/60 border border-white/10 px-4 py-3 text-zinc-50 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60 focus:border-fuchsia-400/40"
                      >
                        {createDate || "날짜 선택"}
                      </button>

                      {isCalendarOpen ? (
                        <div className="absolute z-50 left-0 right-0 mt-2 max-h-fit overflow-y-auto rounded-xl border border-white/10 bg-zinc-800/60 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.45)] p-3">
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setCalendarCurrentDate(
                                  new Date(calendarYear, calendarMonthIndex - 1, 1)
                                )
                              }
                              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10 transition"
                            >
                              {"<"}
                            </button>

                            <div className="text-sm font-semibold text-zinc-100">
                              {calendarYear}년 {calendarMonthIndex + 1}월
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setCalendarCurrentDate(
                                  new Date(calendarYear, calendarMonthIndex + 1, 1)
                                )
                              }
                              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10 transition"
                            >
                              {">"}
                            </button>
                          </div>

                          <div className="mt-2 grid grid-cols-7 gap-1 text-[12px] text-zinc-500">
                            {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
                              <div
                                key={d}
                                className="h-9 flex items-center justify-center text-center"
                              >
                                {d}
                              </div>
                            ))}
                          </div>

                          <div className="mt-2 grid grid-cols-7 gap-1">
                            {calendarGridDays.map((dayNum, idx) => {
                              if (!dayNum) {
                                return (
                                  <div
                                    key={`empty-${idx}`}
                                    className="h-9 w-full flex items-center justify-center"
                                  />
                                );
                              }

                              const iso = `${calendarYear}-${String(calendarMonthIndex + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                              const isPast = iso < todayISO;
                              const isSelected =
                                iso === (calendarSelectedDate ?? createDate);

                              return (
                                <div
                                  key={iso}
                                  className="h-9 w-full flex items-center justify-center"
                                >
                                  <button
                                    type="button"
                                    disabled={isPast}
                                    onClick={() => {
                                      if (isPast) return;
                                      setCalendarSelectedDate(iso);
                                      setCreateDate(iso);
                                      setIsCalendarOpen(false);
                                    }}
                                    className={[
                                      "h-9 w-9 rounded-full text-sm font-semibold transition flex items-center justify-center",
                                      isPast
                                        ? "text-zinc-600 cursor-not-allowed bg-zinc-900/20"
                                        : isSelected
                                          ? "bg-fuchsia-500 text-white"
                                          : "text-zinc-200 hover:bg-zinc-700/60 bg-zinc-900/10",
                                    ].join(" ")}
                                  >
                                    {dayNum}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="create-time"
                      className="block text-sm font-medium text-zinc-200 mb-2"
                    >
                      시간
                    </label>
                    <div ref={timeDropdownRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setIsTimeDropdownOpen((v) => !v)}
                        className="w-full rounded-xl bg-zinc-800/60 border border-white/10 px-4 py-3 text-zinc-50 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60 focus:border-fuchsia-400/40"
                      >
                        {createTime || "시간 선택"}
                      </button>

                      {isTimeDropdownOpen ? (
                        <ul className="absolute left-0 right-0 z-50 mt-2 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-zinc-900/70 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.45)] py-1">
                          {timeOptions.map((t) => {
                            const isSelected = t === createTime;
                            return (
                              <li key={t}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCreateTime(t);
                                    setIsTimeDropdownOpen(false);
                                  }}
                                  className={[
                                    "w-full px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800/60 transition",
                                    isSelected
                                      ? "bg-fuchsia-500/15 text-fuchsia-200 font-semibold"
                                      : "",
                                  ].join(" ")}
                                >
                                  {t}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="create-class-name"
                      className="block text-sm font-medium text-zinc-200 mb-2"
                    >
                      클래스명
                    </label>
                    <input
                      id="create-class-name"
                      name="create-class-name"
                      value={createClassName}
                      onChange={(e) => setCreateClassName(e.target.value)}
                      placeholder="곡명/안무명"
                      className="w-full rounded-xl bg-zinc-800/60 border border-white/10 px-4 py-3 text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60 focus:border-fuchsia-400/40"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="create-description"
                      className="block text-sm font-medium text-zinc-200 mb-2"
                    >
                      클래스설명 (선택)
                    </label>
                    <textarea
                      id="create-description"
                      name="create-description"
                      value={createDescription}
                      onChange={(e) => setCreateDescription(e.target.value)}
                      placeholder="예상 소요시간, 난이도, 안무포인트 및 크루에게 한마디 등을 자유롭게 적어주세요."
                      rows={3}
                      className="w-full resize-none rounded-xl bg-zinc-800/60 border border-white/10 px-4 py-3 text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60 focus:border-fuchsia-400/40"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="create-max-seats"
                      className="block text-sm font-medium text-zinc-200 mb-2"
                    >
                      수강인원
                    </label>
                    <input
                      id="create-max-seats"
                      name="create-max-seats"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={createMaxSeats}
                      onChange={(e) =>
                        setCreateMaxSeats(e.target.value.replace(/[^\d]/g, ""))
                      }
                      placeholder="최대인원을 입력해주세요."
                      className="w-full rounded-xl bg-zinc-800/60 border border-white/10 px-4 py-3 text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60 focus:border-fuchsia-400/40"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="create-youtube"
                      className="block text-sm font-medium text-zinc-200 mb-2"
                    >
                      유튜브 링크 (선택)
                    </label>
                    <input
                      id="create-youtube"
                      name="create-youtube"
                      value={createYoutubeUrl}
                      onChange={(e) => setCreateYoutubeUrl(e.target.value)}
                      placeholder="참고할 영상이 있다면 추가해주세요."
                      type="url"
                      className="w-full rounded-xl bg-zinc-800/60 border border-white/10 px-4 py-3 text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60 focus:border-fuchsia-400/40"
                    />
                  </div>
                </div>
              </div>

              {createError ? (
                <div className="px-5 sm:px-6 -mt-2">
                  <p className="text-sm font-semibold text-red-500">
                    {createError}
                  </p>
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pb-5">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setIsTimeDropdownOpen(false);
                    setIsCalendarOpen(false);
                  }}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 hover:bg-white/10 transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(192,132,252,0.35)] hover:brightness-110 active:brightness-95 transition"
                >
                  클래스열기
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {selectedCourse ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleCloseModal}
            aria-hidden
          />

          <div className="relative w-full max-w-lg rounded-[1.5rem] border border-white/10 bg-zinc-950/90 shadow-[0_30px_90px_rgba(0,0,0,0.65)]">
            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-zinc-300">
                    {formatDateKorean(selectedCourse.date)} · {selectedCourse.time}
                  </div>
                  <div className="mt-1 text-xl font-black tracking-tight">
                    {selectedCourse.title}
                  </div>
                  <div className="mt-3 text-sm text-zinc-300">
                    수강인원 {selectedCourse.currentSeats}/{selectedCourse.maxSeats}
                  </div>

                  {selectedCourse.description ? (
                    <div className="mt-3 text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap">
                      {selectedCourse.description}
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-zinc-200 hover:bg-white/10 transition"
                >
                  닫기
                </button>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-1">
                <div>
                  <div className="text-sm font-bold text-zinc-200">수강자 명단</div>
                  <div className="mt-2 max-h-44 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3">
                    <div className="text-sm leading-relaxed text-zinc-200">
                      {selectedCourse.participants.length === 0 ? (
                        <span className="text-zinc-500">—</span>
                      ) : (
                        selectedCourse.participants.map((name, idx) => (
                          <span key={`${name}-${idx}`}>
                            {idx > 0 ? ", " : null}
                            <span
                              className={
                                name === INITIAL_USER_NAME
                                  ? "font-bold text-fuchsia-200"
                                  : undefined
                              }
                            >
                              {name}
                            </span>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-bold text-zinc-200">유튜브</div>
                  <a
                    href={
                      selectedCourse.youtubeUrl ??
                      `https://www.youtube.com/watch?v=${selectedCourse.videoId}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-100 hover:bg-white/10 transition"
                  >
                    영상 보기
                  </a>
                </div>

                <div className="pt-1">
                  {(() => {
                    const remaining = selectedCourse.maxSeats - selectedCourse.currentSeats;
                    const waitlist = selectedCourse.waitlist ?? [];
                    const isWaiting = waitlist.includes(INITIAL_USER_NAME);

                    if (isWaiting) {
                      return (
                        <>
                          <button
                            type="button"
                            onClick={() => handleAction(selectedCourse.id, "waitCancel")}
                            className="w-full rounded-xl bg-red-500 px-4 py-3 text-sm font-extrabold text-white shadow-[0_20px_60px_rgba(239,68,68,0.22)] hover:brightness-110 active:brightness-95 transition"
                          >
                            대기취소
                          </button>
                        </>
                      );
                    }

                    if (!selectedCourse.isRegistered && remaining > 0) {
                      return (
                        <button
                          type="button"
                          onClick={() => handleAction(selectedCourse.id, "register")}
                          className="w-full rounded-xl bg-blue-500 px-4 py-3 text-sm font-extrabold text-white shadow-[0_20px_60px_rgba(59,130,246,0.25)] hover:brightness-110 active:brightness-95 transition"
                        >
                          신청하기
                        </button>
                      );
                    }

                    if (!selectedCourse.isRegistered && remaining <= 0) {
                      return (
                        <button
                          type="button"
                          onClick={() => handleAction(selectedCourse.id, "wait")}
                          className="w-full rounded-xl bg-yellow-400 px-4 py-3 text-sm font-extrabold text-black shadow-[0_20px_60px_rgba(250,204,21,0.20)] hover:brightness-110 active:brightness-95 transition"
                        >
                          대기하기
                        </button>
                      );
                    }

                    return (
                      <button
                        type="button"
                        onClick={() => handleAction(selectedCourse.id, "cancel")}
                        className="w-full rounded-xl bg-red-500 px-4 py-3 text-sm font-extrabold text-white shadow-[0_20px_60px_rgba(239,68,68,0.22)] hover:brightness-110 active:brightness-95 transition"
                      >
                        취소하기
                      </button>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
