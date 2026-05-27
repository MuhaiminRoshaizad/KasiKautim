-- Enable Supabase Realtime change events for bill_members.
-- RLS still gates which rows each subscriber receives — organizers see
-- updates on their own bills; anon never sees anything via this table.

alter publication supabase_realtime add table public.bill_members;
