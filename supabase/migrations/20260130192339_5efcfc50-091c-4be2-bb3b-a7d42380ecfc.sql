-- Add steadfast_consignment_id column to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS steadfast_consignment_id TEXT;

-- Add comment
COMMENT ON COLUMN public.orders.steadfast_consignment_id IS 'Steadfast courier consignment ID';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_steadfast_consignment_id ON public.orders(steadfast_consignment_id);