"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/src/lib/supabase";

type DbClassDetail = {
  id: string | number;
  class_type?: string | null;
  date?: string | null;
  time?: string | null;
  title?: string | null;
  class_name?: string | null;
  description?: string | null;
  max_seats?: number | null;
  current_seats?: number | null;
  participants?: string[] | null;
  video_id?: string | null;
  youtube_url?: string | null;
};

type ClassDetail = {
  id: string;
  classType: string;
  date: string;
  time: string;
  title: string;
  description: string;
  maxSeats: number;
  currentSeats: number;
  participants: string[];
  youtubeUrl: string;
  videoId: string;
};

const FALLBACK_VIDEO_ID = "dQw4w9WgXcQ";

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

function extractYoutubeVideoId(url: string) {
  const fromV = url.match(/[?&]v=([A-Za-z0-9_-]{6,})/)?.[1];
  if (fromV) return fromV;
  const fromShort = url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/)?.[1];
  if (fromShort) return fromShort;
  const fromEmbed = url.match(/\/embed\/([A-Za-z0-9_-]{6,})/)?.[1];
  if (fromEmbed) return fromEmbed;
  const fromShorts = url.match(/\/shorts\/([A-Za-z0-9_-]{6,})/)?.[1];
  if (fromShorts) return fromShorts;
  return "";
}

function mapDetail(row: DbClassDetail): ClassDetail {
  const participants = Array.isArray(row.participants) ? row.participants : [];
  const currentSeats =
    typeof row.current_seats === "number" && row.current_seats >= 0
      ? row.current_seats
      : participants.length;
  const maxSeats =
    typeof row.max_seats === "number" && row.max_seats >= 0
      ? row.max_seats
      : currentSeats;
  const youtubeUrl = row.youtube_url ?? "";
  const videoId = row.video_id ?? extractYoutubeVideoId(youtubeUrl) ?? FALLBACK_VIDEO_ID;

  return {
    id: String(row.id),
    classType: row.class_type ?? "정규",
    date: normalizeDate(row.date),
    time: normalizeTime(row.time),
    title: row.title ?? row.class_name ?? "제목 없음 클래스",
    description: row.description ?? "",
    maxSeats,
    currentSeats,
    participants,
    youtubeUrl,
    videoId: videoId || FALLBACK_VIDEO_ID,
  };
}

export default function ClassDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!id) return;

    const fetchOneClass = async () => {
      setIsLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        console.error("class detail fetch error:", error?.message);
        setDetail(null);
        setErrorMessage("클래스 정보를 불러오지 못했습니다.");
        setIsLoading(false);
        return;
      }

      setDetail(mapDetail(data as DbClassDetail));
      setIsLoading(false);
    };

    void fetchOneClass();
  }, [id]);

  return (
    <div className="min-h-dvh bg-black text-zinc-50">
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="mb-5">
          <Link
            href="/home"
            className="inline-flex rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-zinc-200 hover:bg-white/10 transition"
          >
            목록으로
          </Link>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-fuchsia-400" />
            <p className="mt-3 text-sm text-zinc-400">로딩 중...</p>
          </div>
        ) : errorMessage ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : detail ? (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
            <div className="flex items-center gap-3">
              <span
                className={[
                  "rounded-full px-2 py-1 text-[11px] font-bold",
                  detail.classType === "정규"
                    ? "bg-fuchsia-500/15 text-fuchsia-200"
                    : "bg-cyan-400/15 text-cyan-200",
                ].join(" ")}
              >
                {detail.classType}
              </span>
              <span className="text-xs font-semibold text-zinc-300">
                {formatDateKorean(detail.date)} · {detail.time}
              </span>
            </div>

            <h1 className="mt-3 text-2xl font-black tracking-tight">{detail.title}</h1>

            <p className="mt-3 text-sm text-zinc-300">
              수강인원 {detail.currentSeats}/{detail.maxSeats}
            </p>

            {detail.description ? (
              <div className="mt-4 whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-4 text-sm leading-relaxed text-zinc-200">
                {detail.description}
              </div>
            ) : null}

            {detail.youtubeUrl ? (
              <div className="mt-5 space-y-3">
                <div className="overflow-hidden rounded-xl border border-white/10">
                  <iframe
                    title={`${detail.title} youtube`}
                    src={`https://www.youtube.com/embed/${detail.videoId}`}
                    className="aspect-video w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>

                <a
                  href={detail.youtubeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-100 hover:bg-white/10 transition"
                >
                  유튜브 링크 열기
                </a>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
