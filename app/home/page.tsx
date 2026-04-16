"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";

type ClassType = "정규" | "품앗이";
type FilterKey = "all" | "my" | ClassType;

type DbClassRow = {
  id: string | number;
  class_type?: string | null;
  date?: string | null;
  time?: string | null;
  title?: string | null;
  class_name?: string | null;
  description?: string | null;
  max_participants?: number | null;
  current_participants?: number | null;
  participants?: string[] | null;
  video_id?: string | null;
  youtube_url?: string | null;
};

type BookingRow = {
  myStatus?: "completed" | "pending" | null;
  applicantLdaps?: string[];
  currentSeats?: number;
  maxSeats?: number;
};

type AuthMeResponse = {
  member?: {
    ldap?: string | null;
    role?: "member" | "manager" | "head" | null;
  };
};

type ClassCard = {
  id: string;
  classType: ClassType;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  title: string;
  description?: string;
  currentSeats: number;
  maxSeats: number;
  participants: string[];
  videoId?: string;
  youtubeUrl?: string;
  isRegistered: boolean;
};

const INITIAL_USER_NAME = "Kroove Member";

function extractYouTubeVideoId(input?: string | null): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;

  const vMatch = raw.match(/[?&]v=([A-Za-z0-9_-]{6,})/);
  if (vMatch?.[1]) return vMatch[1];

  const shortMatch = raw.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/);
  if (shortMatch?.[1]) return shortMatch[1];

  const embedMatch = raw.match(/\/(?:embed|vi)\/([A-Za-z0-9_-]{6,})/);
  if (embedMatch?.[1]) return embedMatch[1];

  const shortsMatch = raw.match(/\/shorts\/([A-Za-z0-9_-]{6,})/);
  if (shortsMatch?.[1]) return shortsMatch[1];

  return null;
}

function normalizeDate(value?: string | null) {
  if (!value) return "1970-01-01";
  const dateOnly = value.includes("T") ? value.split("T")[0] : value;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateOnly) ? dateOnly : "1970-01-01";
}

function normalizeTime(value?: string | null) {
  if (!value) return "00:00";
  const hhmm = value.slice(0, 5);
  return /^\d{2}:\d{2}$/.test(hhmm) ? hhmm : "00:00";
}

