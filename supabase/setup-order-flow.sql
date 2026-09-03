-- Order flow tables for the WhatsApp product bot.
-- Run in Supabase SQL editor after setup-product-images.sql.

-- Clients (repeat customers keyed by WhatsApp number)
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_number text NOT NULL UNIQUE,
  name text,
  delivery_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clients_whatsapp_number_idx ON public.clients (whatsapp_number);

-- Orders (v1: one product per order via items jsonb)
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_client_id_idx ON public.orders (client_id);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders (created_at DESC);

-- Per-customer conversation state for the order flow
CREATE TABLE IF NOT EXISTS public.conversation_state (
  whatsapp_number text PRIMARY KEY,
  state text NOT NULL DEFAULT 'idle',
  pending_product_id uuid NULL REFERENCES public.products (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
