-- Add two separate note fields: one for invoice, one for Steadfast
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS invoice_note text,
ADD COLUMN IF NOT EXISTS steadfast_note text;