function formatDateKorean(yyyyMmDd: string) {
  const d = new Date(`${yyyyMmDd}T00:00:00`);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${month}.${day} (${weekday})`;
}

function toTimestamp(date: string, time: string) {
  return new Date(`${date}T${time}:00`).getTime();
}

function getTodayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function generateTimeOptions(
  startHH: number,
  endHH: number,
  minuteStep = 10,
  endMinute = 50
) {
  const times: string[] = [];
  for (let hh = startHH; hh <= endHH; hh++) {
    for (let mm = 0; mm < 60; mm += minuteStep) {
      if (hh === endHH && mm > endMinute) continue;
      times.push(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
    }
  }
  return times;
}

function mapRowToCard(row: DbClassRow): ClassCard {
  const classType: ClassType = row.class_type === "품앗이" ? "품앗이" : "정규";
  const participants = Array.isArray(row.participants) ? row.participants : [];
  const currentSeats =
    typeof row.current_participants === "number" && row.current_participants >= 0
      ? row.current_participants
      : participants.length;
  const maxSeats =
    typeof row.max_participants === "number" && row.max_participants >= 0
      ? row.max_participants
      : currentSeats;

  const extractedVideoId = extractYouTubeVideoId(row.youtube_url);
  const resolvedVideoId = row.video_id ?? extractedVideoId ?? undefined;

  return {
    id: String(row.id),
    classType,
    date: normalizeDate(row.date),
    time: normalizeTime(row.time),
    title: row.title ?? row.class_name ?? "제목 없음 클래스",
    description: row.description ?? undefined,
    currentSeats,
    maxSeats,
    participants,
    videoId: resolvedVideoId,
    youtubeUrl: row.youtube_url ?? undefined,
    isRegistered: participants.includes(INITIAL_USER_NAME),
  };
}

export default function HomePage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassCard[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<ClassCard | null>(null);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [applicantLdaps, setApplicantLdaps] = useState<string[]>([]);
  const [isApplicantsLoading, setIsApplicantsLoading] = useState(false);
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);
  const [myBookingStatus, setMyBookingStatus] = useState<"completed" | "pending" | null>(null);
  const [currentLdap, setCurrentLdap] = useState("");
  const [currentRole, setCurrentRole] = useState<"member" | "manager" | "head" | null>(null);
  const [isMyMenuOpen, setIsMyMenuOpen] = useState(false);
  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newDate, setNewDate] = useState(getTodayISO());
  const [newTime, setNewTime] = useState("19:10");
  const [newIsFirstComeOpen, setNewIsFirstComeOpen] = useState(false);
  const [newOpenDate, setNewOpenDate] = useState(getTodayISO());
  const [newOpenTime, setNewOpenTime] = useState("13:30");
  const [newMaxParticipants, setNewMaxParticipants] = useState("");
  const [newClassType, setNewClassType] = useState<ClassType>("품앗이");
  const [newDescription, setNewDescription] = useState("");
  const [newYoutubeUrl, setNewYoutubeUrl] = useState("");
  const [isAddClassSubmitting, setIsAddClassSubmitting] = useState(false);
  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isOpenTimeDropdownOpen, setIsOpenTimeDropdownOpen] = useState(false);
  const [isOpenCalendarOpen, setIsOpenCalendarOpen] = useState(false);
  const [calendarCurrentDate, setCalendarCurrentDate] = useState<Date>(() => new Date());
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<string>(getTodayISO());
  const [openCalendarCurrentDate, setOpenCalendarCurrentDate] = useState<Date>(() => new Date());
  const [openCalendarSelectedDate, setOpenCalendarSelectedDate] = useState<string>(getTodayISO());
  const timeDropdownRef = useRef<HTMLDivElement | null>(null);
  const calendarDropdownRef = useRef<HTMLDivElement | null>(null);
  const openTimeDropdownRef = useRef<HTMLDivElement | null>(null);
  const openCalendarDropdownRef = useRef<HTMLDivElement | null>(null);
  const timeOptions = useMemo(() => generateTimeOptions(9, 21, 10, 0), []);
  const openTimeOptions = useMemo(() => generateTimeOptions(9, 21, 30, 0), []);

  useEffect(() => {
    const fetchMe = async () => {
      const response = await fetch("/api/auth/me", { method: "GET" });
      if (!response.ok) {
        setCurrentLdap("");
        setCurrentRole(null);
        return;
      }
      const json = (await response.json()) as AuthMeResponse;
      setCurrentLdap(json.member?.ldap ?? "");
      setCurrentRole(json.member?.role ?? null);
    };

    void fetchMe();
  }, []);

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

  useEffect(() => {
    if (!isOpenTimeDropdownOpen) return;

    const onMouseDown = (e: MouseEvent) => {
      const el = openTimeDropdownRef.current;
      if (!el) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (!el.contains(target)) setIsOpenTimeDropdownOpen(false);
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isOpenTimeDropdownOpen]);

  useEffect(() => {
    if (!isOpenCalendarOpen) return;

    const onMouseDown = (e: MouseEvent) => {
      const el = openCalendarDropdownRef.current;
      if (!el) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (!el.contains(target)) setIsOpenCalendarOpen(false);
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isOpenCalendarOpen]);

  useEffect(() => {
    const fetchClasses = async () => {
      setIsLoading(true);
      const { data, error } = await supabase.from("classes").select("*");

      if (error) {
        console.error("classes fetch error:", error.message);
        setClasses([]);
        setIsLoading(false);
        return;
      }

      setClasses(((data ?? []) as DbClassRow[]).map(mapRowToCard));
      setIsLoading(false);
    };

    void fetchClasses();
  }, []);

  useEffect(() => {
    if (!selectedClassId) return;

    const fetchClassDetail = async () => {
      setIsModalLoading(true);
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .eq("id", selectedClassId)
        .single();

      if (error || !data) {
        console.error("class detail fetch error:", error?.message);
        setSelectedClass(null);
        setIsModalLoading(false);
        return;
      }

      setSelectedClass(mapRowToCard(data as DbClassRow));
      setIsModalLoading(false);
    };

    void fetchClassDetail();
  }, [selectedClassId]);

  const fetchBookingState = async (classId: string) => {
    setIsApplicantsLoading(true);
    setBookingMessage(null);

    const response = await fetch(`/api/bookings?classId=${encodeURIComponent(classId)}`, {
      method: "GET",
    });
    const result = (await response.json()) as BookingRow & { message?: string };
    if (!response.ok) {
      setApplicantLdaps([]);
      setMyBookingStatus(null);
      setBookingMessage(result.message ?? "신청 상태를 불러오지 못했습니다.");
      setIsApplicantsLoading(false);
      return;
    }

    setApplicantLdaps(result.applicantLdaps ?? []);
    setMyBookingStatus(result.myStatus ?? null);
    if (typeof result.currentSeats === "number") {
      setClasses((prev) =>
        prev.map((item) =>
          item.id === classId ? { ...item, currentSeats: result.currentSeats ?? item.currentSeats } : item
        )
      );
      setSelectedClass((prev) =>
        prev && prev.id === classId ? { ...prev, currentSeats: result.currentSeats ?? 0 } : prev
      );
    }
    setIsApplicantsLoading(false);
  };

  useEffect(() => {
    if (!selectedClassId) return;
    void fetchBookingState(selectedClassId);
  }, [selectedClassId, currentLdap]);

  const handleBookingAction = async () => {
    if (!selectedClassId || isBookingSubmitting) return;

    setIsBookingSubmitting(true);
    setBookingMessage(null);

    if (!currentLdap) {
      setBookingMessage("로그인 정보가 없습니다. 다시 로그인해주세요.");
      setIsBookingSubmitting(false);
      return;
    }

    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId: selectedClassId }),
    });
    const result = (await response.json()) as BookingRow & { message?: string };
    if (!response.ok) {
      setBookingMessage(result.message ?? "신청 처리에 실패했습니다.");
      setIsBookingSubmitting(false);
      return;
    }

    setBookingMessage(null);
    setApplicantLdaps(result.applicantLdaps ?? []);
    setMyBookingStatus(result.myStatus ?? null);
    if (typeof result.currentSeats === "number") {
      setClasses((prev) =>
        prev.map((item) =>
          item.id === selectedClassId
            ? { ...item, currentSeats: result.currentSeats ?? item.currentSeats }
            : item
        )
      );
      setSelectedClass((prev) =>
        prev && prev.id === selectedClassId
          ? { ...prev, currentSeats: result.currentSeats ?? prev.currentSeats }
          : prev
      );
    }
    setIsBookingSubmitting(false);
  };

  const filteredClasses = useMemo(() => {
    const list = classes.filter((item) => {
      if (activeFilter === "all") return true;
      if (activeFilter === "my") return item.isRegistered;
      return item.classType === activeFilter;
    });

    return list.sort(
      (a, b) => toTimestamp(b.date, b.time) - toTimestamp(a.date, a.time)
    );
  }, [activeFilter, classes]);

  const tabs: Array<{ key: FilterKey; label: string }> = [
    { key: "all", label: "전체" },
    { key: "정규", label: "정규클래스" },
    { key: "품앗이", label: "품앗이" },
    { key: "my", label: "내 클래스" },
  ];
  const isClassFull =
    selectedClass ? selectedClass.currentSeats >= selectedClass.maxSeats : false;
  const bookingButtonLabel = isBookingSubmitting
    ? "처리 중..."
    : myBookingStatus
      ? "취소"
      : isClassFull
        ? "대기"
        : "클래스 참여";

  const handleLogout = async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleSubmitAddClass = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isAddClassSubmitting) return;

    setIsAddClassSubmitting(true);
    const response = await fetch("/api/admin/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        className: newClassName.trim(),
        date: newDate.trim(),
        time: newTime.trim(),
        isFirstComeOpen: newClassType === "정규" ? newIsFirstComeOpen : undefined,
        openDate:
          newClassType === "정규" && newIsFirstComeOpen
            ? newOpenDate.trim()
            : undefined,
        openTime:
          newClassType === "정규" && newIsFirstComeOpen
            ? newOpenTime.trim()
            : undefined,
        maxParticipants: Number(newMaxParticipants),
        classType: newClassType,
        description: newDescription.trim(),
        youtubeUrl: newYoutubeUrl.trim(),
      }),
    });

    const result = (await response.json()) as { message?: string };
    if (!response.ok) {
      alert(result.message ?? "클래스 등록에 실패했습니다.");
      setIsAddClassSubmitting(false);
      return;
    }

    const { data, error } = await supabase.from("classes").select("*");
    if (!error) {
      setClasses(((data ?? []) as DbClassRow[]).map(mapRowToCard));
    }
    setIsAddClassOpen(false);
    setNewClassName("");
    setNewDate(getTodayISO());
    setNewTime("19:10");
    setNewIsFirstComeOpen(false);
    setNewOpenDate(getTodayISO());
    setNewOpenTime("13:30");
    setNewMaxParticipants("");
    setNewClassType("품앗이");
    setNewDescription("");
    setNewYoutubeUrl("");
    setIsTimeDropdownOpen(false);
    setIsCalendarOpen(false);
    setIsOpenTimeDropdownOpen(false);
    setIsOpenCalendarOpen(false);
    setCalendarCurrentDate(new Date());
    setCalendarSelectedDate(getTodayISO());
    setOpenCalendarCurrentDate(new Date());
    setOpenCalendarSelectedDate(getTodayISO());
    setIsAddClassSubmitting(false);
    alert("클래스가 등록되었습니다!");
  };

  const calendarYear = calendarCurrentDate.getFullYear();
  const calendarMonthIndex = calendarCurrentDate.getMonth();
  const calendarDaysInMonth = new Date(calendarYear, calendarMonthIndex + 1, 0).getDate();
  const calendarFirstDayOfWeek = new Date(calendarYear, calendarMonthIndex, 1).getDay();
  const calendarGridDays = Array.from({ length: 42 }, (_, i) => {
    const dayNum = i - calendarFirstDayOfWeek + 1;
    if (dayNum < 1 || dayNum > calendarDaysInMonth) return null;
    return dayNum;
  });
  const openCalendarYear = openCalendarCurrentDate.getFullYear();
  const openCalendarMonthIndex = openCalendarCurrentDate.getMonth();
  const openCalendarDaysInMonth = new Date(openCalendarYear, openCalendarMonthIndex + 1, 0).getDate();
  const openCalendarFirstDayOfWeek = new Date(openCalendarYear, openCalendarMonthIndex, 1).getDay();
  const openCalendarGridDays = Array.from({ length: 42 }, (_, i) => {
    const dayNum = i - openCalendarFirstDayOfWeek + 1;
    if (dayNum < 1 || dayNum > openCalendarDaysInMonth) return null;
    return dayNum;
  });

  return (
    <div className="min-h-dvh bg-black text-zinc-50">
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-violet-400 to-cyan-300">
              Kroove
            </span>
          </h1>
          <div className="flex items-center gap-2">
            {currentRole === "head" || currentRole === "manager" ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsAddClassOpen(true)}
                  className="shrink-0 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_40px_rgba(192,132,252,0.25)] hover:brightness-110 active:brightness-95 transition"
                >
                  클래스개설
                </button>
                <Link
                  href="/admin/add-member"
                  className="shrink-0 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_40px_rgba(56,189,248,0.25)] hover:brightness-110 active:brightness-95 transition"
                >
                  크루관리
                </Link>
              </>
            ) : null}

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMyMenuOpen((v) => !v)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-100 hover:bg-white/10 transition"
                aria-label="마이 메뉴 열기"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden
                >
                  <path
                    d="M12 12C14.4853 12 16.5 9.98528 16.5 7.5C16.5 5.01472 14.4853 3 12 3C9.51472 3 7.5 5.01472 7.5 7.5C7.5 9.98528 9.51472 12 12 12Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M4 20.5C4.8 17.8 7.3 16 12 16C16.7 16 19.2 17.8 20 20.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>

              {isMyMenuOpen ? (
                <div className="absolute right-0 top-12 z-50 w-28 rounded-xl border border-white/10 bg-zinc-950/95 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10 transition"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden
                    >
                      <path
                        d="M10 7V5.5C10 4.67 10.67 4 11.5 4H18.5C19.33 4 20 4.67 20 5.5V18.5C20 19.33 19.33 20 18.5 20H11.5C10.67 20 10 19.33 10 18.5V17"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M14 12H4"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M7 9L4 12L7 15"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    로그아웃
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveFilter(tab.key)}
              className={[
                "shrink-0 rounded-full px-4 py-2 text-sm font-semibold border transition",
                activeFilter === tab.key
                  ? "border-fuchsia-400/60 bg-fuchsia-500/10 text-fuchsia-200 shadow-[0_0_0_3px_rgba(232,121,249,0.14)]"
                  : "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {isLoading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-zinc-400">
              로딩 중...
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-zinc-400">
              선택한 종류의 수업이 없습니다.
            </div>
          ) : (
            filteredClasses.map((item) => {
              const remaining = item.maxSeats - item.currentSeats;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedClassId(item.id)}
                  className="w-full text-left rounded-2xl border border-white/10 bg-zinc-900/40 shadow-[0_18px_50px_rgba(0,0,0,0.35)] p-4"
                >
                  <div className="flex gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <div
                          className={[
                            "rounded-full px-2 py-1 text-[11px] font-bold",
                            item.classType === "정규"
                              ? "bg-fuchsia-500/15 text-fuchsia-200"
                              : "bg-cyan-400/15 text-cyan-200",
                          ].join(" ")}
                        >
                          {item.classType}
                        </div>
                        <div className="text-xs font-semibold text-zinc-300">
                          {formatDateKorean(item.date)} · {item.time}
                        </div>
                      </div>

                      <div className="mt-2 text-lg font-black tracking-tight">
                        {item.title}
                      </div>

                      {item.description ? (
                        <div className="mt-1 text-sm text-zinc-400 line-clamp-2">
                          {item.description}
                        </div>
                      ) : null}

                      <div className="mt-2 flex items-center gap-2 text-sm text-zinc-300">
                        <span className="font-semibold">
                          수강인원 {item.currentSeats}/{item.maxSeats}
                        </span>
                        {remaining > 0 ? (
                          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-200">
                            {remaining}석 남음
                          </span>
                        ) : (
                          <span className="rounded-full border border-red-400/30 bg-red-500/10 px-2 py-1 text-[11px] font-bold text-red-200">
                            정원 초과
                          </span>
                        )}
                      </div>
                    </div>

                    {item.youtubeUrl ? (
                      <a
                        href={item.youtubeUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="relative block h-20 w-28"
                        aria-label={`${item.title} 유튜브 열기`}
                      >
                        {item.videoId ? (
                          <img
                            src={`https://img.youtube.com/vi/${item.videoId}/0.jpg`}
                            alt={`${item.title} thumbnail`}
                            className="h-20 w-28 rounded-xl border border-white/10 object-cover"
                          />
                        ) : (
                          <div className="h-20 w-28 rounded-xl border border-white/10 bg-gradient-to-br from-fuchsia-500/30 via-violet-500/25 to-cyan-400/25" />
                        )}
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <span className="rounded-full bg-black/55 px-2 py-1 text-xs font-black text-white">
                            ►
                          </span>
                        </span>
                      </a>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {selectedClassId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            aria-label="닫기"
            onClick={() => {
              setSelectedClassId(null);
              setSelectedClass(null);
              setApplicantLdaps([]);
              setBookingMessage(null);
              setMyBookingStatus(null);
            }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          <div className="relative z-10 w-full max-w-lg rounded-[1.5rem] border border-white/10 bg-zinc-950/90 shadow-[0_30px_90px_rgba(0,0,0,0.65)] p-5 sm:p-6">
            {isModalLoading ? (
              <div className="flex flex-col items-center justify-center py-10">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-fuchsia-400" />
                <p className="mt-3 text-sm text-zinc-400">로딩 중...</p>
              </div>
            ) : selectedClass ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-zinc-300">
                      {formatDateKorean(selectedClass.date)} · {selectedClass.time}
                    </div>
                    <h2 className="mt-1 text-xl font-black tracking-tight">
                      {selectedClass.title}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClassId(null);
                      setSelectedClass(null);
                      setApplicantLdaps([]);
                      setBookingMessage(null);
                      setMyBookingStatus(null);
                    }}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-zinc-200 hover:bg-white/10 transition"
                  >
                    닫기
                  </button>
                </div>

                {selectedClass.description ? (
                  <div className="mt-3 whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-4 text-sm leading-relaxed text-zinc-200">
                    {selectedClass.description}
                  </div>
                ) : null}

                <div className="mt-4 text-sm text-zinc-300">
                  수강인원 {selectedClass.currentSeats}/{selectedClass.maxSeats}
                </div>

                <div>
                  <div className="mt-2 max-h-44 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3">
                    {isApplicantsLoading ? (
                      <div className="text-sm text-zinc-400">신청자 목록 로딩 중...</div>
                    ) : applicantLdaps.length === 0 ? (
                      <div className="text-sm text-zinc-500">아직 신청자가 없습니다.</div>
                    ) : (
                      <div className="text-sm leading-relaxed text-zinc-200">
                        {applicantLdaps.map((ldap, idx) => (
                          <span
                            key={`${ldap}-${idx}`}
                            className={
                              ldap === currentLdap
                                ? "font-extrabold text-fuchsia-300 underline underline-offset-2"
                                : undefined
                            }
                          >
                            {idx > 0 ? ", " : null}
                            {ldap}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {selectedClass.youtubeUrl ? (
                  <a
                    href={selectedClass.youtubeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 relative block"
                  >
                    {selectedClass.videoId ? (
                      <img
                        src={`https://img.youtube.com/vi/${selectedClass.videoId}/0.jpg`}
                        alt={`${selectedClass.title} thumbnail`}
                        className="h-44 w-full rounded-xl border border-white/10 object-cover"
                      />
                    ) : (
                      <div className="h-44 w-full rounded-xl border border-white/10 bg-gradient-to-br from-fuchsia-500/30 via-violet-500/25 to-cyan-400/25" />
                    )}
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="rounded-full bg-black/55 px-3 py-1.5 text-sm font-black text-white">
                        ►
                      </span>
                    </span>
                  </a>
                ) : null}

                <div className="mt-4">
                  <button
                    type="button"
                    disabled={isBookingSubmitting}
                    onClick={() => void handleBookingAction()}
                    className={[
                      "w-full rounded-xl px-4 py-3 text-sm font-extrabold text-white hover:brightness-110 active:brightness-95 disabled:opacity-60 disabled:cursor-not-allowed transition",
                      bookingButtonLabel === "취소"
                        ? "bg-red-500 shadow-[0_20px_60px_rgba(239,68,68,0.25)]"
                        : bookingButtonLabel === "대기"
                          ? "bg-yellow-500 shadow-[0_20px_60px_rgba(234,179,8,0.25)]"
                          : "bg-blue-500 shadow-[0_20px_60px_rgba(59,130,246,0.25)]",
                    ].join(" ")}
                  >
                    {bookingButtonLabel}
                  </button>
                  {bookingMessage ? (
                    <p className="mt-2 text-xs font-semibold text-zinc-300">{bookingMessage}</p>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-sm text-zinc-400">
                상세 정보를 불러오지 못했습니다.
              </div>
            )}
          </div>
        </div>
      ) : null}

      {isAddClassOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            onClick={() => setIsAddClassOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="클래스 개설 닫기"
          />
          <div className="relative z-10 w-full max-w-md rounded-[1.5rem] border border-white/10 bg-zinc-950/90 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.65)]">
            <form className="space-y-3" onSubmit={handleSubmitAddClass}>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setNewClassType("품앗이")}
                  className={[
                    "rounded-full px-4.5 py-2.5 text-base border transition",
                    newClassType === "품앗이"
                      ? "border-fuchsia-400/60 bg-fuchsia-500/10 text-fuchsia-200 font-bold"
                      : "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10 font-normal",
                  ].join(" ")}
                >
                  품앗이
                </button>
                <button
                  type="button"
                  onClick={() => setNewClassType("정규")}
                  disabled={!["head", "manager"].includes(currentRole ?? "")}
                  className={[
                    "rounded-full px-4.5 py-2.5 text-base border transition disabled:opacity-40 disabled:cursor-not-allowed",
                    newClassType === "정규"
                      ? "border-fuchsia-400/60 bg-fuchsia-500/10 text-fuchsia-200 font-bold"
                      : "border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10 font-normal",
                  ].join(" ")}
                >
                  정규
                </button>
              </div>
              <div ref={calendarDropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsCalendarOpen((v) => !v)}
                  className="w-full rounded-xl bg-zinc-800/60 border border-white/10 px-4 py-3 text-zinc-50 text-left focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60 focus:border-fuchsia-400/40"
                >
                  {newDate || "날짜 선택"}
                </button>

                {isCalendarOpen ? (
                  <div className="absolute z-50 left-0 right-0 mt-2 rounded-xl border border-white/10 bg-zinc-800 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setCalendarCurrentDate(new Date(calendarYear, calendarMonthIndex - 1, 1))
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
                          setCalendarCurrentDate(new Date(calendarYear, calendarMonthIndex + 1, 1))
                        }
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10 transition"
                      >
                        {">"}
                      </button>
                    </div>

                    <div className="mt-2 grid grid-cols-7 gap-1 text-[12px] text-zinc-500">
                      {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
                        <div key={d} className="h-9 flex items-center justify-center text-center">
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

                        const iso = `${calendarYear}-${String(calendarMonthIndex + 1).padStart(
                          2,
                          "0"
                        )}-${String(dayNum).padStart(2, "0")}`;
                        const isPast = iso < getTodayISO();
                        const isSelected = iso === (calendarSelectedDate ?? newDate);

                        return (
                          <div key={iso} className="h-9 w-full flex items-center justify-center">
                            <button
                              type="button"
                              disabled={isPast}
                              onClick={() => {
                                if (isPast) return;
                                setCalendarSelectedDate(iso);
                                setNewDate(iso);
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
              <div ref={timeDropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsTimeDropdownOpen((v) => !v)}
                  className="w-full rounded-xl bg-zinc-800/60 border border-white/10 px-4 py-3 text-zinc-50 text-left focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60 focus:border-fuchsia-400/40"
                >
                  {newTime || "시간 선택"}
                </button>

                {isTimeDropdownOpen ? (
                  <ul className="absolute left-0 right-0 z-50 mt-2 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-zinc-800/60 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.45)] py-1">
                    {timeOptions.map((t) => {
                      const isSelected = t === newTime;
                      return (
                        <li key={t}>
                          <button
                            type="button"
                            onClick={() => {
                              setNewTime(t);
                              setIsTimeDropdownOpen(false);
                            }}
                            className={[
                              "w-full px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700/50 transition text-left",
                              isSelected ? "bg-fuchsia-500/15 text-fuchsia-200 font-semibold" : "",
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
              {newClassType === "정규" ? (
                <div className="rounded-xl border border-white/10 bg-zinc-800/40 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-zinc-200">선착순신청</div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={newIsFirstComeOpen}
                      onClick={() => setNewIsFirstComeOpen((prev) => !prev)}
                      className={[
                        "relative h-7 w-12 rounded-full border transition",
                        newIsFirstComeOpen
                          ? "border-fuchsia-400/60 bg-fuchsia-500/30"
                          : "border-white/10 bg-white/10",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "absolute top-0.5 h-5.5 w-5.5 rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.35)] transition-all",
                          newIsFirstComeOpen ? "left-6" : "left-0.5",
                        ].join(" ")}
                      />
                    </button>
                  </div>
                  {newIsFirstComeOpen ? (
                    <div className="mt-2 space-y-2">
                      <div ref={openCalendarDropdownRef} className="relative">
                        <button
                          type="button"
                          onClick={() => setIsOpenCalendarOpen((v) => !v)}
                          className="w-full rounded-xl bg-zinc-800/60 border border-white/10 px-4 py-3 text-zinc-50 text-left focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60 focus:border-fuchsia-400/40"
                        >
                          {newOpenDate || "신청 오픈 날짜 선택"}
                        </button>

                        {isOpenCalendarOpen ? (
                          <div className="absolute z-50 left-0 right-0 mt-2 rounded-xl border border-white/10 bg-zinc-800 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenCalendarCurrentDate(
                                    new Date(openCalendarYear, openCalendarMonthIndex - 1, 1)
                                  )
                                }
                                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10 transition"
                              >
                                {"<"}
                              </button>

                              <div className="text-sm font-semibold text-zinc-100">
                                {openCalendarYear}년 {openCalendarMonthIndex + 1}월
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  setOpenCalendarCurrentDate(
                                    new Date(openCalendarYear, openCalendarMonthIndex + 1, 1)
                                  )
                                }
                                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10 transition"
                              >
                                {">"}
                              </button>
                            </div>

                            <div className="mt-2 grid grid-cols-7 gap-1 text-[12px] text-zinc-500">
                              {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
                                <div key={`open-${d}`} className="h-9 flex items-center justify-center text-center">
                                  {d}
                                </div>
                              ))}
                            </div>

                            <div className="mt-2 grid grid-cols-7 gap-1">
                              {openCalendarGridDays.map((dayNum, idx) => {
                                if (!dayNum) {
                                  return (
                                    <div
                                      key={`open-empty-${idx}`}
                                      className="h-9 w-full flex items-center justify-center"
                                    />
                                  );
                                }

                                const iso = `${openCalendarYear}-${String(openCalendarMonthIndex + 1).padStart(
                                  2,
                                  "0"
                                )}-${String(dayNum).padStart(2, "0")}`;
                                const isPast = iso < getTodayISO();
                                const isSelected = iso === (openCalendarSelectedDate ?? newOpenDate);

                                return (
                                  <div key={`open-${iso}`} className="h-9 w-full flex items-center justify-center">
                                    <button
                                      type="button"
                                      disabled={isPast}
                                      onClick={() => {
                                        if (isPast) return;
                                        setOpenCalendarSelectedDate(iso);
                                        setNewOpenDate(iso);
                                        setIsOpenCalendarOpen(false);
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
                      <div ref={openTimeDropdownRef} className="relative">
                        <button
                          type="button"
                          onClick={() => setIsOpenTimeDropdownOpen((v) => !v)}
                          className="w-full rounded-xl bg-zinc-800/60 border border-white/10 px-4 py-3 text-zinc-50 text-left focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60 focus:border-fuchsia-400/40"
                        >
                          {newOpenTime || "신청 오픈 시간 선택"}
                        </button>

                        {isOpenTimeDropdownOpen ? (
                          <ul className="absolute left-0 right-0 z-50 mt-2 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-zinc-800/60 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.45)] py-1">
                            {openTimeOptions.map((t) => {
                              const isSelected = t === newOpenTime;
                              return (
                                <li key={`open-time-${t}`}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setNewOpenTime(t);
                                      setIsOpenTimeDropdownOpen(false);
                                    }}
                                    className={[
                                      "w-full px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700/50 transition text-left",
                                      isSelected ? "bg-fuchsia-500/15 text-fuchsia-200 font-semibold" : "",
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
                  ) : null}
                </div>
              ) : null}
              <input value={newClassName} onChange={(e) => setNewClassName(e.target.value)} placeholder="곡명/안무명" className="block w-full rounded-xl bg-zinc-800/60 border border-white/10 px-4 py-3 text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60 focus:border-fuchsia-400/40" />
              <textarea rows={3} value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="예상 소요시간, 난이도, 안무포인트 및 크루에게 한마디 등을 자유롭게 적어주세요." className="block w-full resize-none rounded-xl bg-zinc-800/60 border border-white/10 px-4 py-3 text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60 focus:border-fuchsia-400/40" />
              <input type="text" inputMode="numeric" value={newMaxParticipants} onChange={(e) => setNewMaxParticipants(e.target.value.replace(/[^\d]/g, ""))} placeholder="최대 모집 인원" className="block w-full rounded-xl bg-zinc-800/60 border border-white/10 px-4 py-3 text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60 focus:border-fuchsia-400/40" />
              <input value={newYoutubeUrl} onChange={(e) => setNewYoutubeUrl(e.target.value)} placeholder="유튜브 참고 링크(선택)" className="block w-full rounded-xl bg-zinc-800/60 border border-white/10 px-4 py-3 text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60 focus:border-fuchsia-400/40" />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="submit"
                  disabled={isAddClassSubmitting}
                  className="w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(192,132,252,0.35)] disabled:opacity-70"
                >
                  {isAddClassSubmitting ? "개설 중..." : "개설"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddClassOpen(false)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-200 hover:bg-white/10 transition"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

    </div>
  );
}
