-- Run this in Supabase Dashboard -> SQL Editor to fix the missing columns error

-- Add 'manager_id' for hierarchy (Reports To)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.users(user_id);

-- Add 'is_active' for enabling/disabling users
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add 'last_assigned_at' for lead round-robin distribution
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS last_assigned_at TIMESTAMPTZ;
