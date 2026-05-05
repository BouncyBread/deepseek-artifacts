-- RecipeForge Database Schema
-- Run this in the Supabase SQL Editor

-- Recipes table
CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cuisine TEXT NOT NULL DEFAULT 'other',
  category TEXT NOT NULL DEFAULT 'other',
  prep_time INTEGER NOT NULL DEFAULT 0,
  cook_time INTEGER NOT NULL DEFAULT 0,
  total_time INTEGER NOT NULL DEFAULT 0,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  servings INTEGER NOT NULL DEFAULT 4,
  ingredients JSONB NOT NULL DEFAULT '[]',
  steps JSONB NOT NULL DEFAULT '[]',
  equipment TEXT[] NOT NULL DEFAULT '{}',
  nutrition JSONB NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  version TEXT NOT NULL DEFAULT 'home',
  theme JSONB NOT NULL DEFAULT '{}',
  svg_illustrations JSONB NOT NULL DEFAULT '[]',
  source_notes TEXT NOT NULL DEFAULT '',
  cultural_context TEXT,
  pro_tips TEXT[] DEFAULT '{}',
  storage TEXT,
  alternative_methods JSONB DEFAULT '[]',
  equipment_notes TEXT,
  original_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration: add new columns (safe to re-run)
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS cultural_context TEXT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS pro_tips TEXT[] DEFAULT '{}';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS storage TEXT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS alternative_methods JSONB DEFAULT '[]';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS equipment_notes TEXT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS original_title TEXT;

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGSERIAL PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for search
CREATE INDEX IF NOT EXISTS idx_recipes_cuisine ON recipes(cuisine);
CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);
CREATE INDEX IF NOT EXISTS idx_recipes_tags ON recipes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON recipes(created_at DESC);

-- Chat messages index
CREATE INDEX IF NOT EXISTS idx_chat_messages_recipe ON chat_messages(recipe_id, created_at);

-- RLS: Allow anon access (passphrase auth is at app level)
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on recipes" ON recipes FOR ALL USING (true);
CREATE POLICY "Allow all on chat_messages" ON chat_messages FOR ALL USING (true);
