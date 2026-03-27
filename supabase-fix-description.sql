-- Fix: Add missing 'description' column to tickets table
-- Run this in Supabase SQL Editor

ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS description text DEFAULT '';
