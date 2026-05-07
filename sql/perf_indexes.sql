-- members lookup optimization for auth/me and admin checks
create index if not exists idx_members_ldap
  on public.members (ldap);

-- bookings lookup optimization for class detail and booking flow
create index if not exists idx_bookings_class_created_at
  on public.bookings (class_id, created_at);

create index if not exists idx_bookings_class_status_created_at
  on public.bookings (class_id, status, created_at);

-- per-user booking status fetch (/api/bookings/mine)
create index if not exists idx_bookings_member_status
  on public.bookings (member_id, status);

-- class day cron and list filtering
create index if not exists idx_classes_date_time
  on public.classes (date, time);
